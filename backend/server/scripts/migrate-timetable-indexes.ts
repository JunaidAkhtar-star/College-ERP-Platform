/**
 * Replaces legacy all-history timetable uniqueness with active-only uniqueness
 * in every tenant database. Aborts a tenant before index changes when duplicate
 * active schedules exist, so data must be reviewed instead of silently removed.
 */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  if (!tenantDb.db) throw new Error(`Database connection unavailable for ${databaseName}`);
  if (!(await tenantDb.db.listCollections({ name: "timetables" }).hasNext())) {
    await tenantDb.createCollection("timetables");
  }
  const timetables = tenantDb.collection("timetables");
  const duplicate = await timetables
    .aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            sectionId: "$sectionId",
            academicYear: "$academicYear",
            semesterType: "$semesterType",
            departmentId: "$departmentId",
            semester: "$semester",
            section: "$section",
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .next();
  if (duplicate) throw new Error(`${databaseName} has duplicate active section timetables`);

  const existingIndexes = await timetables.indexes();
  const legacyNames = new Set([
    "academicYear_1_semesterType_1_departmentId_1_semester_1_section_1",
    "sectionId_1_semesterType_1",
  ]);
  for (const index of existingIndexes) {
    if (legacyNames.has(index.name ?? "")) await timetables.dropIndex(index.name!);
  }
  await timetables.createIndex(
    { academicYear: 1, semesterType: 1, departmentId: 1, semester: 1, section: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: "uniq_active_class_timetable",
    },
  );
  await timetables.createIndex(
    { sectionId: 1, semesterType: 1 },
    {
      unique: true,
      partialFilterExpression: { sectionId: { $exists: true }, isActive: true },
      name: "uniq_active_section_timetable",
    },
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
    console.info(`Migrated timetable indexes for ${databaseName}`);
  }
}

main()
  .catch((error) => {
    console.error("Timetable index migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
