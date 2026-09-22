/**
 * Grants the institution roles responsible for meetings their required actions
 * without removing tenant-specific permissions.
 *
 * Run after deploying the meeting RBAC update:
 *   pnpm migrate:meeting-governance
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Module, PermissionAction, type IPermission } from "../constants/permissions";
import { SystemRole } from "../constants/roles";
import { logger } from "../utils/logger.util";

const A = PermissionAction;
const REQUIRED_ACTIONS: Partial<Record<SystemRole, PermissionAction[]>> = {
  [SystemRole.SUPER_ADMIN]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.APPROVE, A.EXPORT],
  [SystemRole.ADMIN]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.APPROVE, A.EXPORT],
  [SystemRole.PRINCIPAL]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.APPROVE, A.EXPORT],
  [SystemRole.DEAN_ACADEMIC]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.APPROVE, A.EXPORT],
  [SystemRole.ADMINISTRATION_OFFICE]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE],
  [SystemRole.HR_DEPARTMENT]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE],
  [SystemRole.HOD]: [A.VIEW, A.CREATE, A.EDIT, A.DELETE],
};

type StoredRole = {
  _id: mongoose.Types.ObjectId;
  name: SystemRole;
  permissions?: IPermission[];
};

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

    for (const [roleName, requiredActions] of Object.entries(REQUIRED_ACTIONS) as [
      SystemRole,
      PermissionAction[],
    ][]) {
      const role = await roles.findOne({ name: roleName });
      if (!role) continue;
      const permissions = (role.permissions ?? []).map((permission) => ({
        module: permission.module,
        actions: [...permission.actions],
      }));
      const meetingPermission = permissions.find(
        (permission) => permission.module === Module.MEETING,
      );
      if (meetingPermission) {
        meetingPermission.actions = [
          ...new Set([...meetingPermission.actions, ...requiredActions]),
        ];
      } else {
        permissions.push({ module: Module.MEETING, actions: [...requiredActions] });
      }
      if (JSON.stringify(permissions) === JSON.stringify(role.permissions ?? [])) continue;

      await roles.updateOne({ _id: role._id }, { $set: { permissions } });
      await tenantDb
        .collection("users")
        .updateMany({ roles: roleName }, { $set: { activeSessions: [] } });
      updatedRoles += 1;
    }
  }

  logger.info(
    `[migrate-meeting-governance] tenants=${tenants.length} updatedRoles=${updatedRoles}`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error("[migrate-meeting-governance] failed", { error });
  process.exit(1);
});
