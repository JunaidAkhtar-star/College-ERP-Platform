/**
 * Safe system-role policy migration. Dry-run by default; writes require an
 * explicit tenant scope and the hash produced by an identical dry run.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";
import { DEFAULT_PERMISSIONS } from "../constants/role-defaults";
import { SystemRole } from "../constants/roles";

const MIGRATION = "enterprise-role-separation-v1";
const GOVERNED_ROLES = [
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ADMISSION_COUNSELOR,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.IQAC_TEAM,
  SystemRole.IQAC_NAAC,
  SystemRole.SCHOLARSHIP_CELL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.HR_DEPARTMENT,
  SystemRole.STUDENT,
  SystemRole.PARENT,
  SystemRole.FACULTY,
] as const;

type Permission = { module: string; actions: string[] };
type PlannedChange = {
  tenantId: string;
  databaseName: string;
  roleId: mongoose.Types.ObjectId;
  roleName: SystemRole;
  before: Permission[];
  after: Permission[];
};

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || "true"];
  }),
);
const apply = args.has("--apply");
const interactive = args.has("--interactive");
const allTenants = args.has("--all");
let tenantSelector = args.get("--tenant");
let approvedPlan = args.get("--approve-plan");
const rollbackRunId = args.get("--rollback");

function canonicalPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const permission = entry as Partial<Permission>;
      return {
        module: String(permission.module ?? ""),
        actions: Array.isArray(permission.actions) ? permission.actions.map(String).sort() : [],
      };
    })
    .sort((left, right) => left.module.localeCompare(right.module));
}

function planHash(changes: PlannedChange[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        changes.map(({ tenantId, databaseName, roleName, before, after }) => ({
          tenantId,
          databaseName,
          roleName,
          before,
          after,
        })),
      ),
    )
    .digest("hex");
}

function assertSafeArguments() {
  if (interactive && (apply || allTenants || tenantSelector || rollbackRunId)) {
    throw new Error("--interactive must be used alone");
  }
  if (interactive && (!stdin.isTTY || !stdout.isTTY)) {
    throw new Error("--interactive requires an attached terminal");
  }
  if (tenantSelector && allTenants) throw new Error("Choose either --tenant or --all, not both");
  if ((apply || rollbackRunId) && !tenantSelector && !allTenants) {
    throw new Error("Writes require an explicit --tenant=<id|database> or --all scope");
  }
  if (apply && rollbackRunId) throw new Error("Choose either --apply or --rollback");
}

async function chooseTenantInteractively() {
  const master = mongoose.connection.db;
  if (!master) throw new Error("Master database connection unavailable");
  const tenants = await master
    .collection("tenants")
    .find({})
    .project({ name: 1, tenantId: 1, databaseName: 1, status: 1 })
    .sort({ name: 1, tenantId: 1 })
    .toArray();
  if (!tenants.length) throw new Error("No tenants found");

  console.info("Available tenants:");
  tenants.forEach((tenant, index) => {
    console.info(
      `${index + 1}. ${String(tenant.name || tenant.tenantId)} ` +
        `[${String(tenant.tenantId)}] (${String(tenant.status || "unknown")})`,
    );
  });

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await prompt.question("Select one tenant number (or q to cancel): ")).trim();
    if (answer.toLowerCase() === "q") throw new Error("Migration cancelled");
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= tenants.length) {
      throw new Error("Invalid tenant selection");
    }
    tenantSelector = String(tenants[index]!.tenantId);
    console.info(`Selected tenant: ${String(tenants[index]!.name || tenantSelector)}`);
  } finally {
    prompt.close();
  }
}

async function confirmInteractiveApply(hash: string, changes: PlannedChange[]) {
  if (!tenantSelector) throw new Error("Interactive tenant selection is missing");
  if (!changes.length) return false;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const phrase = `APPLY ${tenantSelector}`;
    console.info("The roles listed above will be backed up before modification.");
    const answer = (
      await prompt.question(`Type '${phrase}' to apply, or press Enter to cancel: `)
    ).trim();
    if (answer !== phrase) {
      console.info("Migration cancelled; no data was changed.");
      return false;
    }
    approvedPlan = hash;
    return true;
  } finally {
    prompt.close();
  }
}

async function selectedTenants() {
  const master = mongoose.connection.db;
  if (!master) throw new Error("Master database connection unavailable");
  const filter = tenantSelector
    ? { $or: [{ tenantId: tenantSelector }, { databaseName: tenantSelector }] }
    : {};
  const tenants = await master
    .collection("tenants")
    .find(filter)
    .project({ tenantId: 1, databaseName: 1 })
    .sort({ tenantId: 1 })
    .toArray();
  if (!tenants.length) throw new Error("No matching tenants found");
  return tenants;
}

async function buildPlan(): Promise<PlannedChange[]> {
  const changes: PlannedChange[] = [];
  for (const tenant of await selectedTenants()) {
    const tenantId = String(tenant.tenantId || "");
    const databaseName = String(tenant.databaseName || "");
    if (!tenantId || !databaseName) continue;
    const roles = mongoose.connection.getClient().db(databaseName).collection("roles");
    for (const roleName of GOVERNED_ROLES) {
      const role = await roles.findOne({ name: roleName, isSystem: { $ne: false } });
      if (!role) continue;
      const before = canonicalPermissions(role.permissions);
      const after = canonicalPermissions(DEFAULT_PERMISSIONS[roleName]);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      changes.push({ tenantId, databaseName, roleId: role._id, roleName, before, after });
    }
  }
  return changes;
}

async function applyPlan(changes: PlannedChange[], hash: string) {
  if (approvedPlan !== hash) {
    throw new Error(`Plan approval missing or stale. Pass --approve-plan=${hash}`);
  }
  const runId = randomUUID();
  console.info(`Starting migration. RUN_ID=${runId}`);
  for (const change of changes) {
    const database = mongoose.connection.getClient().db(change.databaseName);
    const roles = database.collection("roles");
    const current = await roles.findOne({ _id: change.roleId });
    if (
      JSON.stringify(canonicalPermissions(current?.permissions)) !== JSON.stringify(change.before)
    ) {
      throw new Error(`Policy drift detected for ${change.tenantId}:${change.roleName}; aborting`);
    }
    await database.collection("migrationbackups").insertOne({
      migration: MIGRATION,
      runId,
      tenantId: change.tenantId,
      roleId: change.roleId,
      roleName: change.roleName,
      permissions: change.before,
      createdAt: new Date(),
    });
    await roles.updateOne(
      { _id: change.roleId },
      { $set: { permissions: change.after, updatedAt: new Date() } },
    );
  }

  for (const tenant of await selectedTenants()) {
    const databaseName = String(tenant.databaseName || "");
    const changedRoles = changes
      .filter((change) => change.databaseName === databaseName)
      .map((change) => change.roleName);
    if (changedRoles.length) {
      await mongoose.connection
        .getClient()
        .db(databaseName)
        .collection("users")
        .updateMany({ roles: { $in: changedRoles } }, { $set: { activeSessions: [] } });
    }
  }
  console.info(`Applied ${changes.length} role policies. RUN_ID=${runId}`);
}

async function rollback(runId: string) {
  let restored = 0;
  for (const tenant of await selectedTenants()) {
    const databaseName = String(tenant.databaseName || "");
    if (!databaseName) continue;
    const database = mongoose.connection.getClient().db(databaseName);
    const backups = await database
      .collection("migrationbackups")
      .find({ migration: MIGRATION, runId })
      .toArray();
    for (const backup of backups) {
      await database
        .collection("roles")
        .updateOne(
          { _id: backup.roleId },
          { $set: { permissions: backup.permissions, updatedAt: new Date() } },
        );
    }
    if (backups.length) {
      await database
        .collection("users")
        .updateMany(
          { roles: { $in: backups.map((backup) => backup.roleName) } },
          { $set: { activeSessions: [] } },
        );
      restored += backups.length;
    }
  }
  if (!restored) throw new Error(`No backups found for RUN_ID=${runId} in the selected scope`);
  console.info(`Restored ${restored} role policies from RUN_ID=${runId}.`);
}

async function main() {
  assertSafeArguments();
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  if (interactive) await chooseTenantInteractively();
  if (rollbackRunId) return rollback(rollbackRunId);

  const changes = await buildPlan();
  const hash = planHash(changes);
  console.info(
    `Scope: ${new Set(changes.map((change) => change.tenantId)).size} tenants; changes: ${changes.length} roles`,
  );
  for (const change of changes) console.info(`${change.tenantId}:${change.roleName}`);
  console.info(`PLAN_HASH=${hash}`);
  if (interactive) {
    if (await confirmInteractiveApply(hash, changes)) await applyPlan(changes, hash);
    return;
  }
  if (!apply) {
    console.info("Dry-run only. Review the scope, then apply with the displayed plan hash.");
    return;
  }
  await applyPlan(changes, hash);
}

main()
  .catch((error) => {
    console.error("Enterprise role separation migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
