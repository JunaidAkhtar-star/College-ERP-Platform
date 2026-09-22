/**
 * Adds the granular Import Center maker-checker baseline to existing shipped
 * roles. Custom roles and extra administrator-granted actions are preserved.
 *
 * Run against the intended tenant database: pnpm migrate:import-center-rbac
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Module, PermissionAction } from "../constants/permissions";
import { SystemRole } from "../constants/roles";
import { RoleModel } from "../models/role.model";
import { logger } from "../utils/logger.util";

const A = PermissionAction;
const roleActions = new Map<SystemRole, PermissionAction[]>([
  [SystemRole.PRINCIPAL, [A.VIEW, A.APPROVE, A.EXPORT]],
  [SystemRole.ADMINISTRATION_OFFICE, [A.VIEW, A.CREATE, A.EDIT, A.EXPORT]],
]);

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);

  let updated = 0;
  for (const [roleName, requiredActions] of roleActions) {
    const role = await RoleModel.findOne({ name: roleName, isSystem: true }).exec();
    if (!role) continue;

    const permission = role.permissions.find((entry) => entry.module === Module.IMPORT_CENTER);
    if (permission) {
      const merged = [...new Set([...permission.actions, ...requiredActions])];
      if (merged.length === permission.actions.length) continue;
      permission.actions = merged;
    } else {
      role.permissions.push({ module: Module.IMPORT_CENTER, actions: requiredActions });
    }
    await role.save();
    updated += 1;
  }

  logger.info(`[migrate-import-center-rbac] updatedRoles=${updated}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error("[migrate-import-center-rbac] failed", { error });
  process.exit(1);
});
