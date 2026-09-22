/** Backfills authoritative section references and lifecycle state for legacy assignments. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const VALID_STATUSES = new Set(["draft", "published", "closed", "evaluated"]);

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const assignments = tenantDb.collection("assignments");
  const sections = tenantDb.collection("sections");
  const cursor = assignments.find({});
  let migrated = 0;
  for await (const assignment of cursor) {
    let sectionId = assignment.sectionId;
    if (!sectionId) {
      const matches = await sections
        .find({
          departmentId: assignment.departmentId,
          semesterNo: assignment.semester,
          sectionName: String(assignment.section ?? "").toUpperCase(),
          academicYear: assignment.academicYear,
        })
        .project({ _id: 1 })
        .limit(2)
        .toArray();
      if (matches.length !== 1) {
        throw new Error(
          `${databaseName}: assignment ${String(assignment._id)} has ${matches.length} matching sections`,
        );
      }
      sectionId = matches[0]._id;
    }
    const status = VALID_STATUSES.has(String(assignment.status))
      ? assignment.status
      : assignment.isActive === false
        ? "closed"
        : "published";
    const submissions = Array.isArray(assignment.submissions)
      ? assignment.submissions.map((submission: Record<string, unknown>) => ({
          ...submission,
          rawMarks: submission.rawMarks ?? submission.marks,
          penaltyApplied: submission.penaltyApplied ?? 0,
          gradingHistory: Array.isArray(submission.gradingHistory) ? submission.gradingHistory : [],
        }))
      : [];
    await assignments.updateOne(
      { _id: assignment._id },
      {
        $set: {
          sectionId,
          status,
          isActive: status === "published",
          submissions,
          totalSubmissions: submissions.length,
          ...(status === "published" && !assignment.publishedAt
            ? { publishedAt: assignment.createdAt ?? new Date() }
            : {}),
        },
      },
    );
    migrated += 1;
  }
  console.info(`Migrated ${migrated} assignments in ${databaseName}`);
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
    console.error("Assignment lifecycle migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
