/**
 * @file migrate-curriculum-view-permission.ts
 * @description Adds `curriculum:view` permission to HOD and FACULTY system roles
 *   across all tenant databases. Required so HOD and Faculty can open the
 *   Assessment Policy page (which loads /api/v1/curriculum as reference data).
 *
 * Safety model (same as migrate-enterprise-role-separation):
 *   1. Dry-run by default – prints plan and PLAN_HASH, writes nothing.
 *   2. Apply requires explicit scope AND the PLAN_HASH from an identical dry run.
 *   3. Every modified role is backed up to `migrationbackups` before change.
 *   4. Rollback by RUN_ID restores the pre-migration state.
 *   5. All affected users' active sessions are invalidated after applying.
 *
 * Usage:
 *   # 1. Dry run (safe, read-only):
 *   npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts
 *
 *   # 2. Interactive – pick tenant from list, confirm before applying:
 *   npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts --interactive
 *
 *   # 3. Apply to a specific tenant (PLAN_HASH from step 1):
 *   npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts \
 *     --tenant=<tenantId|databaseName> --apply --approve-plan=<PLAN_HASH>
 *
 *   # 4. Apply to ALL tenants:
 *   npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts \
 *     --all --apply --approve-plan=<PLAN_HASH>
 *
 *   # 5. Rollback a specific run:
 *   npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts \
 *     --tenant=<tenantId|databaseName> --rollback=<RUN_ID>
 */

import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIGRATION = "curriculum-view-permission-v1";
const GOVERNED_ROLES = ["hod", "faculty"] as const;
type GoverningRole = (typeof GOVERNED_ROLES)[number];
const NEW_MODULE = { module: "curriculum", actions: ["view"] };

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = { module: string; actions: string[] };
type PlannedChange = {
  tenantId: string;
  databaseName: string;
  roleId: mongoose.Types.ObjectId;
  roleName: GoverningRole;
  before: Permission[];
  after: Permission[];
};

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.split("=");
    return [k, v.join("=") || "true"];
  }),
);
const apply = args.has("--apply");
const interactive = args.has("--interactive");
const allTenants = args.has("--all");
let tenantSelector = args.get("--tenant");
let approvedPlan = args.get("--approve-plan");
const rollbackRunId = args.get("--rollback");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canonicalPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return (value as Partial<Permission>[])
    .map((p) => ({
      module: String(p.module ?? ""),
      actions: Array.isArray(p.actions) ? p.actions.map(String).sort() : [],
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

function hasCurriculumView(perms: Permission[]): boolean {
  return perms.some((p) => p.module === "curriculum" && p.actions.includes("view"));
}

function withCurriculumView(perms: Permission[]): Permission[] {
  if (hasCurriculumView(perms)) return perms;
  const existing = perms.find((p) => p.module === "curriculum");
  if (existing) {
    return perms.map((p) =>
      p.module === "curriculum"
        ? { ...p, actions: [...new Set([...p.actions, "view"])].sort() }
        : p,
    );
  }
  return [...perms, { ...NEW_MODULE }];
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

// ─── Safety ───────────────────────────────────────────────────────────────────

function assertSafeArguments() {
  if (interactive && (apply || allTenants || tenantSelector || rollbackRunId))
    throw new Error("--interactive must be used alone");
  if (interactive && (!stdin.isTTY || !stdout.isTTY))
    throw new Error("--interactive requires an attached terminal");
  if (tenantSelector && allTenants) throw new Error("Choose either --tenant or --all, not both");
  if ((apply || rollbackRunId) && !tenantSelector && !allTenants)
    throw new Error("Writes require an explicit --tenant=<id|database> or --all scope");
  if (apply && rollbackRunId) throw new Error("Choose either --apply or --rollback");
}

// ─── Tenant helpers ───────────────────────────────────────────────────────────

async function selectedTenants() {
  const master = mongoose.connection.db;
  if (!master) throw new Error("Master database connection unavailable");
  const filter = tenantSelector
    ? { $or: [{ tenantId: tenantSelector }, { databaseName: tenantSelector }] }
    : {};
  const tenants = await master
    .collection("tenants")
    .find(filter)
    .project({ tenantId: 1, databaseName: 1, name: 1 })
    .sort({ tenantId: 1 })
    .toArray();
  if (!tenants.length) throw new Error("No matching tenants found");
  return tenants;
}

async function chooseTenantInteractively() {
  const master = mongoose.connection.db;
  if (!master) throw new Error("Master database connection unavailable");
  const tenants = await master
    .collection("tenants")
    .find({})
    .project({ name: 1, tenantId: 1, databaseName: 1, status: 1 })
    .sort({ name: 1 })
    .toArray();
  if (!tenants.length) throw new Error("No tenants found");

  console.info("\nAvailable tenants:");
  tenants.forEach((t, i) => {
    console.info(
      `  ${i + 1}. ${String(t.name || t.tenantId)} [${String(t.tenantId)}] (${String(t.status || "unknown")})`,
    );
  });

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await prompt.question("\nSelect tenant number (or q to cancel): ")).trim();
    if (answer.toLowerCase() === "q") throw new Error("Migration cancelled");
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= tenants.length)
      throw new Error("Invalid tenant selection");
    tenantSelector = String(tenants[index]!.tenantId);
    console.info(`Selected: ${String(tenants[index]!.name || tenantSelector)}`);
  } finally {
    prompt.close();
  }
}

async function confirmInteractiveApply(hash: string, changes: PlannedChange[]) {
  if (!tenantSelector) throw new Error("Tenant selection missing");
  if (!changes.length) return false;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const phrase = `APPLY ${tenantSelector}`;
    console.info("\nRoles above will be backed up before modification.");
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

// ─── Plan & apply ─────────────────────────────────────────────────────────────

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
      if (hasCurriculumView(before)) {
        console.info(`  [SKIP] ${tenantId}:${roleName} — already has curriculum:view`);
        continue;
      }
      const after = canonicalPermissions(withCurriculumView(before));
      changes.push({ tenantId, databaseName, roleId: role._id, roleName, before, after });
    }
  }
  return changes;
}

async function applyPlan(changes: PlannedChange[], hash: string) {
  if (approvedPlan !== hash)
    throw new Error(`Plan approval missing or stale. Pass --approve-plan=${hash}`);

  const runId = randomUUID();
  console.info(`\nStarting migration. RUN_ID=${runId}`);

  for (const change of changes) {
    const db = mongoose.connection.getClient().db(change.databaseName);
    const roles = db.collection("roles");

    // Drift check
    const current = await roles.findOne({ _id: change.roleId });
    if (
      JSON.stringify(canonicalPermissions(current?.permissions)) !== JSON.stringify(change.before)
    )
      throw new Error(
        `Policy drift detected for ${change.tenantId}:${change.roleName}; aborting. Re-run dry run.`,
      );

    // Backup
    await db.collection("migrationbackups").insertOne({
      migration: MIGRATION,
      runId,
      tenantId: change.tenantId,
      roleId: change.roleId,
      roleName: change.roleName,
      permissions: change.before,
      createdAt: new Date(),
    });

    // Apply
    await roles.updateOne(
      { _id: change.roleId },
      { $set: { permissions: change.after, updatedAt: new Date() } },
    );
    console.info(`  [APPLIED] ${change.tenantId}:${change.roleName}`);
  }

  // Invalidate active sessions → users get fresh JWTs on next login
  for (const tenant of await selectedTenants()) {
    const db = String(tenant.databaseName || "");
    const affected = changes.filter((c) => c.databaseName === db).map((c) => c.roleName);
    if (!affected.length) continue;
    const result = await mongoose.connection
      .getClient()
      .db(db)
      .collection("users")
      .updateMany({ roles: { $in: affected } }, { $set: { activeSessions: [] } });
    console.info(
      `  [SESSIONS] ${String(tenant.tenantId)}: ${result.modifiedCount} user session(s) invalidated`,
    );
  }

  console.info(
    `\n✓ Applied ${changes.length} role update(s). RUN_ID=${runId}\n` +
      `  To rollback: --tenant=<id> --rollback=${runId}`,
  );
}

async function rollback(runId: string) {
  let restored = 0;
  for (const tenant of await selectedTenants()) {
    const db = String(tenant.databaseName || "");
    if (!db) continue;
    const database = mongoose.connection.getClient().db(db);
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
          { roles: { $in: backups.map((b) => b.roleName) } },
          { $set: { activeSessions: [] } },
        );
      restored += backups.length;
      console.info(`  [RESTORED] ${String(tenant.tenantId)}: ${backups.length} role(s)`);
    }
  }
  if (!restored) throw new Error(`No backups found for RUN_ID=${runId} in the selected scope`);
  console.info(`\n✓ Restored ${restored} role policy/policies from RUN_ID=${runId}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  assertSafeArguments();
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI env is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  console.info("Connected to MongoDB.");

  if (interactive) await chooseTenantInteractively();
  if (rollbackRunId) return rollback(rollbackRunId);

  const changes = await buildPlan();
  const hash = planHash(changes);

  console.info(
    `\nScope: ${new Set(changes.map((c) => c.tenantId)).size} tenant(s), ` +
      `${changes.length} role(s) need update`,
  );
  for (const c of changes) console.info(`  • ${c.tenantId}:${c.roleName}`);
  console.info(`\nPLAN_HASH=${hash}`);

  if (interactive) {
    if (await confirmInteractiveApply(hash, changes)) await applyPlan(changes, hash);
    return;
  }

  if (!apply) {
    console.info("\nDry-run complete. To apply, re-run with:");
    console.info(
      `  --tenant=<id> --apply --approve-plan=${hash}\n` +
        `  --all         --apply --approve-plan=${hash}`,
    );
    return;
  }

  await applyPlan(changes, hash);
}

main()
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
