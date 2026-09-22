/** Backfills parent audit fields and authoritative section-allotment counters for every tenant. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const departments = tenantDb.collection("departments");
  const curricula = tenantDb.collection("curriculums");
  const calendars = tenantDb.collection("academiccalendars");
  const sections = tenantDb.collection("sections");
  const allotments = tenantDb.collection("studentsectionallotments");

  for (const collection of [departments, curricula, calendars, sections, allotments])
    await collection.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });

  const activeCounts = await allotments
    .aggregate<{
      _id: mongoose.Types.ObjectId;
      count: number;
    }>([
      { $match: { status: "Active", isDeleted: { $ne: true } } },
      { $group: { _id: "$sectionId", count: { $sum: 1 } } },
    ])
    .toArray();
  const countBySection = new Map(activeCounts.map((item) => [String(item._id), item.count]));
  let migratedSections = 0;
  for await (const section of sections.find({})) {
    const allottedCount = countBySection.get(String(section._id)) ?? 0;
    if (allottedCount > Number(section.capacity ?? 0))
      throw new Error(
        `${databaseName}: section ${String(section._id)} has ${allottedCount} active students for capacity ${String(section.capacity)}`,
      );
    await sections.updateOne({ _id: section._id }, { $set: { allottedCount } });
    migratedSections += 1;
  }

  const duplicateCurricula = await curricula
    .aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { program: "$program", regulationYear: "$regulationYear" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ])
    .toArray();
  if (duplicateCurricula.length)
    throw new Error(`${databaseName}: duplicate program/regulation curricula require review`);

  await curricula.createIndex(
    { program: 1, regulationYear: 1 },
    { unique: true, name: "curriculum_program_regulation_unique" },
  );
  await sections.createIndex({ departmentId: 1, academicYear: 1, semesterNo: 1 });
  await allotments.createIndex({ sectionId: 1, status: 1 });
  console.info(`Migrated ${migratedSections} academic sections in ${databaseName}`);
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
    console.error("Academic structure governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
