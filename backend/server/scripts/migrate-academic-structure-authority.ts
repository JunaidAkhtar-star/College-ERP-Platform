/** Splits the legacy academic-structure permission into governed batch, section, and allotment authority. */
import "dotenv/config";
import mongoose from "mongoose";
import { DEFAULT_PERMISSIONS } from "../constants/role-defaults";
import { Module, type IPermission } from "../constants/permissions";
import { SystemRole } from "../constants/roles";

const governedModules = new Set<string>([
  Module.BATCH_MANAGEMENT,
  Module.SECTION_MANAGEMENT,
  Module.STUDENT_ALLOTMENT,
]);

function migratedPermissions(roleName: string, existing: IPermission[]): IPermission[] {
  const retained = existing.filter(
    (permission) =>
      permission.module !== Module.ACADEMIC_STRUCTURE && !governedModules.has(permission.module),
  );
  if (Object.values(SystemRole).includes(roleName as SystemRole)) {
    const defaults = DEFAULT_PERMISSIONS[roleName as SystemRole].filter((permission) =>
      governedModules.has(permission.module),
    );
    return [
      ...retained,
      ...defaults.map((permission) => ({ ...permission, actions: [...permission.actions] })),
    ];
  }

  const legacy = existing.find((permission) => permission.module === Module.ACADEMIC_STRUCTURE);
  if (!legacy)
    return [
      ...retained,
      ...existing.filter((permission) => governedModules.has(permission.module)),
    ];
  return [
    ...retained,
    ...Array.from(governedModules, (module) => ({ module, actions: [...legacy.actions] })),
  ];
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  let updated = 0;
  for (const tenant of tenants) {
    const databaseName = String(tenant.databaseName || "");
    if (!databaseName) continue;
    const roles = mongoose.connection.getClient().db(databaseName).collection("roles");
    for await (const role of roles.find({})) {
      const permissions = migratedPermissions(
        String(role.name),
        (role.permissions ?? []) as IPermission[],
      );
      await roles.updateOne({ _id: role._id }, { $set: { permissions } });
      updated += 1;
    }
  }
  console.info(`Migrated academic-structure authority for ${updated} tenant roles.`);
}

main()
  .catch((error) => {
    console.error("Academic-structure authority migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
