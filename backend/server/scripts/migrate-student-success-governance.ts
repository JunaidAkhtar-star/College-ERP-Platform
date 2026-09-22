/** Adds idempotent SLA-governance metadata and indexes to student-success cases. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const cases = connection
    .useDb(databaseName, { useCache: true })
    .collection("studentsuccesscases");
  const result = await cases.updateMany(
    { escalationCount: { $exists: false } },
    { $set: { escalationCount: 0 } },
  );
  await cases.createIndex(
    { status: 1, dueAt: 1, escalatedAt: 1 },
    { name: "student_success_sla_queue" },
  );
  console.info(`${databaseName}: governed ${result.modifiedCount} student-success case(s)`);
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
    console.error("Student-success governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
