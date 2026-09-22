/**
 * Ensures communication remains available on every subscription plan and
 * repairs existing plan-backed tenants created before that catalogue policy.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { SubscriptionPlanModel } from "../models/platform.model";
import { TenantModel } from "../models/tenant.model";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function main(): Promise<void> {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });

  try {
    const [plans, tenants] = await Promise.all([
      SubscriptionPlanModel.updateMany(
        {},
        { $addToSet: { moduleSlugs: "communication" } },
        { runValidators: true },
      ),
      TenantModel.updateMany(
        { planId: { $exists: true, $ne: null } },
        { $addToSet: { enabledModuleSlugs: "communication" } },
        { runValidators: true },
      ),
    ]);

    console.info(
      `Communication entitlement synchronized: plans=${plans.modifiedCount}, tenants=${tenants.modifiedCount}.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Universal communication entitlement migration failed:", error);
  process.exitCode = 1;
});
