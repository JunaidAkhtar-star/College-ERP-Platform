import { noticeRepository } from "../repositories";
import { redisUtil } from "../utils/redis.util";
import { notifyUsers, notifyRoleNames } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { UserModel } from "../models/user.model";
import type { INotice } from "../models/notice.model";
import { logger } from "../utils/logger.util";
import createError from "http-errors";

const NOTICE_TTL = 120; // 2 minutes — notices change infrequently

const invalidateNoticeCache = async () => {
  await redisUtil.del("notice:active:*");
};

const editableFields = new Set([
  "title",
  "content",
  "noticeType",
  "targetDepartments",
  "targetRoles",
  "targetPrograms",
  "attachments",
  "priority",
  "expiryDate",
]);

export function normalizeNotice(data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => editableFields.has(key)));
  const title = String(clean.title ?? "").trim();
  const content = String(clean.content ?? "").trim();
  if (title.length < 3 || title.length > 200)
    throw createError(400, "Title must be 3-200 characters");
  if (content.length < 3 || content.length > 20000)
    throw createError(400, "Content must be 3-20000 characters");
  clean.title = title;
  clean.content = content;
  clean.isPublished = false;
  const expiry = clean.expiryDate ? new Date(String(clean.expiryDate)) : undefined;
  if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date()))
    throw createError(400, "Expiry date must be in the future");
  if (expiry) clean.expiryDate = expiry;
  const type = String(clean.noticeType ?? "");
  if (type === "department" && !Array.isArray(clean.targetDepartments))
    throw createError(400, "Department notices require target departments");
  if (type === "role_based" && !Array.isArray(clean.targetRoles))
    throw createError(400, "Role-based notices require target roles");
  return clean;
}

/**
 * Resolve every active user that matches a published notice's audience
 * scope and broadcast a real-time notification to them.
 */
async function broadcastNotice(notice: INotice | null | undefined): Promise<void> {
  if (!notice || !notice.isPublished) return;
  try {
    if (notice.targetRoles?.length) {
      await notifyRoleNames(notice.targetRoles, {
        title: `New notice: ${notice.title}`,
        body: notice.content.slice(0, 200),
        type: NotificationType.GENERAL,
        actionUrl: "/notice",
        withEmail: notice.priority === "urgent",
        emailTemplate: EmailTemplate.NOTICE_PUBLISHED,
      });
      return;
    }
    const filter: Record<string, unknown> = { status: "active" };
    if (notice.targetDepartments?.length) filter.department = { $in: notice.targetDepartments };
    const users = await UserModel.find(filter).select("_id").lean();
    await notifyUsers(
      users.map((u) => u._id),
      {
        title: `New notice: ${notice.title}`,
        body: notice.content.slice(0, 200),
        type: NotificationType.GENERAL,
        actionUrl: "/notice",
        withEmail: notice.priority === "urgent",
        emailTemplate: EmailTemplate.NOTICE_PUBLISHED,
      },
    );
  } catch (err) {
    logger.error("[broadcastNotice] failed", { err, noticeId: String(notice._id) });
  }
}

export const noticeService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    noticeRepository.list(filter, page, limit),

  getById: (id: string) => noticeRepository.findById(id),

  getActiveForUser: (
    roles: string[],
    departmentIds: string[],
    programs: string[],
    page: number,
    limit: number,
    userId?: string,
  ) => {
    // NOTE: isRead is per-user so we cannot cache when userId is provided.
    if (userId) {
      return noticeRepository.getActiveForUser(roles, departmentIds, programs, page, limit, userId);
    }
    const cacheKey = `notice:active:${roles.sort().join(",")}_${departmentIds.sort().join(",")}_${programs.sort().join(",")}_p${page}_l${limit}`;
    return redisUtil.remember(cacheKey, NOTICE_TTL, () =>
      noticeRepository.getActiveForUser(roles, departmentIds, programs, page, limit),
    );
  },

  create: async (data: Record<string, unknown>) => {
    const result = await noticeRepository.create({
      ...normalizeNotice(data),
      createdBy: data.createdBy,
    });
    await invalidateNoticeCache();
    void broadcastNotice(result as unknown as INotice);
    return result;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const current = await noticeRepository.findById(id);
    if (!current) throw createError(404, "Notice not found");
    if (current.isPublished) throw createError(409, "Published notices are immutable");
    const result = await noticeRepository.updateById(id, {
      ...normalizeNotice({ ...current, ...data }),
      updatedBy: data.updatedBy,
    });
    await invalidateNoticeCache();
    return result;
  },

  publish: async (id: string, publishedBy: string) => {
    const result = await noticeRepository.publish(id, publishedBy);
    if (!result) throw createError(409, "Notice is already published or requires another approver");
    await invalidateNoticeCache();
    void broadcastNotice(result as unknown as INotice);
    return result;
  },

  delete: async (id: string, deletedBy: string) => {
    const result = await noticeRepository.deleteById(id, deletedBy);
    if (!result) throw createError(409, "Only unpublished notices can be withdrawn");
    await invalidateNoticeCache();
    return result;
  },

  markRead: (noticeId: string, userId: string) => noticeRepository.markRead(noticeId, userId),
  stats: () => noticeRepository.stats(),
};
