/**
 * Makes legacy curricula fail closed until an administrator classifies them.
 *
 * Programme level is intentionally not inferred from names. Existing curricula
 * without an explicit level are removed from admission choices and can be
 * classified safely from Academic Setup.
 */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const curricula = connection.useDb(databaseName, { useCache: true }).collection("curriculums");
  const result = await curricula.updateMany(
    { academicLevel: { $exists: false } },
    { $set: { openForAdmissions: false } },
  );
  await curricula.createIndex(
    { openForAdmissions: 1, isActive: 1, program: 1 },
    { name: "curriculum_admission_programs" },
  );
  console.info(
    `${databaseName}: ${result.modifiedCount} legacy programme(s) require academic-level review`,
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
    console.error("Dynamic admission programme migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
