import createError from "http-errors";
import { notificationRepository } from "../repositories";
import { emailService, EmailTemplate } from "../email/email.service";
import { NotificationAudience, NotificationChannel, NotificationType } from "../models";
import { UserModel } from "../models/user.model";
import { pushNotification } from "../socket/socket.gateway";
import { logger } from "../utils/logger.util";
import { ALL_ROLES, SystemRole } from "../constants/roles";
import { CommunicationCampaignModel } from "../models/communication-hub.model";

/**
 * Routes a notification's `type` to the per-scenario email template. Anything
 * not in this map falls back to the brand-styled `general-notification`
 * template (still on-brand, just less scenario-specific copy).
 */
const TEMPLATE_BY_TYPE: Partial<Record<NotificationType, EmailTemplate>> = {
  [NotificationType.LEAVE]: EmailTemplate.LEAVE_UPDATE,
  [NotificationType.ASSIGNMENT]: EmailTemplate.ASSIGNMENT_GRADED,
  [NotificationType.LESSON_PLAN]: EmailTemplate.LESSON_PLAN_UPDATE,
  [NotificationType.SEMESTER_REGISTRATION]: EmailTemplate.SEMESTER_REGISTRATION_UPDATE,
  [NotificationType.LIBRARY]: EmailTemplate.LIBRARY_NOTICE,
  [NotificationType.HOSTEL]: EmailTemplate.HOSTEL_ALLOCATION,
  [NotificationType.GRIEVANCE]: EmailTemplate.GRIEVANCE_UPDATE,
  [NotificationType.COUNSELING]: EmailTemplate.COUNSELING_SCHEDULED,
  [NotificationType.NOTICE]: EmailTemplate.NOTICE_PUBLISHED,
  [NotificationType.RESULT]: EmailTemplate.RESULT_PUBLISHED,
};

const FRONTEND_ROUTES = new Set([
  "/dashboard",
  "/notification",
  "/admission",
  "/academic-structure",
  "/departments",
  "/curriculum",
  "/subjects",
  "/academic-calendar",
  "/timetable",
  "/lesson-plan",
  "/course-progress",
  "/semester-registration",
  "/students",
  "/student-profile",
  "/faculty",
  "/faculty-profile",
  "/faculty-workload",
  "/attendance",
  "/faculty-attendance",
  "/examination",
  "/assignment",
  "/quiz",
  "/study-material",
  "/fee",
  "/accounts",
  "/scholarship",
  "/payment-settings",
  "/library",
  "/counseling",
  "/hostel",
  "/transport",
  "/store",
  "/document",
  "/placement",
  "/job-posting",
  "/training-session",
  "/meeting",
  "/event",
  "/notice",
  "/chat",
  "/leave",
  "/grievance",
  "/profile",
  "/settings",
  "/tenants",
  "/leads",
  "/licenses",
  "/products",
  "/plans",
  "/billing",
  "/public-site",
]);

function normalizeActionUrl(actionUrl?: string) {
  if (!actionUrl?.trim()) return undefined;
  const raw = actionUrl.trim();
  if (/^https?:\/\//i.test(raw)) return raw;

  let url = raw.startsWith("/") ? raw : `/${raw}`;
  url = url.replace(/^\/admission\/applications\/([^/?#]+)(.*)$/i, "/admission/$1$2");
  url = url.replace(/^\/meetings\/[^/?#]+.*$/i, "/meeting");

  const segments = url.split("/");
  const maybeRole = segments[1];
  if (
    maybeRole &&
    maybeRole !== "parent" &&
    ALL_ROLES.includes(maybeRole as (typeof ALL_ROLES)[number])
  ) {
    url = `/${segments.slice(2).join("/")}`;
  }

  const [path, suffix = ""] = url.split(/(?=[?#])/);
  const legacy: Record<string, string> = {
    "/student/fees": "/fee",
    "/fees": "/fee",
    "/payment-submission": "/accounts",
    "/warden/hostel/complaints": "/hostel",
    "/admission-portal": "/dashboard",
  };
  const normalizedPath = legacy[path] ?? path;

  if (normalizedPath.startsWith("/chat")) return `${normalizedPath}${suffix}`;
  if (normalizedPath.startsWith("/admission/")) return `${normalizedPath}${suffix}`;
  if (FRONTEND_ROUTES.has(normalizedPath)) return `${normalizedPath}${suffix}`;

  logger.warn("[Notification] Unknown actionUrl normalized to /notification", { actionUrl });
  return "/notification";
}

function normalizeNotificationType(type: string) {
  return Object.values(NotificationType).includes(type as NotificationType)
    ? type
    : NotificationType.GENERAL;
}

function shapeNotificationForUser<
  T extends { readBy?: Array<{ userId?: unknown }>; body?: string },
>(notification: T, userId: string) {
  const isRead = (notification.readBy ?? []).some(
    (entry) => String(entry.userId) === String(userId),
  );
  return {
    ...notification,
    message: notification.body,
    isRead,
  };
}

function isVisibleToUser(
  notification: {
    audience: NotificationAudience;
    targetUserIds?: unknown[];
    targetDepartments?: string[];
    isActive?: boolean;
    expiresAt?: Date;
  },
  userId: string,
  roles: string[],
  departmentCode?: string,
) {
  if (notification.isActive === false) return false;
  if (notification.expiresAt && new Date(notification.expiresAt) <= new Date()) return false;
  if (notification.targetUserIds?.some((id) => String(id) === userId)) return true;
  if (notification.audience === "All") return true;
  if (notification.audience === "Students" && roles.includes("student")) return true;
  if (notification.audience === "Faculty" && roles.includes("faculty")) return true;
  if (notification.audience === "Parents" && roles.includes("parent")) return true;
  if (
    notification.audience === "Admin" &&
    roles.some((role) => ["super_admin", "principal", "hod"].includes(role))
  )
    return true;
  return Boolean(
    departmentCode && notification.targetDepartments?.some((code) => code === departmentCode),
  );
}

export const notificationService = {
  create: async (data: {
    title: string;
    body: string;
    type: string;
    channels: string[];
    audience: NotificationAudience;
    targetDepartments?: string[];
    targetPrograms?: string[];
    targetSemesters?: number[];
    targetBatches?: string[];
    targetUserIds?: string[];
    isScheduled?: boolean;
    scheduledAt?: string;
    attachmentUrl?: string;
    actionUrl?: string;
    expiresAt?: string;
    createdBy: string;
    createdByName: string;
    /**
     * Optional explicit email template override. When provided, the email
     * dispatcher uses this template instead of the type→template fallback
     * map. Useful when the in-app `type` is a UI category (e.g. WARNING for
     * a leave rejection) but the email should still use the dedicated
     * scenario template (leave-update).
     */
    emailTemplate?: EmailTemplate;
  }) => {
    const actionUrl = normalizeActionUrl(data.actionUrl);
    const type = normalizeNotificationType(data.type);
    let targetUserIds = Array.from(
      new Set((data.targetUserIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    );
    if (!targetUserIds.length) {
      const rolesByAudience: Partial<Record<NotificationAudience, SystemRole[]>> = {
        [NotificationAudience.STUDENTS]: [SystemRole.STUDENT],
        [NotificationAudience.FACULTY]: [SystemRole.FACULTY],
        [NotificationAudience.PARENTS]: [SystemRole.PARENT],
        [NotificationAudience.ADMIN]: [
          SystemRole.SUPER_ADMIN,
          SystemRole.ADMIN,
          SystemRole.PRINCIPAL,
          SystemRole.HOD,
        ],
      };
      const audienceRoles = rolesByAudience[data.audience];
      if (data.audience === NotificationAudience.ALL || audienceRoles) {
        const recipients = await UserModel.find({
          status: "active",
          ...(audienceRoles ? { roles: { $in: audienceRoles } } : {}),
        })
          .select("_id")
          .lean();
        targetUserIds = recipients.map((recipient) => String(recipient._id));
      }
    }
    const notification = await notificationRepository.create({
      ...data,
      type,
      actionUrl,
      targetUserIds,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });

    // If not scheduled and has email channel, trigger email immediately
    if (!data.isScheduled && data.channels.includes(NotificationChannel.EMAIL)) {
      const overrideTemplate = data.emailTemplate;
      setImmediate(() =>
        notificationService
          ._dispatchEmail(notification._id.toString(), overrideTemplate)
          .catch(console.error),
      );
    }

    // Real-time push to targeted users if they are online
    if (!data.isScheduled && targetUserIds.length) {
      const inApp = data.channels.includes(NotificationChannel.IN_APP);
      const push = data.channels.includes(NotificationChannel.PUSH);
      for (const uid of targetUserIds) {
        if (inApp || push) {
          pushNotification(
            uid,
            {
              _id: notification._id,
              title: notification.title,
              body: notification.body,
              type: notification.type,
              actionUrl: notification.actionUrl,
              createdAt: notification.createdAt,
            },
            { inApp, push },
          );
        }
      }
    }

    return notification;
  },

  getById: async (id: string, userId: string, roles: string[], departmentCode?: string) => {
    const n = await notificationRepository.findById(id);
    if (!n || !isVisibleToUser(n, userId, roles, departmentCode))
      throw createError(404, "Notification not found");
    return shapeNotificationForUser(n, userId);
  },

  listAll: (filter: Record<string, unknown>, page = 1, limit = 20) =>
    notificationRepository.listAll(filter, page, limit),

  getForUser: async (
    userId: string,
    roles: string[],
    departmentCode?: string,
    page = 1,
    limit = 20,
  ) => {
    const result = await notificationRepository.getForUser(
      userId,
      roles,
      departmentCode,
      page,
      limit,
    );
    return {
      ...result,
      data: result.data.map((notification) => shapeNotificationForUser(notification, userId)),
    };
  },

  markRead: async (id: string, userId: string, roles: string[], departmentCode?: string) => {
    const existing = await notificationRepository.findById(id);
    if (!existing || !isVisibleToUser(existing, userId, roles, departmentCode))
      throw createError(404, "Notification not found");
    const n = await notificationRepository.markRead(id, userId);
    return n ?? shapeNotificationForUser(existing, userId);
  },

  markAllRead: async (userId: string, roles: string[], departmentCode?: string) => {
    const visible = await notificationRepository.getForUser(userId, roles, departmentCode, 1, 500);
    const unreadIds = visible.data
      .filter(
        (notification) =>
          !(notification.readBy ?? []).some((entry) => String(entry.userId) === userId),
      )
      .map((notification) => notification._id.toString());
    await Promise.all(unreadIds.map((id) => notificationRepository.markRead(id, userId)));
    return { updated: unreadIds.length };
  },

  /** Mark all unread chat notifications for a user as read. */
  markAllChatRead: (userId: string) => notificationRepository.markAllChatRead(userId),

  /** Hide admission workflow notifications once the applicant becomes an enrolled student. */
  retireAdmissionPipelineForUser: (userId: string) =>
    notificationRepository.deactivateAdmissionPipelineForUser(userId),

  update: async (id: string, data: Record<string, unknown>) => {
    const updated = await notificationRepository.updateById(id, data);
    if (!updated) throw createError(404, "Notification not found");
    return updated;
  },

  deactivate: (id: string) => notificationRepository.updateById(id, { isActive: false }),

  // Process scheduled notifications (called by cron job / scheduler)
  processScheduled: async () => {
    const pending = await notificationRepository.getPendingScheduled();
    for (const n of pending) {
      try {
        if (n.channels.includes(NotificationChannel.EMAIL)) {
          await notificationService._dispatchEmail(n._id.toString());
        }
        const inApp = n.channels.includes(NotificationChannel.IN_APP);
        const push = n.channels.includes(NotificationChannel.PUSH);
        if (inApp || push) {
          for (const userId of n.targetUserIds ?? []) {
            pushNotification(
              userId.toString(),
              {
                _id: n._id,
                title: n.title,
                body: n.body,
                type: n.type,
                actionUrl: n.actionUrl,
                createdAt: n.createdAt,
              },
              { inApp, push },
            );
          }
        }
        await notificationRepository.updateById(n._id.toString(), {
          isSent: true,
          sentAt: new Date(),
        });
        const campaign = await CommunicationCampaignModel.findOne({
          notificationId: n._id,
          status: "scheduled",
        });
        if (campaign) {
          campaign.status = "sent";
          campaign.sentAt = new Date();
          campaign.channelStats = campaign.channelStats.map((channel) =>
            channel.status === "pending" && channel.channel !== "sms"
              ? { ...channel, status: "sent", delivered: campaign.recipientCount }
              : channel,
          );
          await campaign.save();
        }
      } catch (err) {
        logger.error("[NotificationService] Failed to send scheduled notification", {
          id: n._id,
          err,
        });
      }
    }
    return pending.length;
  },

  _dispatchEmail: async (notificationId: string, overrideTemplate?: EmailTemplate) => {
    const n = await notificationRepository.findById(notificationId);
    if (!n) return;

    const targetIds = (n.targetUserIds ?? []).map((id) => id.toString());
    if (targetIds.length === 0) {
      logger.info(
        `[Notification] Skipping email for "${n.title}" — no target users (audience=${n.audience})`,
      );
      await notificationRepository.updateById(notificationId, {
        isSent: true,
        sentAt: new Date(),
      });
      return;
    }

    // Pull recipients honouring per-user email opt-in preference.
    const recipients = await UserModel.find({
      _id: { $in: targetIds },
      status: "active",
      email: { $exists: true, $ne: "" },
      $or: [
        { "notificationPreferences.email": { $exists: false } },
        { "notificationPreferences.email": true },
      ],
    })
      .select("name email")
      .lean();

    if (recipients.length === 0) {
      logger.info(
        `[Notification] No opted-in email recipients for "${n.title}" (notification=${notificationId})`,
      );
      await notificationRepository.updateById(notificationId, {
        isSent: true,
        sentAt: new Date(),
      });
      return;
    }

    const template =
      overrideTemplate ??
      TEMPLATE_BY_TYPE[n.type as NotificationType] ??
      EmailTemplate.GENERAL_NOTIFICATION;

    // Send one personalised mail per recipient so {{recipientName}} is correct.
    await Promise.all(
      recipients.map((u) =>
        emailService
          .sendNotificationEmail(
            u.email,
            template,
            {
              recipientName: u.name,
              title: n.title,
              body: n.body,
              actionUrl: n.actionUrl,
            },
            n.title,
          )
          .catch((err) =>
            logger.error("[Notification] Email send failed", {
              err,
              to: u.email,
              notificationId,
            }),
          ),
      ),
    );

    await notificationRepository.updateById(notificationId, {
      isSent: true,
      sentAt: new Date(),
    });
  },

  cleanupExpired: () => notificationRepository.deactivateExpired(),
};
