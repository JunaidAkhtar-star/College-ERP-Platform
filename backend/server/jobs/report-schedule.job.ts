import cron from "node-cron";
import { ReportScheduleModel } from "../models/report-center.model";
import { reportCenterService } from "../services/report-center.service";
import { notifyUsers } from "../services/helpers/notify.helper";
import { jobQueueService, registerJobHandler } from "../services/job-queue.service";
import { logger } from "../utils/logger.util";

type TimeParts = {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
};

function matchesPart(value: number, expression: string, minimum: number, maximum: number): boolean {
  return expression.split(",").some((segment) => {
    const [rangeExpression, stepExpression] = segment.split("/");
    const step = stepExpression ? Number(stepExpression) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    let start = minimum;
    let end = maximum;
    if (rangeExpression !== "*") {
      const bounds = rangeExpression.split("-").map(Number);
      start = bounds[0];
      end = bounds.length === 2 ? bounds[1] : bounds[0];
    }
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < minimum ||
      end > maximum ||
      start > end
    )
      return false;
    return value >= start && value <= end && (value - start) % step === 0;
  });
}

function partsInTimezone(date: Date, timezone: string): TimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  return {
    minute: value("minute"),
    hour: value("hour"),
    dayOfMonth: value("day"),
    month: value("month"),
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday ?? ""),
  };
}

export function matchesReportCron(expression: string, date: Date, timezone: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  let parts: TimeParts;
  try {
    parts = partsInTimezone(date, timezone);
  } catch {
    return false;
  }
  return (
    matchesPart(parts.minute, fields[0], 0, 59) &&
    matchesPart(parts.hour, fields[1], 0, 23) &&
    matchesPart(parts.dayOfMonth, fields[2], 1, 31) &&
    matchesPart(parts.month, fields[3], 1, 12) &&
    matchesPart(parts.dayOfWeek, fields[4], 0, 6)
  );
}

function reportAsOf(mode: "run_time" | "previous_day" | "previous_month_end", now: Date): Date {
  if (mode === "run_time") return now;
  const result = new Date(now);
  result.setUTCHours(23, 59, 59, 999);
  if (mode === "previous_day") result.setUTCDate(result.getUTCDate() - 1);
  else result.setUTCDate(0);
  return result;
}

registerJobHandler("report.schedule.run", {
  async run(payload) {
    const scheduleId = String(payload.scheduleId);
    const scheduledFor = new Date(String(payload.scheduledFor));
    const snapshot = await reportCenterService.snapshot(
      String(payload.reportDefinitionId),
      String(payload.createdBy),
      String(payload.createdByRole),
      payload.departmentId ? String(payload.departmentId) : undefined,
      reportAsOf(
        String(payload.asOfMode) as "run_time" | "previous_day" | "previous_month_end",
        scheduledFor,
      ),
      { id: scheduleId, scheduledFor },
    );
    await ReportScheduleModel.updateOne(
      { _id: scheduleId },
      { $set: { lastSnapshotId: snapshot._id }, $unset: { lastError: 1 } },
    ).exec();
    await notifyUsers(payload.recipientUserIds as string[], {
      title: "Scheduled report is ready",
      body: `Snapshot ${snapshot.snapshotNumber} is ready (${snapshot.rowCount} rows).`,
      actionUrl: "/report-center",
      createdBy: String(payload.createdBy),
    });
  },
  async onDead(payload, error) {
    await ReportScheduleModel.updateOne(
      { _id: String(payload.scheduleId) },
      { $set: { lastError: error } },
    ).exec();
  },
});

export function startReportScheduleJob(): void {
  cron.schedule("* * * * *", async (context) => {
    const scheduledFor = new Date(context.date);
    scheduledFor.setUTCSeconds(0, 0);
    try {
      const schedules = await ReportScheduleModel.find({ status: "active" }).limit(500).lean();
      for (const schedule of schedules) {
        if (!matchesReportCron(schedule.cronExpression, scheduledFor, schedule.timezone)) continue;
        const session = await ReportScheduleModel.db.startSession();
        try {
          await session.withTransaction(async () => {
            const claimed = await ReportScheduleModel.findOneAndUpdate(
              {
                _id: schedule._id,
                status: "active",
                $or: [{ lastRunAt: { $lt: scheduledFor } }, { lastRunAt: { $exists: false } }],
              },
              { $set: { lastRunAt: scheduledFor } },
              { returnDocument: "after", session },
            ).lean();
            if (!claimed) return;
            await jobQueueService.enqueue(
              "report.schedule.run",
              `report-schedule:${schedule._id}:${scheduledFor.toISOString()}`,
              {
                scheduleId: String(schedule._id),
                reportDefinitionId: String(schedule.reportDefinitionId),
                createdBy: String(schedule.createdBy),
                createdByRole: schedule.createdByRole,
                departmentId: schedule.departmentId ? String(schedule.departmentId) : undefined,
                asOfMode: schedule.asOfMode,
                recipientUserIds: schedule.recipientUserIds.map(String),
                scheduledFor: scheduledFor.toISOString(),
              },
              { session },
            );
          });
        } finally {
          await session.endSession();
        }
      }
    } catch (error) {
      logger.error("report schedule dispatcher failed", error);
    }
  });
  logger.cron("Durable report scheduler started (every minute)");
}
