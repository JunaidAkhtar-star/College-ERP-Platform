/** Backfills section ownership, lifecycle state, and attempt timing for legacy quizzes. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const VALID_STATUSES = new Set(["draft", "published", "closed"]);

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const quizzes = tenantDb.collection("quizzes");
  const attempts = tenantDb.collection("quizattempts");
  const sections = tenantDb.collection("sections");
  let migrated = 0;

  for await (const quiz of quizzes.find({})) {
    let sectionId = quiz.sectionId;
    if (!sectionId) {
      const matches = await sections
        .find({
          departmentId: quiz.departmentId,
          program: quiz.program,
          semesterNo: quiz.semester,
          sectionName: String(quiz.section ?? "").toUpperCase(),
          academicYear: quiz.academicYear,
        })
        .project({ _id: 1 })
        .limit(2)
        .toArray();
      if (matches.length !== 1) {
        throw new Error(
          `${databaseName}: quiz ${String(quiz._id)} has ${matches.length} matching sections`,
        );
      }
      sectionId = matches[0]._id;
    }
    const ended = quiz.endDateTime && new Date(quiz.endDateTime).getTime() <= Date.now();
    const status = VALID_STATUSES.has(String(quiz.status))
      ? quiz.status
      : ended
        ? "closed"
        : quiz.isActive
          ? "published"
          : "draft";
    const totalAttempts = await attempts.countDocuments({ quizId: quiz._id });
    await quizzes.updateOne(
      { _id: quiz._id },
      {
        $set: {
          sectionId,
          status,
          isActive:
            status === "published" &&
            (!quiz.startDateTime || new Date(quiz.startDateTime).getTime() <= Date.now()) &&
            (!quiz.endDateTime || new Date(quiz.endDateTime).getTime() > Date.now()),
          totalAttempts,
          ...(status === "published" && !quiz.publishedAt
            ? { publishedAt: quiz.createdAt ?? new Date() }
            : {}),
          ...(status === "closed" && !quiz.closedAt ? { closedAt: new Date() } : {}),
        },
      },
    );
    migrated += 1;
  }

  for await (const attempt of attempts.find({})) {
    const quiz = await quizzes.findOne({ _id: attempt.quizId });
    if (!quiz) throw new Error(`${databaseName}: attempt ${String(attempt._id)} has no quiz`);
    const startedAt = new Date(attempt.startedAt ?? attempt.createdAt ?? new Date());
    const configuredExpiry = new Date(
      startedAt.getTime() + Math.max(1, Number(quiz.durationMinutes ?? 480)) * 60_000,
    );
    const endDate = quiz.endDateTime ? new Date(quiz.endDateTime) : configuredExpiry;
    const expiresAt = new Date(Math.min(configuredExpiry.getTime(), endDate.getTime()));
    const presentation =
      Array.isArray(attempt.presentation) && attempt.presentation.length
        ? attempt.presentation
        : (Array.isArray(quiz.questions) ? quiz.questions : []).map(
            (question: Record<string, unknown>) => ({
              questionId: question._id,
              optionOrder: Array.isArray(question.options)
                ? question.options.map((_: unknown, index: number) => index)
                : [],
            }),
          );
    await attempts.updateOne(
      { _id: attempt._id },
      {
        $set: {
          expiresAt,
          presentation,
          autoSubmitted: Boolean(attempt.autoSubmitted),
        },
      },
    );
  }
  await quizzes.createIndex(
    { sectionId: 1, status: 1, startDateTime: 1, endDateTime: 1 },
    { name: "quiz_section_lifecycle" },
  );
  await attempts.createIndex(
    { quizId: 1, studentId: 1 },
    { unique: true, name: "quiz_student_attempt_unique" },
  );
  console.info(`Migrated ${migrated} quizzes in ${databaseName}`);
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants) {
    const databaseName = String(tenant.databaseName ?? "");
    if (!databaseName) throw new Error(`Tenant ${String(tenant.tenantId)} has no databaseName`);
    await migrateTenant(mongoose.connection, databaseName);
  }
}

main()
  .catch((error) => {
    console.error("Quiz lifecycle migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
