/**
 * Adds explicit governance metadata to legacy CO-PO attainment records.
 * Legacy calculations are retained as version 1 drafts and are never
 * automatically submitted or approved.
 */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const attainments = tenantDb.collection("copoattainments");

  const legacy = await attainments.updateMany(
    {
      $or: [{ calculationVersion: { $exists: false } }, { status: { $exists: false } }],
    },
    [
      {
        $set: {
          calculationVersion: { $ifNull: ["$calculationVersion", 1] },
          status: { $ifNull: ["$status", "draft"] },
        },
      },
    ],
  );

  await attainments.createIndex(
    { academicYear: 1, subjectId: 1, section: 1 },
    { unique: true, name: "academicYear_1_subjectId_1_section_1" },
  );
  await attainments.createIndex(
    { status: 1, academicYear: 1, program: 1 },
    { name: "attainment_governance_queue" },
  );

  const drafts = await attainments.countDocuments({ status: "draft" });
  const submitted = await attainments.countDocuments({ status: "submitted" });
  const approved = await attainments.countDocuments({ status: "approved" });
  console.info(
    `${databaseName}: governed ${legacy.modifiedCount} legacy attainment record(s); ${drafts} draft, ${submitted} submitted, ${approved} approved`,
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
    console.error("OBE attainment-governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
