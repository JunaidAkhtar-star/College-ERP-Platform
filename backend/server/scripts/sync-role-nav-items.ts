/**
 * @file sync-role-nav-items.ts
 * @description Safe migration that appends missing default NavItem ids to
 * existing system roles without replacing custom role menu choices.
 *
 * Run:
 *   pnpm exec ts-node server/scripts/sync-role-nav-items.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { NavItemModel } from "../models/nav-item.model";
import { RoleModel } from "../models/role.model";
import { ALL_ROLES } from "../constants/roles";
import { logger } from "../utils/logger.util";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(mongoUri);

  let updatedRoles = 0;
  let addedItems = 0;

  for (const roleName of ALL_ROLES) {
    const role = await RoleModel.findOne({ name: roleName }).select("allowedNavItems").exec();
    if (!role) continue;

    const defaults = await NavItemModel.find({
      isActive: true,
      requiredRoles: roleName,
    })
      .select("_id")
      .lean();

    const existing = new Set((role.allowedNavItems ?? []).map((id) => String(id)));
    const missing = defaults.map((item) => item._id).filter((id) => !existing.has(String(id)));

    if (!missing.length) continue;

    await RoleModel.updateOne(
      { _id: role._id },
      { $addToSet: { allowedNavItems: { $each: missing } } },
    );
    updatedRoles += 1;
    addedItems += missing.length;
  }

  logger.info(`[sync-role-nav-items] updatedRoles=${updatedRoles} addedItems=${addedItems}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("[sync-role-nav-items] failed", { err });
  process.exit(1);
});
