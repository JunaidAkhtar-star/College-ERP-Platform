/**
 * Data Retention / Cleanup Job
 *
 * Runs daily at 02:30 (server time) and hard-deletes ageing rows from
 * transient log-style collections so the database does not grow without
 * bound. Retention windows are env-configurable; defaults are conservative
 * — change them in .env if your compliance policy demands longer.
 *
 *  ┌──────────────────────────────┬─────────────────────────────────────────────┐
 *  │ Target                       │ Default retention (env override)            │
 *  ├──────────────────────────────┼─────────────────────────────────────────────┤
 *  │ notifications                │ 30 days  (NOTIFICATION_RETENTION_DAYS)      │
 *  │ auditlogs                    │ 90 days  (AUDIT_LOG_RETENTION_DAYS)         │
 *  │ soft-deleted records         │ 30 days  (SOFT_DELETE_PURGE_DAYS)           │
 *  │ users.activeSessions[]       │  7 days  (ACTIVE_SESSION_RETENTION_DAYS)    │
 *  │ notice read receipts         │180 days  (NOTICE_READ_RETENTION_DAYS)       │
 *  │ chat messages (deleted)      │ 30 days  (DELETED_CHAT_MESSAGE_RETENTION…)  │
 *  └──────────────────────────────┴─────────────────────────────────────────────┘
 *
 * Notes
 *  - OTPs are auto-removed by a MongoDB TTL index on `expiresAt`, so they
 *    are not handled here.
 *  - Soft-deleted purge scans every collection whose schema has the audit
 *    plugin (i.e. has an `isDeleted` flag) and hard-deletes rows whose
 *    `deletedAt` is older than the retention window.
 *  - Active-session purge pulls stale jti entries from `users.activeSessions[]`
 *    so the array does not grow forever as users log in from many devices.
 *  - Document expiry marks expired documents as `expired` so admissions/HR/admin
 *    dashboards do not show stale certificates as verified forever.
 *  - Expired notices are unpublished, and old read receipts for those notices
 *    are purged after the notice-read retention window.
 *  - Chat-message purge removes individual messages inside conversations that
 *    have been "deleted for everyone" beyond the retention window. The
 *    conversation document itself is preserved.
 *  - Set any retention to `0` to disable that particular sweep.
 */
import cron from "node-cron";
import mongoose from "mongoose";
import { configs } from "../configs";
import { NotificationModel } from "../models/notification.model";
import { AuditLogModel } from "../models/audit-log.model";
import { UserModel } from "../models/user.model";
import { ChatMessageModel } from "../models/chat.model";
import { DocumentModel, DocumentStatus } from "../models/document.model";
import { NoticeModel, NoticeReadModel } from "../models/notice.model";
import { uploadUtil } from "../utils/upload.util";
import { logger } from "../utils/logger.util";
import { meetingRecordingService } from "../services/meeting-recording.service";
import { dataPortabilityService } from "../services/data-portability.service";
import { erpAssistantService } from "../services/erp-assistant.service";

const {
  NOTIFICATION_RETENTION_DAYS,
  AUDIT_LOG_RETENTION_DAYS,
  SOFT_DELETE_PURGE_DAYS,
  ACTIVE_SESSION_RETENTION_DAYS,
  NOTICE_READ_RETENTION_DAYS,
  DELETED_CHAT_MESSAGE_RETENTION_DAYS,
} = configs;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function purgeOldNotifications(): Promise<number> {
  if (!Number.isFinite(NOTIFICATION_RETENTION_DAYS) || NOTIFICATION_RETENTION_DAYS <= 0) return 0;
  const cutoff = daysAgo(NOTIFICATION_RETENTION_DAYS);
  const res = await NotificationModel.deleteMany({ createdAt: { $lt: cutoff } });
  return res.deletedCount ?? 0;
}

async function purgeOldAuditLogs(): Promise<number> {
  if (!Number.isFinite(AUDIT_LOG_RETENTION_DAYS) || AUDIT_LOG_RETENTION_DAYS <= 0) return 0;
  const cutoff = daysAgo(AUDIT_LOG_RETENTION_DAYS);
  const res = await AuditLogModel.deleteMany({ createdAt: { $lt: cutoff } });
  return res.deletedCount ?? 0;
}

async function purgeSoftDeleted(): Promise<{ total: number; perModel: Record<string, number> }> {
  if (!Number.isFinite(SOFT_DELETE_PURGE_DAYS) || SOFT_DELETE_PURGE_DAYS <= 0) {
    return { total: 0, perModel: {} };
  }
  const cutoff = daysAgo(SOFT_DELETE_PURGE_DAYS);
  let total = 0;
  const perModel: Record<string, number> = {};
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    // Only target schemas that opted into soft-delete (have `isDeleted` path).
    if (!model.schema.path("isDeleted")) continue;
    try {
      const res = await model.deleteMany({
        isDeleted: true,
        $or: [{ deletedAt: { $lt: cutoff } }, { deletedAt: null, updatedAt: { $lt: cutoff } }],
      });
      const n = res.deletedCount ?? 0;
      if (n > 0) {
        perModel[name] = n;
        total += n;
      }
    } catch (err) {
      logger.error(`cleanup — failed to purge soft-deleted ${name}`, err);
    }
  }
  return { total, perModel };
}

async function purgeStaleSessions(): Promise<number> {
  if (!Number.isFinite(ACTIVE_SESSION_RETENTION_DAYS) || ACTIVE_SESSION_RETENTION_DAYS <= 0) {
    return 0;
  }
  const cutoff = daysAgo(ACTIVE_SESSION_RETENTION_DAYS);
  // Pull stale jti entries from every user. modifiedCount = users affected,
  // not entries removed, but it's a useful signal for the log line.
  const res = await UserModel.updateMany(
    { "activeSessions.createdAt": { $lt: cutoff } },
    { $pull: { activeSessions: { createdAt: { $lt: cutoff } } } },
  );
  return res.modifiedCount ?? 0;
}

async function markExpiredDocuments(): Promise<number> {
  const res = await DocumentModel.updateMany(
    { expiresAt: { $lt: new Date() }, isExpired: false },
    { $set: { isExpired: true, status: DocumentStatus.EXPIRED } },
  );
  return res.modifiedCount ?? 0;
}

async function unpublishExpiredNotices(): Promise<number> {
  const res = await NoticeModel.updateMany(
    { isPublished: true, expiryDate: { $lt: new Date() } },
    { $set: { isPublished: false } },
  );
  return res.modifiedCount ?? 0;
}

async function purgeOldNoticeReads(): Promise<number> {
  if (!Number.isFinite(NOTICE_READ_RETENTION_DAYS) || NOTICE_READ_RETENTION_DAYS <= 0) {
    return 0;
  }

  const cutoff = daysAgo(NOTICE_READ_RETENTION_DAYS);
  const expiredNoticeIds = await NoticeModel.distinct("_id", { expiryDate: { $lt: cutoff } });
  if (expiredNoticeIds.length === 0) return 0;

  const res = await NoticeReadModel.deleteMany({ noticeId: { $in: expiredNoticeIds } });
  return res.deletedCount ?? 0;
}

async function purgeDeletedChatMessages(): Promise<{ convos: number; files: number }> {
  if (
    !Number.isFinite(DELETED_CHAT_MESSAGE_RETENTION_DAYS) ||
    DELETED_CHAT_MESSAGE_RETENTION_DAYS <= 0
  ) {
    return { convos: 0, files: 0 };
  }
  const cutoff = daysAgo(DELETED_CHAT_MESSAGE_RETENTION_DAYS);

  // Step 1 — collect Cloudinary file URLs from messages about to be purged.
  const messagesToPurge = await ChatMessageModel.find(
    { isDeleted: true, createdAt: { $lt: cutoff }, fileUrl: { $exists: true, $ne: null } },
    { fileUrl: 1 },
  ).lean();

  let filesDeleted = 0;
  for (const m of messagesToPurge) {
    if (!m.fileUrl) continue;
    const ok = await uploadUtil.deleteByUrl(m.fileUrl);
    if (ok) filesDeleted++;
  }

  // Step 2 — hard-delete the ChatMessage docs.
  const res = await ChatMessageModel.deleteMany({
    isDeleted: true,
    createdAt: { $lt: cutoff },
  });
  return { convos: res.deletedCount ?? 0, files: filesDeleted };
}

export async function runCleanup(): Promise<void> {
  const startedAt = Date.now();
  logger.cron("cleanup — Starting nightly retention sweep…");
  try {
    const [
      notifications,
      auditLogs,
      softDeleted,
      sessions,
      expiredDocuments,
      expiredNotices,
      noticeReads,
      chatMessages,
      expiredRecordings,
      exportArtifacts,
      assistantHistory,
    ] = await Promise.all([
      purgeOldNotifications(),
      purgeOldAuditLogs(),
      purgeSoftDeleted(),
      purgeStaleSessions(),
      markExpiredDocuments(),
      unpublishExpiredNotices(),
      purgeOldNoticeReads(),
      purgeDeletedChatMessages(),
      meetingRecordingService.purgeExpired(),
      dataPortabilityService.purgeExpiredArtifacts(),
      erpAssistantService.purgeExpiredHistory(),
    ]);
    const ms = Date.now() - startedAt;
    logger.cron(
      `cleanup — Done in ${ms}ms · notifications=${notifications} · auditLogs=${auditLogs} · softDeleted=${softDeleted.total}${
        softDeleted.total > 0 ? ` ${JSON.stringify(softDeleted.perModel)}` : ""
      } · sessionsTrimmed=${sessions} · expiredDocuments=${expiredDocuments} · expiredNotices=${expiredNotices} · noticeReadsPurged=${noticeReads} · chatMessagesPurged=${chatMessages.convos} · chatFilesDeleted=${chatMessages.files} · assistantHistoryPurged=${assistantHistory} · meetingRecordingsExpired=${expiredRecordings} · exportArtifactsPurged=${exportArtifacts.purged} · exportArtifactsHeld=${exportArtifacts.held}`,
    );
  } catch (err) {
    logger.error("cleanup — sweep failed", err);
  }
}

export function startCleanupJob(): void {
  // Daily at 02:30 — well past midnight reporting jobs, before morning load.
  cron.schedule("30 2 * * *", runCleanup);
  logger.cron(
    `Data retention job started (daily 02:30) · notifications=${NOTIFICATION_RETENTION_DAYS}d · auditLogs=${AUDIT_LOG_RETENTION_DAYS}d · softDeleted=${SOFT_DELETE_PURGE_DAYS}d · sessions=${ACTIVE_SESSION_RETENTION_DAYS}d · noticeReads=${NOTICE_READ_RETENTION_DAYS}d · deletedChatMsgs=${DELETED_CHAT_MESSAGE_RETENTION_DAYS}d`,
  );
}
