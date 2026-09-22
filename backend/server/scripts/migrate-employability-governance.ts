/** Backfills governed job-posting and training-session lifecycle fields for every tenant. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

function sessionDateTime(date: Date, time: unknown) {
  const result = new Date(date);
  const match = /^(\d{2}):(\d{2})$/.exec(String(time ?? ""));
  result.setHours(Number(match?.[1] ?? 0), Number(match?.[2] ?? 0), 0, 0);
  return result;
}

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const jobs = tenantDb.collection("jobpostings");
  const sessions = tenantDb.collection("trainingsessions");
  const now = new Date();

  await jobs.updateMany({}, [
    {
      $set: {
        status: {
          $cond: [
            {
              $and: [{ $eq: ["$status", "active"] }, { $lt: ["$applicationDeadline", now] }],
            },
            "expired",
            { $ifNull: ["$status", "draft"] },
          ],
        },
        publishedAt: {
          $cond: [
            { $in: ["$status", ["active", "closed", "expired"]] },
            { $ifNull: ["$publishedAt", { $ifNull: ["$postedAt", "$createdAt"] }] },
            "$publishedAt",
          ],
        },
        jobType: { $cond: [{ $eq: ["$jobType", "Remote"] }, "Full Time", "$jobType"] },
        applyMode: {
          $cond: [
            { $in: ["$applyMode", ["internal", "external"]] },
            "$applyMode",
            {
              $cond: [
                { $ne: [{ $ifNull: ["$externalApplyLink", ""] }, ""] },
                "external",
                "internal",
              ],
            },
          ],
        },
        isRemote: { $cond: [{ $eq: ["$jobType", "Remote"] }, true, "$isRemote"] },
        interestedStudents: { $setUnion: [{ $ifNull: ["$interestedStudents", []] }, []] },
        appliedStudents: { $setUnion: [{ $ifNull: ["$appliedStudents", []] }, []] },
      },
    },
  ]);

  let migratedSessions = 0;
  for await (const session of sessions.find({})) {
    const scheduledDate = new Date(session.scheduledDate ?? session.createdAt ?? now);
    const startsAt = sessionDateTime(scheduledDate, session.startTime);
    const registrationStartCandidate = new Date(
      session.registrationStart ?? session.createdAt ?? startsAt.getTime() - 30 * 86_400_000,
    );
    const registrationStart =
      registrationStartCandidate < new Date(startsAt.getTime() - 60_000)
        ? registrationStartCandidate
        : new Date(startsAt.getTime() - 30 * 86_400_000);
    const registrationEndCandidate = new Date(
      session.registrationEnd ?? startsAt.getTime() - 60_000,
    );
    const registrationEnd =
      registrationEndCandidate > registrationStart && registrationEndCandidate <= startsAt
        ? registrationEndCandidate
        : new Date(startsAt.getTime() - 60_000);
    const startMatch = /^(\d{2}):(\d{2})$/.exec(String(session.startTime ?? ""));
    const endMatch = /^(\d{2}):(\d{2})$/.exec(String(session.endTime ?? ""));
    const derivedDuration =
      startMatch && endMatch
        ? Number(endMatch[1]) * 60 +
          Number(endMatch[2]) -
          (Number(startMatch[1]) * 60 + Number(startMatch[2]))
        : 0;
    await sessions.updateOne(
      { _id: session._id },
      {
        $set: {
          registrationStart,
          registrationEnd,
          duration: derivedDuration >= 15 ? derivedDuration : Math.max(15, session.duration ?? 15),
          attendanceVerified: session.attendanceVerified ?? false,
          registeredStudents: [
            ...new Map(
              (Array.isArray(session.registeredStudents) ? session.registeredStudents : []).map(
                (studentId: mongoose.Types.ObjectId) => [String(studentId), studentId],
              ),
            ).values(),
          ],
        },
      },
    );
    migratedSessions += 1;
  }

  await jobs.createIndex({ status: 1, applicationDeadline: -1 });
  await sessions.createIndex({ status: 1, registrationStart: 1, registrationEnd: 1 });
  await sessions.createIndex({ attendanceVerified: 1, scheduledDate: -1 });
  console.info(
    `Migrated employability governance in ${databaseName}: ${migratedSessions} training sessions`,
  );
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
    console.error("Employability governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
