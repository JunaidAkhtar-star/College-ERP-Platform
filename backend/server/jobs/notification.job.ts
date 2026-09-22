/**
 * Scheduled Notification Processor
 * Runs every 5 minutes — picks up scheduled notifications whose
 * scheduledAt ≤ now and dispatches them.
 */
import cron from "node-cron";
import { notificationService } from "../services/notification.service";
import { communicationHubService } from "../services/communication-hub.service";
import { logger } from "../utils/logger.util";

export function startNotificationScheduler(): void {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const count = await notificationService.processScheduled();
      await communicationHubService.processScheduledSms();
      if (count > 0) logger.cron(`notifications — Dispatched ${count} scheduled notification(s)`);
    } catch (err) {
      logger.error("notification scheduler failed", err);
    }
  });

  // Daily at midnight — clean up expired notifications
  cron.schedule("0 0 * * *", async () => {
    try {
      await notificationService.cleanupExpired();
      logger.cron("notifications — Expired notifications deactivated");
    } catch (err) {
      logger.error("notification cleanup failed", err);
    }
  });

  logger.cron("Notification scheduler started (every 5 min)");
}
