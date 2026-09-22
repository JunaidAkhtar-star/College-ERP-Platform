/**
 * Align existing tenant system-role records with the code-owned RBAC/menu
 * baseline without removing tenant-specific permissions.
 *
 * Run after deploying the RBAC/menu contract fix:
 *   pnpm migrate:rbac-menu-contract
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DEFAULT_PERMISSIONS } from "../constants/role-defaults";
import { SystemRole } from "../constants/roles";
import type { IPermission } from "../constants/permissions";
import { logger } from "../utils/logger.util";

type StoredRole = {
  _id: mongoose.Types.ObjectId;
  name: SystemRole;
  permissions?: IPermission[];
};

function alignedPermissions(role: SystemRole, existing: IPermission[]): IPermission[] {
  const result = existing.map((permission) => ({
    module: permission.module,
    actions: [...permission.actions],
  }));
  const configured = new Set(result.map((permission) => permission.module));
  for (const permission of DEFAULT_PERMISSIONS[role]) {
    if (!configured.has(permission.module)) {
      result.push({ module: permission.module, actions: [...permission.actions] });
    }
  }

  if (role === SystemRole.ADMINISTRATION_OFFICE) {
    for (const baseline of DEFAULT_PERMISSIONS[role]) {
      const permission = result.find((entry) => entry.module === baseline.module);
      if (permission) {
        permission.actions = [...new Set([...permission.actions, ...baseline.actions])];
      }
    }
  }
  return result;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  const master = mongoose.connection.db;
  if (!master) throw new Error("Master database connection is unavailable");
  const tenants = await master
    .collection("tenants")
    .find({})
    .project({ databaseName: 1 })
    .toArray();

  let updatedRoles = 0;
  for (const tenant of tenants) {
    const databaseName = String(tenant.databaseName || "");
    if (!databaseName) continue;
    const tenantDb = mongoose.connection.getClient().db(databaseName);
    const roles = tenantDb.collection<StoredRole>("roles");
    for (const roleName of Object.values(SystemRole)) {
      const role = await roles.findOne({ name: roleName });
      if (!role) continue;
      const permissions = alignedPermissions(roleName, role.permissions ?? []);
      if (JSON.stringify(permissions) === JSON.stringify(role.permissions ?? [])) continue;
      await roles.updateOne({ _id: role._id }, { $set: { permissions } });
      await tenantDb
        .collection("users")
        .updateMany({ roles: roleName }, { $set: { activeSessions: [] } });
      updatedRoles += 1;
    }
  }
  logger.info(
    `[migrate-rbac-menu-contract] tenants=${tenants.length} updatedRoles=${updatedRoles}`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error("[migrate-rbac-menu-contract] failed", { error });
  process.exit(1);
});
