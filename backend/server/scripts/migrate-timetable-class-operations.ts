/** Backfills governed substitute status and creates operational-class indexes in every tenant. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const timetables = tenantDb.collection("timetables");
  await timetables.updateMany(
    { "substituteLog.status": { $exists: false } },
    { $set: { "substituteLog.$[entry].status": "active" } },
    { arrayFilters: [{ "entry.status": { $exists: false } }] },
  );

  const operations = tenantDb.collection("classoperations");
  await operations.createIndex({ timetableId: 1, date: 1, status: 1 });
  await operations.createIndex({ facultyId: 1, date: 1, status: 1 });
  await operations.createIndex({ roomNo: 1, date: 1, status: 1 });
  await operations.createIndex({ branchDepartmentIds: 1, date: 1, status: 1 });
  console.info(`Migrated timetable class operations for ${databaseName}`);
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
    console.error("Timetable class-operation migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
