/**
 * @file notify.helper.ts
 * @description Shared helpers around `notificationService.create` so every
 * service can fire real-time + in-app + (optional) email notifications with
 * one tiny call instead of repeating the same boilerplate.
 *
 * Targeting is dynamic — roles and permissions are resolved from the live
 * `Role` collection, so custom roles created by Super Admin are picked up
 * automatically without code changes.
 *
 * Channels are decided here:
 *  - `IN_APP` is always included (bell + slide-in toast + FCM).
 *  - `EMAIL` is added when `withEmail: true`.
 *
 * Any failure is logged but never thrown — notifications are best-effort and
 * must never break the underlying business operation.
 *
 * @module services/helpers
 */

import type { Types } from "mongoose";
import { notificationService } from "../notification.service";
import {
  NotificationType,
  NotificationChannel,
  NotificationAudience,
} from "../../models/notification.model";
import type { EmailTemplate } from "../../email/email.service";
import { UserModel } from "../../models/user.model";
import { RoleModel } from "../../models/role.model";
import { StudentProfileModel } from "../../models/student-profile.model";
import type { Module, PermissionAction } from "../../constants/permissions";
import { logger } from "../../utils/logger.util";

export interface INotifyOpts {
  title: string;
  body: string;
  type?: NotificationType;
  actionUrl?: string;
  withEmail?: boolean;
  /**
   * Explicit per-scenario email template. If omitted, the dispatcher picks
   * one from `type` (or falls back to the brand-styled generic template).
   */
  emailTemplate?: EmailTemplate;
  /** Defaults to "system". Pass a user id if a specific person triggered it. */
  createdBy?: string;
  /** Defaults to the neutral tenant product name. */
  createdByName?: string;
}

type IdLike = string | Types.ObjectId | { toString(): string } | null | undefined;

function toIdStrings(ids: IdLike[]): string[] {
  return Array.from(
    new Set(
      ids
        .filter(Boolean)
        .map((id) => {
          if (!id) return "";
          if (typeof id === "string") return id;
          if (typeof id === "object") {
            const obj = id as Record<string, unknown>;
            if (obj._id) return String(obj._id);
            if (typeof obj.toString === "function") {
              const str = obj.toString();
              if (str !== "[object Object]") return str;
            }
          }
          return String(id);
        })
        .filter(Boolean),
    ),
  );
}

function buildChannels(withEmail?: boolean): NotificationChannel[] {
  return withEmail
    ? [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL]
    : [NotificationChannel.IN_APP, NotificationChannel.PUSH];
}

/**
 * Fire a notification to a specific set of users.
 * Silent on empty input.
 */
export async function notifyUsers(targets: IdLike[], opts: INotifyOpts): Promise<void> {
  const targetUserIds = toIdStrings(targets);
  if (targetUserIds.length === 0) return;
  try {
    await notificationService.create({
      title: opts.title,
      body: opts.body,
      type: opts.type ?? NotificationType.INFO,
      channels: buildChannels(opts.withEmail),
      audience: NotificationAudience.SPECIFIC_USER,
      targetUserIds,
      actionUrl: opts.actionUrl,
      emailTemplate: opts.emailTemplate,
      createdBy: opts.createdBy ?? "system",
      createdByName: opts.createdByName ?? "Institution ERP",
    });
  } catch (err) {
    logger.error("[notifyUsers] failed", { err, title: opts.title });
  }
}

/**
 * Fire a notification to every ACTIVE user that holds any of the given role
 * names. Role names are matched against the live `Role` collection (system
 * roles + custom roles created by Super Admin).
 *
 * Optionally scope by department (Mongo ObjectId).
 */
export async function notifyRoleNames(
  roleNames: string[],
  opts: INotifyOpts & { departmentId?: IdLike },
): Promise<void> {
  try {
    if (roleNames.length === 0) return;
    const normalized = roleNames.map((r) => r.toLowerCase());
    const filter: Record<string, unknown> = {
      roles: { $in: normalized },
      status: "active",
    };
    if (opts.departmentId) filter.department = opts.departmentId;
    const users = await UserModel.find(filter).select("_id").lean();
    await notifyUsers(
      users.map((u) => u._id),
      opts,
    );
  } catch (err) {
    logger.error("[notifyRoleNames] failed", { err, roleNames, title: opts.title });
  }
}

/**
 * Fire a notification to every ACTIVE user whose role grants the given
 * `module + action` permission. Resolved live from the `Role` collection,
 * so newly-created custom roles automatically receive matching notifications.
 *
 * Optionally scope by department.
 */
export async function notifyByPermission(
  module: Module,
  action: PermissionAction,
  opts: INotifyOpts & { departmentId?: IdLike },
): Promise<void> {
  try {
    const roles = await RoleModel.find({
      isActive: true,
      permissions: { $elemMatch: { module, actions: action } },
    })
      .select("name")
      .lean();
    const names = roles.map((r) => r.name);
    if (names.length === 0) return;
    await notifyRoleNames(names, opts);
  } catch (err) {
    logger.error("[notifyByPermission] failed", {
      err,
      module,
      action,
      title: opts.title,
    });
  }
}

/**
 * Resolve student user ids for a given class scope and notify each one.
 * Any combination of filters is allowed — empty filters mean "all students".
 */
export async function notifyStudentsByClass(
  scope: {
    departmentId?: IdLike;
    program?: string;
    semester?: number;
    section?: string;
    branch?: string;
    academicYear?: string;
  },
  opts: INotifyOpts,
): Promise<void> {
  try {
    const filter: Record<string, unknown> = { status: { $ne: "inactive" } };
    if (scope.departmentId) filter.department = scope.departmentId;
    if (scope.program) filter.program = scope.program;
    if (scope.semester) filter.currentSemester = scope.semester;
    if (scope.section) filter.section = scope.section;
    if (scope.branch) filter.branch = scope.branch;
    if (scope.academicYear) filter.academicYear = scope.academicYear;
    const profiles = await StudentProfileModel.find(filter).select("userId").lean();
    await notifyUsers(
      profiles.map((p) => p.userId),
      opts,
    );
  } catch (err) {
    logger.error("[notifyStudentsByClass] failed", { err, scope, title: opts.title });
  }
}
