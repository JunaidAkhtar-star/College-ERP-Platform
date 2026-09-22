/**
 * @file auto-patch-curriculum-view.ts
 * @description One-shot script: automatically adds `curriculum:view` to HOD and
 *   FACULTY system roles across EVERY tenant database without any prompts.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register server/scripts/auto-patch-curriculum-view.ts
 *
 * Env:
 *   MONGODB_URI   – MongoDB connection string (required)
 *   MASTER_DB_NAME – master database name (default: devvelocity_master)
 *
 * Safe to run multiple times – roles that already have curriculum:view are
 * skipped. Backs up original permissions to `migrationbackups` collection.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const MIGRATION = "curriculum-view-permission-v1";
const GOVERNED_ROLES = ["hod", "faculty"] as const;
const RUN_ID = randomUUID();

type Permission = { module: string; actions: string[] };

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
  return [...perms, { module: "curriculum", actions: ["view"] }];
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MASTER_DB_NAME ?? "devvelocity_master",
  });

  const master = mongoose.connection.db;
  if (!master) throw new Error("Could not connect to master database");

  // Fetch all active tenant databases
  const tenants = await master
    .collection("tenants")
    .find({})
    .project({ tenantId: 1, databaseName: 1, name: 1 })
    .sort({ tenantId: 1 })
    .toArray();

  if (!tenants.length) {
    console.info("No tenants found. Nothing to do.");
    return;
  }

  console.info(`Found ${tenants.length} tenant(s). RUN_ID=${RUN_ID}\n`);

  let totalApplied = 0;
  let totalSkipped = 0;
  let totalSessions = 0;

  for (const tenant of tenants) {
    const tenantId = String(tenant.tenantId ?? "");
    const dbName = String(tenant.databaseName ?? "");
    const tenantName = String(tenant.name ?? tenantId);
    if (!tenantId || !dbName) continue;

    const db = mongoose.connection.getClient().db(dbName);
    const rolesCol = db.collection("roles");
    const patchedRoles: string[] = [];

    for (const roleName of GOVERNED_ROLES) {
      const role = await rolesCol.findOne({ name: roleName, isSystem: { $ne: false } });
      if (!role) {
        console.info(`  [MISSING] ${tenantName}:${roleName} — role not found, skipping`);
        continue;
      }

      const before = (role.permissions ?? []) as Permission[];

      if (hasCurriculumView(before)) {
        console.info(`  [SKIP]    ${tenantName}:${roleName} — already has curriculum:view`);
        totalSkipped++;
        continue;
      }

      const after = withCurriculumView(before);

      // Backup original permissions
      await db.collection("migrationbackups").insertOne({
        migration: MIGRATION,
        runId: RUN_ID,
        tenantId,
        roleId: role._id,
        roleName,
        permissions: before,
        createdAt: new Date(),
      });

      // Patch the role
      await rolesCol.updateOne(
        { _id: role._id },
        { $set: { permissions: after, updatedAt: new Date() } },
      );

      console.info(`  [APPLIED] ${tenantName}:${roleName} — curriculum:view added`);
      patchedRoles.push(roleName);
      totalApplied++;
    }

    // Invalidate active sessions for users with patched roles so they get fresh JWTs
    if (patchedRoles.length) {
      const result = await db
        .collection("users")
        .updateMany({ roles: { $in: patchedRoles } }, { $set: { activeSessions: [] } });
      totalSessions += result.modifiedCount;
      console.info(
        `  [SESSIONS] ${tenantName}: ${result.modifiedCount} user session(s) invalidated`,
      );
    }
  }

  console.info(
    `\n✓ Done.\n` +
      `  Applied : ${totalApplied} role(s)\n` +
      `  Skipped : ${totalSkipped} role(s) (already up-to-date)\n` +
      `  Sessions: ${totalSessions} user session(s) invalidated\n` +
      `  RUN_ID  : ${RUN_ID}\n`,
  );
  console.info(
    `To rollback, run:\n` +
      `  npx ts-node -r tsconfig-paths/register server/scripts/migrate-curriculum-view-permission.ts ` +
      `--all --rollback=${RUN_ID}`,
  );
}

main()
  .catch((error) => {
    console.error("Patch failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
