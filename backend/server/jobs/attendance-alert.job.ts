/**
 * Attendance Alert Job
 * Runs daily at 6 PM — identifies students with attendance < 75%
 * and sends notification alerts to them and their department.
 */
import cron from "node-cron";
import { attendanceService } from "../services/attendance.service";
import { notificationService } from "../services/notification.service";
import { NotificationChannel, NotificationAudience } from "../models";
import type { IStudentAttendanceSummary } from "../models/attendance.model";
import { StudentAttendanceSummaryModel } from "../models/attendance.model";
import { logger } from "../utils/logger.util";

const CURRENT_ACADEMIC_YEAR = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Academic year starts in July
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export function startAttendanceAlertJob(): void {
  // Daily at 6 PM
  cron.schedule("0 18 * * *", async () => {
    try {
      logger.cron("attendance — Running shortage detection…");
      // Check all 8 semesters for current academic year
      const academicYear = CURRENT_ACADEMIC_YEAR();
      for (let sem = 1; sem <= 8; sem++) {
        const shortList = (await attendanceService.getShortageList(
          sem,
          academicYear,
        )) as unknown as IStudentAttendanceSummary[];
        const alertCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const byStudent = new Map<string, IStudentAttendanceSummary[]>();
        for (const record of shortList) {
          if (record.lastShortageAlertAt && record.lastShortageAlertAt >= alertCutoff) continue;
          const studentId = record.studentId?.toString();
          if (!studentId) continue;
          byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), record]);
        }
        for (const [studentId, records] of byStudent) {
          const subjects = records
            .map((record) => record.subjectCode)
            .filter(Boolean)
            .join(", ");
          // Send in-app + email notification to student
          await notificationService.create({
            title: "Attendance Shortage Warning",
            body: `Dear student, your attendance has fallen below 75% in: ${subjects || "one or more subjects"}.
Please contact your HOD immediately to avoid being debarred from examinations.
Academic Year: ${academicYear} | Semester: ${sem}`,
            type: "attendance_alert",
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            audience: NotificationAudience.SPECIFIC_USER,
            targetUserIds: [studentId],
            createdBy: "system",
            createdByName: "System",
          });
          await StudentAttendanceSummaryModel.updateMany(
            { studentId, semester: sem, academicYear, isShortage: true },
            { $set: { lastShortageAlertAt: new Date() } },
          );
        }
        if (byStudent.size > 0) {
          logger.cron(`attendance — Sem ${sem}: ${byStudent.size} shortage alert(s) sent`);
        }
      }

      // Lock attendance records older than 30 days
      await attendanceService.lockOldRecords();
    } catch (err) {
      logger.error("attendance job failed", err);
    }
  });

  logger.cron("Attendance alert job started (daily 18:00)");
}
