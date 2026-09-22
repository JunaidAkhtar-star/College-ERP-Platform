import cron from "node-cron";
import type { IQuiz } from "../models/quiz.model";
import { QuizModel, QuizStatus } from "../models/quiz.model";
import type { IAssignment } from "../models/assignment.model";
import { AssignmentModel } from "../models/assignment.model";
import { notificationService } from "../services/notification.service";
import { logger } from "../utils/logger.util";

// ── Quiz auto-open / auto-close ───────────────────────────────────────────────
// Runs every minute.
// • A quiz with startDateTime <= now and isActive===false  → set isActive = true
// • A quiz with endDateTime   <= now and isActive===true   → set isActive = false
async function processQuizSchedules(): Promise<void> {
  const now = new Date();

  // Auto-open: scheduled quizzes whose window has started but are still inactive
  const toOpen = (await QuizModel.find({
    status: QuizStatus.PUBLISHED,
    isActive: false,
    startDateTime: { $lte: now },
    $or: [{ endDateTime: { $gt: now } }, { endDateTime: { $exists: false } }],
  }).select(
    "_id title facultyId subjectCode semester section program academicYear",
  )) as unknown as IQuiz[];

  if (toOpen.length > 0) {
    const ids = toOpen.map((q) => q._id);
    await QuizModel.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
    logger.cron(
      `quiz — Auto-opened ${toOpen.length} quiz(es): ${toOpen.map((q) => q.title).join(", ")}`,
    );

    // Notify students via notification service
    for (const quiz of toOpen) {
      try {
        await notificationService.create({
          title: "Quiz Started",
          message: `Quiz "${quiz.title}" (${quiz.subjectCode}) is now live. Open your portal to attempt it.`,
          type: "academic",
          audience: "section",
          targetProgram: quiz.program,
          targetSemester: quiz.semester,
          targetSection: quiz.section,
          academicYear: quiz.academicYear,
          isScheduled: false,
          createdBy: quiz.facultyId,
        } as unknown as Parameters<typeof notificationService.create>[0]);
      } catch {
        // non-critical — continue
      }
    }
  }

  // Auto-close: quizzes whose window has ended but are still active
  const toClose = await QuizModel.find({
    status: QuizStatus.PUBLISHED,
    endDateTime: { $lte: now },
  }).select("_id title");

  if (toClose.length > 0) {
    await QuizModel.updateMany(
      { _id: { $in: toClose.map((q) => q._id) } },
      { $set: { status: QuizStatus.CLOSED, isActive: false, closedAt: now } },
    );
    logger.cron(
      `quiz — Auto-closed ${toClose.length} quiz(es): ${toClose.map((q) => q.title).join(", ")}`,
    );
  }
}

// ── Assignment deadline reminders ─────────────────────────────────────────────
// Runs daily at 8:00 AM.
// Sends a notification for every assignment whose dueDate is within the next 24 hours.
async function sendAssignmentDeadlineReminders(): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = (await AssignmentModel.find({
    isActive: true,
    dueDate: { $gte: now, $lte: in24h },
  }).select(
    "_id title subjectCode dueDate program semester section academicYear facultyId",
  )) as unknown as IAssignment[];

  logger.cron(`assignment — ${upcoming.length} assignment(s) due within 24h`);

  for (const assignment of upcoming) {
    try {
      const formatted = assignment.dueDate.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      await notificationService.create({
        title: "Assignment Due Soon",
        message: `Assignment "${assignment.title}" (${assignment.subjectCode}) is due on ${formatted}. Submit before the deadline.`,
        type: "academic",
        audience: "section",
        targetProgram: assignment.program,
        targetSemester: assignment.semester,
        targetSection: assignment.section,
        academicYear: assignment.academicYear,
        isScheduled: false,
        createdBy: assignment.facultyId,
      } as unknown as Parameters<typeof notificationService.create>[0]);
    } catch {
      // non-critical
    }
  }
}

// ── Job registration ─────────────────────────────────────────────────────────

export function startQuizAssignmentJob(): void {
  // Every minute — auto-open/close quizzes
  cron.schedule("* * * * *", async () => {
    try {
      await processQuizSchedules();
    } catch (err) {
      logger.error("quiz scheduler failed", err);
    }
  });
  logger.cron("Quiz scheduler started (every 1 min)");

  // Daily at 8:00 AM — assignment deadline reminders
  cron.schedule("0 8 * * *", async () => {
    try {
      await sendAssignmentDeadlineReminders();
    } catch (err) {
      logger.error("assignment deadline reminder failed", err);
    }
  });
  logger.cron("Assignment deadline reminder started (daily 08:00)");
}
