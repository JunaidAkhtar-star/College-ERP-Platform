/**
 * @file seed-master-admin.ts
 * @description Dedicated seed script to create the SaaS global Product Owner / Super Admin
 *              account in the master database. This allows logging into the Operator Portal.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";
import { RoleModel } from "../models/role.model";
import { SystemRole } from "../constants/roles";
import {
  DEFAULT_PERMISSIONS,
  DISPLAY_NAMES,
  mergeMissingDefaultPermissions,
} from "../constants/role-defaults";
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
const ADMIN_EMAIL = process.env["SEED_ADMIN_EMAIL"] ?? "superadmin@devvelocity.com";
const ADMIN_PASS = process.env["SEED_ADMIN_PASS"] ?? "Admin@123";
const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "SaaS Global Administrator";

async function main(): Promise<void> {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set in env");
    process.exit(1);
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  Devvelocity — SEED GLOBAL MASTER SUPER ADMIN");
  console.log("════════════════════════════════════════════════════════════");

  await mongoose.connect(MONGODB_URI, { dbName: MASTER_DB_NAME });
  console.log(`Connected to master database: ${MASTER_DB_NAME}`);

  try {
    const existingMasterRole = await RoleModel.findOne({ name: SystemRole.SUPER_ADMIN });
    const masterRolePermissions = existingMasterRole?.permissions?.length
      ? mergeMissingDefaultPermissions(
          existingMasterRole.permissions,
          DEFAULT_PERMISSIONS[SystemRole.SUPER_ADMIN],
        )
      : DEFAULT_PERMISSIONS[SystemRole.SUPER_ADMIN];
    await RoleModel.updateOne(
      { name: SystemRole.SUPER_ADMIN },
      {
        $set: {
          baseRole: SystemRole.SUPER_ADMIN,
          displayName: DISPLAY_NAMES[SystemRole.SUPER_ADMIN],
          description: "Master platform administrator role",
          permissions: masterRolePermissions,
          isSystem: true,
          isActive: true,
        },
        $setOnInsert: { allowedNavItems: [] },
      },
      { upsert: true, runValidators: true },
    );
    console.log("   + Master super_admin role synchronized");

    const hashed = await bcrypt.hash(ADMIN_PASS, 12);
    const existing = await UserModel.findOne({ email: ADMIN_EMAIL.toLowerCase() });

    if (existing) {
      existing.password = hashed;
      existing.roles = Array.from(new Set([SystemRole.SUPER_ADMIN, ...(existing.roles ?? [])]));
      existing.status = "active";
      existing.isEmailVerified = true;
      await existing.save();
      console.log(`   ~ Master Admin '${ADMIN_EMAIL}' updated successfully!`);
    } else {
      await UserModel.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashed,
        roles: [SystemRole.SUPER_ADMIN],
        isEmailVerified: true,
        status: "active",
      });
      console.log(`   + Master Admin '${ADMIN_EMAIL}' created successfully!`);
    }

    // Keep this all-in-one seed consistent with seed-platform-catalog: records
    // removed from the canonical catalogue must not remain publicly sellable.
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
    console.info(`   + ${PLATFORM_PRODUCTS.length} products synchronized`);

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
    console.info(`   + ${PLATFORM_MODULES.length} product modules synchronized`);

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
    console.info(`   + ${PLATFORM_PLANS.length} subscription plans synchronized`);
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
    console.info(`   + ${PLATFORM_ADDONS.length} product add-ons synchronized`);
  } finally {
    await mongoose.disconnect();
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  Master Admin Seed Complete");
  console.log(`  Login Email: ${ADMIN_EMAIL}`);
  console.log(`  Password:    ${ADMIN_PASS}`);
  console.log("════════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Master admin seeding failed:", err);
  process.exit(1);
});
