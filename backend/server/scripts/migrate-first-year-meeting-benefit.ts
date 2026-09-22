/**
 * @file migrate-first-year-meeting-benefit.ts
 * @description Backfills the first paid subscription date, promotional meeting expiry
 *              and current plan modules for existing paid tenants.
 * @module server/scripts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { SubscriptionPlanModel } from "../models/platform.model";
import { TenantModel } from "../models/tenant.model";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function main(): Promise<void> {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });
  try {
    const tenants = await TenantModel.find({
      planId: { $exists: true },
      billingStatus: "active",
    })
      .select("planId enabledModuleSlugs firstPaidSubscriptionStartedAt")
      .lean();
    let updated = 0;

    for (const tenant of tenants) {
      const [plan, firstPayment] = await Promise.all([
        SubscriptionPlanModel.findById(tenant.planId).select("moduleSlugs").lean(),
        PlatformBillingRecordModel.findOne({
          tenantId: tenant._id,
          purchaseKind: "plan",
          status: "paid",
        })
          .sort({ paidAt: 1, createdAt: 1 })
          .select("paidAt createdAt")
          .lean(),
      ]);
      if (!plan) continue;

      const enabledModuleSlugs = [
        ...new Set([...(tenant.enabledModuleSlugs ?? []), ...plan.moduleSlugs]),
      ];
      const firstPaidAt = firstPayment?.paidAt ?? firstPayment?.createdAt;
      const firstPaidSubscriptionStartedAt = tenant.firstPaidSubscriptionStartedAt ?? firstPaidAt;
      const unlimitedMeetingsUntil = firstPaidSubscriptionStartedAt
        ? new Date(
            new Date(firstPaidSubscriptionStartedAt).setFullYear(
              new Date(firstPaidSubscriptionStartedAt).getFullYear() + 1,
            ),
          )
        : undefined;

      await TenantModel.updateOne(
        { _id: tenant._id },
        {
          $set: {
            enabledModuleSlugs,
            ...(firstPaidSubscriptionStartedAt
              ? { firstPaidSubscriptionStartedAt, unlimitedMeetingsUntil }
              : {}),
          },
        },
      );
      updated += 1;
    }

    console.info(`Backfilled subscription entitlements for ${updated} active paid tenant(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("First-year meeting benefit migration failed:", error);
  process.exitCode = 1;
});
