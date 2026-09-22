import "dotenv/config";
import mongoose from "mongoose";
import { SubscriptionPlanModel } from "../models/platform.model";
import { PLATFORM_PLANS } from "./data/platform-catalog";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });
  const canonicalSlugs = PLATFORM_PLANS.map((plan) => plan.slug);

  await SubscriptionPlanModel.updateMany(
    { slug: { $nin: canonicalSlugs } },
    { $set: { isActive: false, isPopular: false } },
  );
  for (const [sortOrder, plan] of PLATFORM_PLANS.entries()) {
    await SubscriptionPlanModel.updateOne(
      { slug: plan.slug },
      {
        $set: {
          ...plan,
          monthlyAmountInPaise: 0,
          availableBillingPeriods: ["year"],
          currency: "INR",
          isActive: true,
          sortOrder,
        },
      },
      { upsert: true, runValidators: true },
    );
  }
  console.info(`Synchronized ${PLATFORM_PLANS.length} subscription plans.`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
