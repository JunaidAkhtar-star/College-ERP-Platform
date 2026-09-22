/**
 * Fee Reminder Job
 * Runs daily at 9 AM — finds overdue fee records and sends
 * reminder notifications to students.
 */
import cron from "node-cron";
import { feeService } from "../services/fee.service";
import { notificationService } from "../services/notification.service";
import { NotificationChannel, NotificationAudience } from "../models";
import type { IFeeRecord } from "../models/fee.model";
import { logger } from "../utils/logger.util";
import { formatIndiaDate } from "../utils/date.util";

export function startFeeReminderJob(): void {
  // Daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    try {
      const overdue = (await feeService.getOverdueFees()) as unknown as IFeeRecord[];
      logger.cron(`fees — Found ${overdue.length} overdue fee record(s)`);

      for (const record of overdue) {
        const studentId = record.studentId?.toString();
        if (!studentId) continue;

        const outstanding = record.balanceDue ?? 0;
        const dueDateStr = record.dueDate ? formatIndiaDate(record.dueDate) : "N/A";

        await notificationService.create({
          title: "Fee Payment Overdue",
          body: `Your fee payment for the current semester is overdue.
Outstanding Amount: ₹${outstanding}
Due Date: ${dueDateStr}
Please clear your dues immediately to avoid late payment charges.`,
          type: "fee_reminder",
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          audience: NotificationAudience.SPECIFIC_USER,
          targetUserIds: [studentId],
          createdBy: "system",
          createdByName: "System",
        });
      }
    } catch (err) {
      logger.error("fee-reminder job failed", err);
    }
  });

  logger.cron("Fee reminder job started (daily 09:00)");
}
