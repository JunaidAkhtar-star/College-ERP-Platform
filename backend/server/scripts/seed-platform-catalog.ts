/** Synchronizes public modules and recommended plans without changing administrator accounts. */
import "dotenv/config";
import mongoose from "mongoose";
import {
  ProductAddonModel,
  ProductModuleModel,
  PlatformProductModel,
  SubscriptionPlanModel,
} from "../models/platform.model";
import {
  PLATFORM_ADDONS,
  PLATFORM_MODULES,
  PLATFORM_PLANS,
  PLATFORM_PRODUCTS,
} from "./data/platform-catalog";

const MONGODB_URI = process.env["MONGODB_URI"] ?? "";
const MASTER_DB_NAME = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function main(): Promise<void> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set in env");
  await mongoose.connect(MONGODB_URI, { dbName: MASTER_DB_NAME });
  try {
    await Promise.all([
      PlatformProductModel.updateMany(
        { slug: { $nin: PLATFORM_PRODUCTS.map((product) => product.slug) } },
        { $set: { isPublic: false, status: "retired" } },
      ),
      ProductModuleModel.updateMany(
        { slug: { $nin: PLATFORM_MODULES.map((productModule) => productModule.slug) } },
        { $set: { isPublic: false, status: "maintenance" } },
      ),
      SubscriptionPlanModel.updateMany(
        { slug: { $nin: PLATFORM_PLANS.map((plan) => plan.slug) } },
        { $set: { isActive: false } },
      ),
      ProductAddonModel.updateMany(
        { slug: { $nin: PLATFORM_ADDONS.map((addon) => addon.slug) } },
        { $set: { isActive: false } },
      ),
    ]);
    for (const [sortOrder, product] of PLATFORM_PRODUCTS.entries()) {
      await PlatformProductModel.updateOne(
        { slug: product.slug },
        { $set: { ...product, isPublic: true, sortOrder } },
        { upsert: true, runValidators: true },
      );
    }
    for (const [sortOrder, productModule] of PLATFORM_MODULES.entries()) {
      await ProductModuleModel.updateOne(
        { slug: productModule.slug },
        {
          $set: {
            ...productModule,
            productSlug: "college-erp",
            status: "active",
            sortOrder,
            isPublic: true,
          },
        },
        { upsert: true, runValidators: true },
      );
    }
    for (const [sortOrder, plan] of PLATFORM_PLANS.entries()) {
      await SubscriptionPlanModel.updateOne(
        { slug: plan.slug },
        {
          $set: {
            ...plan,
            productSlug: "college-erp",
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
    for (const [sortOrder, addon] of PLATFORM_ADDONS.entries()) {
      await ProductAddonModel.updateOne(
        { slug: addon.slug },
        {
          $set: {
            ...addon,
            productSlug: "college-erp",
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
    console.info(
      `Synchronized ${PLATFORM_PRODUCTS.length} products, ${PLATFORM_MODULES.length} modules, ${PLATFORM_PLANS.length} plans and ${PLATFORM_ADDONS.length} add-ons.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Platform catalogue synchronization failed:", error);
  process.exitCode = 1;
});
