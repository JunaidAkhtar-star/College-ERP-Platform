/** Annual graduation-review reminder. Graduation itself is an explicit governed transaction. */
import cron from "node-cron";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "../models/notification.model";
import { notificationService } from "../services/notification.service";
import { logger } from "../utils/logger.util";

async function remindGraduationReview(): Promise<void> {
  try {
    await notificationService.create({
      title: "Annual graduation review is due",
      body: "Review final academic results and clear institutional dues before graduating students. Alumni profiles are created only through the governed graduation action.",
      type: NotificationType.SYSTEM,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      audience: NotificationAudience.ADMIN,
      actionUrl: "/admin/alumni",
      createdBy: "system",
      createdByName: "Institution ERP",
    });
    logger.cron("alumni-review — annual graduation review reminder sent");
  } catch (error) {
    logger.error("alumni-review reminder failed", error);
  }
}

export function startAlumniSyncJob(): void {
  cron.schedule("0 1 1 7 *", remindGraduationReview);
  logger.cron("Alumni graduation-review reminder started (annually 1 July 01:00)");
}
