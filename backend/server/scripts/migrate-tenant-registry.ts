/**
 * One-time registry migration for the shared-cluster tenant architecture.
 * Generates safe database names and removes legacy per-tenant connection URIs.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { normalizeTenantId, tenantDatabaseName } from "../configs/connectionManager";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function main(): Promise<void> {
  if (!mongoUri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });

  const tenants = mongoose.connection.collection("tenants");
  const records = await tenants.find({}).project({ tenantId: 1 }).toArray();
  const claimed = new Set<string>();

  for (const record of records) {
    const tenantId = normalizeTenantId(String(record.tenantId ?? ""));
    const databaseName = tenantDatabaseName(tenantId);
    if (claimed.has(databaseName)) {
      throw new Error(`Duplicate tenant database mapping detected: ${databaseName}`);
    }
    claimed.add(databaseName);
    await tenants.updateOne(
      { _id: record._id },
      {
        $set: { tenantId, databaseName },
        $unset: { databaseUri: "" },
      },
    );
  }

  console.info(`Migrated ${records.length} tenant registry record(s).`);
}

main()
  .catch((error) => {
    console.error("Tenant registry migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
