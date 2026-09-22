/**
 * Applies only the regulatory_integration permission entry for governed system
 * roles. Dry-run by default. Writes require an explicit tenant scope and the
 * plan hash printed by an identical dry run.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { DEFAULT_PERMISSIONS } from "../constants/role-defaults";
import { Module, type IPermission } from "../constants/permissions";
import { SystemRole } from "../constants/roles";

const MIGRATION = "regulatory-role-matrix-v1";
const GOVERNED_ROLES = [
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.EXAMINATION_CELL,
  SystemRole.IQAC_TEAM,
  SystemRole.IQAC_NAAC,
  SystemRole.ADMINISTRATION_OFFICE,
] as const;

interface IPlannedChange {
  tenantId: string;
  databaseName: string;
  roleId: mongoose.Types.ObjectId;
  roleName: SystemRole;
  before?: IPermission;
  after: IPermission;
}

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || "true"];
  }),
);
const apply = args.has("--apply");
const allTenants = args.has("--all");
const tenantSelector = args.get("--tenant");
const approvedPlan = args.get("--approve-plan");

function canonical(permission?: IPermission) {
  if (!permission) return undefined;
  return { module: permission.module, actions: [...permission.actions].sort() };
}

function assertArguments() {
  if (tenantSelector && allTenants) throw new Error("Choose either --tenant or --all");
  if (apply && !tenantSelector && !allTenants) {
    throw new Error("Writes require --tenant=<id|database> or --all");
  }
}

async function selectedTenants() {
  const database = mongoose.connection.db;
  if (!database) throw new Error("Master database connection unavailable");
  const filter = tenantSelector
    ? { $or: [{ tenantId: tenantSelector }, { databaseName: tenantSelector }] }
    : {};
  return database
    .collection("tenants")
    .find(filter)
    .project({ tenantId: 1, databaseName: 1 })
    .sort({ tenantId: 1 })
    .toArray();
}

async function buildPlan(): Promise<IPlannedChange[]> {
  const changes: IPlannedChange[] = [];
  for (const tenant of await selectedTenants()) {
    const tenantId = String(tenant.tenantId ?? "");
    const databaseName = String(tenant.databaseName ?? "");
    if (!tenantId || !databaseName) continue;
    const roles = mongoose.connection.getClient().db(databaseName).collection("roles");
    for (const roleName of GOVERNED_ROLES) {
      const role = await roles.findOne({ name: roleName, isSystem: { $ne: false } });
      if (!role) continue;
      const permissions = Array.isArray(role.permissions)
        ? (role.permissions as IPermission[])
        : [];
      const before = permissions.find(({ module }) => module === Module.REGULATORY_INTEGRATION);
      const after = DEFAULT_PERMISSIONS[roleName].find(
        ({ module }) => module === Module.REGULATORY_INTEGRATION,
      );
      if (!after || JSON.stringify(canonical(before)) === JSON.stringify(canonical(after)))
        continue;
      changes.push({ tenantId, databaseName, roleId: role._id, roleName, before, after });
    }
  }
  return changes;
}

function hashPlan(changes: IPlannedChange[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        changes.map(({ tenantId, databaseName, roleName, before, after }) => ({
          tenantId,
          databaseName,
          roleName,
          before: canonical(before),
          after: canonical(after),
        })),
      ),
    )
    .digest("hex");
}

async function run() {
  assertArguments();
  await mongoose.connect(process.env.MONGODB_URI ?? "", {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  const changes = await buildPlan();
  const planHash = hashPlan(changes);
  console.table(
    changes.map(({ tenantId, roleName, before, after }) => ({
      tenantId,
      roleName,
      before: canonical(before)?.actions.join(",") ?? "none",
      after: canonical(after)?.actions.join(","),
    })),
  );
  console.info(`PLAN_HASH=${planHash}`);
  if (!apply) {
    console.info("Dry run only. Re-run with --apply and --approve-plan=<PLAN_HASH>.");
    return;
  }
  if (approvedPlan !== planHash) throw new Error("Plan approval missing or stale");

  const runId = randomUUID();
  for (const change of changes) {
    const database = mongoose.connection.getClient().db(change.databaseName);
    const roles = database.collection("roles");
    const current = await roles.findOne({ _id: change.roleId });
    const permissions = Array.isArray(current?.permissions)
      ? (current.permissions as IPermission[])
      : [];
    const currentEntry = permissions.find(({ module }) => module === Module.REGULATORY_INTEGRATION);
    if (JSON.stringify(canonical(currentEntry)) !== JSON.stringify(canonical(change.before))) {
      throw new Error(`Policy drift for ${change.tenantId}:${change.roleName}`);
    }
    await database.collection("migrationbackups").insertOne({
      migration: MIGRATION,
      runId,
      tenantId: change.tenantId,
      roleId: change.roleId,
      roleName: change.roleName,
      permission: change.before,
      createdAt: new Date(),
    });
    const withoutRegulatory = permissions.filter(
      ({ module }) => module !== Module.REGULATORY_INTEGRATION,
    );
    await roles.updateOne(
      { _id: change.roleId },
      { $set: { permissions: [...withoutRegulatory, change.after], updatedAt: new Date() } },
    );
    await database
      .collection("users")
      .updateMany({ roles: change.roleName }, { $set: { activeSessions: [] } });
  }
  console.info(`Applied ${changes.length} regulatory role updates. RUN_ID=${runId}`);
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
