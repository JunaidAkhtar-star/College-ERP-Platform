import cron from "node-cron";
import {
  BookIssueModel,
  FacultyAttendanceModel,
  HostelFeeModel,
  TransportFeeModel,
} from "../models";
import { logger } from "../utils/logger.util";

export function startOperationalStatusJob(): void {
  cron.schedule("5 0 * * *", async () => {
    try {
      const now = new Date();
      const facultyAttendanceLockDate = new Date(now.getTime() - 7 * 86400000);
      facultyAttendanceLockDate.setHours(0, 0, 0, 0);
      const [library, hostel, transport, facultyAttendance] = await Promise.all([
        BookIssueModel.updateMany(
          { status: "issued", dueDate: { $lt: now } },
          { $set: { status: "overdue" } },
        ),
        HostelFeeModel.updateMany(
          { status: { $in: ["unpaid", "partial"] }, dueDate: { $lt: now } },
          { $set: { status: "overdue" } },
        ),
        TransportFeeModel.updateMany(
          { status: { $in: ["unpaid", "partial"] }, dueDate: { $lt: now } },
          { $set: { status: "overdue" } },
        ),
        FacultyAttendanceModel.updateMany(
          { isLocked: false, date: { $lt: facultyAttendanceLockDate } },
          { $set: { isLocked: true } },
        ),
      ]);
      if (
        library.modifiedCount ||
        hostel.modifiedCount ||
        transport.modifiedCount ||
        facultyAttendance.modifiedCount
      ) {
        logger.cron(
          `operational-status — marked ${library.modifiedCount} library loan(s), ${hostel.modifiedCount} hostel fee(s), and ${transport.modifiedCount} transport fee(s) overdue; locked ${facultyAttendance.modifiedCount} faculty attendance record(s)`,
        );
      }
    } catch (error) {
      logger.error("operational-status job failed", error);
    }
  });
  logger.cron("Operational status job started (daily 00:05)");
}
