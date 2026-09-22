/**
 * Semester-End Job — SRS §8.2
 * Runs on 1st of May and 1st of November at midnight (typical BPUT semester end dates).
 * Permanently locks all attendance records for the just-ended academic year,
 * and sends notification to DEAN_ACADEMIC.
 */
import cron from "node-cron";
import { attendanceService } from "../services/attendance.service";
import { notificationService } from "../services/notification.service";
import { NotificationChannel, NotificationAudience } from "../models";
import { logger } from "../utils/logger.util";

function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function runSemesterEndLock(): Promise<void> {
  const academicYear = currentAcademicYear();
  logger.cron(`semester-end — Locking attendance for ${academicYear}…`);
  try {
    const result = await attendanceService.lockSemesterAttendance(academicYear);
    logger.cron(
      `semester-end — Locked ${(result as { modifiedCount?: number }).modifiedCount ?? 0} records for ${academicYear}`,
    );
    await notificationService.create({
      title: "Semester-End Attendance Lock",
      body: `All attendance records for academic year ${academicYear} have been permanently locked as per semester-end procedure.`,
      type: "system",
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      audience: NotificationAudience.ADMIN,
      createdBy: "system",
      createdByName: "System",
    });
  } catch (err) {
    logger.error("semester-end lock failed", err);
  }
}

export function startSemesterEndJob(): void {
  // 1st May at 00:01 (end of even semester)
  cron.schedule("1 0 1 5 *", runSemesterEndLock);
  // 1st November at 00:01 (end of odd semester)
  cron.schedule("1 0 1 11 *", runSemesterEndLock);

  logger.cron("Semester-end attendance lock job started (1 May & 1 Nov 00:01)");
}
