import mongoose from "mongoose";
import { configs } from "../configs";
import { ProductAddonModel, SubscriptionPlanModel } from "../models/platform.model";

async function run(): Promise<void> {
  await mongoose.connect(configs.MONGODB_URI, { dbName: configs.MASTER_DB_NAME });
  const [plans, addons] = await Promise.all([
    SubscriptionPlanModel.find(),
    ProductAddonModel.find(),
  ]);

  for (const plan of plans) {
    plan.availableBillingPeriods = plan.planType === "free" ? ["year"] : ["month", "year"];
    if (plan.planType === "paid" && !plan.monthlyAmountInPaise) {
      plan.monthlyAmountInPaise = Math.ceil(plan.amountInPaise / 12 / 100) * 100;
    }
    await plan.save();
  }

  for (const addon of addons) {
    addon.availableBillingPeriods =
      addon.billingPeriod === "one_time" ? ["one_time"] : ["month", "year"];
    if (addon.billingPeriod !== "one_time" && !addon.monthlyAmountInPaise) {
      addon.monthlyAmountInPaise = Math.ceil(addon.amountInPaise / 12 / 100) * 100;
    }
    await addon.save();
  }

  console.log(`Monthly billing enabled for ${plans.length} plans and ${addons.length} add-ons.`);
  await mongoose.connection.close(false);
  process.exit(0);
}

void run().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Monthly billing migration failed.");
  await mongoose.disconnect();
  process.exit(1);
});
