/**
 * One-shot audit & repair for the admission enrollment-limit error across the
 * ENTIRE multi-tenant platform — master DB + every tenant DB in a single run.
 *
 * Background: The admission enrollment limit is enforced in
 * `server/repositories/user.repository.ts` against `tenant.maxStudents` (read
 * from the MASTER `tenants` collection) vs. the count of enrolled students
 * (read from the TENANT `studentprofiles` collection). Two things can go wrong:
 *
 *   A. MASTER DB (`devvelocity_master`):
 *      - `tenants.maxStudents` set too low (e.g. 1) by the old billing flow that
 *        wrote `licensedUserCount` into `maxStudents`. Blocks all new admissions.
 *      - `subscriptionplans.studentLimit` set below a safe floor.
 *
 *   B. TENANT DBs (`tenant_<id>`):
 *      - When an admission application is REJECTED or WITHDRAWN, the linked user
 *        account is left `status: "active"` forever. These orphaned accounts
 *        pollute the tenant DB and (under the old counting logic) consumed seats.
 *        This script deactivates them so the tenant DB stays clean.
 *
 * This is a ONE-SHOT script: a single run audits AND applies every available
 * fix automatically across the master DB and ALL tenant databases. No flags
 * needed. Pass `--dry-run` for a read-only preview that changes nothing.
 *
 * Usage:
 *   pnpm --filter backend exec ts-node server/scripts/fix-tenant-student-limits.ts            # one-shot: fix everything
 *   pnpm --filter backend exec ts-node server/scripts/fix-tenant-student-limits.ts --dry-run  # read-only preview
 */
import "dotenv/config";
import mongoose, { type Connection, type Types } from "mongoose";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { ProductAddonModel, SubscriptionPlanModel } from "../models/platform.model";
import { UserModel } from "../models/user.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import {
  AdmissionApplicationModel,
  ApplicationStatus,
} from "../models/admission-application.model";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const DRY_RUN = process.argv.includes("--dry-run");

/** Admission statuses that are terminal & non-enrolled — their linked user
 *  accounts are orphaned and should be deactivated. */
const ORPHANING_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

interface Row {
  tenantId: string;
  name: string;
  planSlug: string | null;
  currentMaxStudents: number | null;
  planStudentLimit: number | null;
  expectedMaxStudents: number;
  currentMaxEmployees: number | null;
  planEmployeeLimit: number | null;
  expectedMaxEmployees: number;
  needsFix: boolean;
  reason: string | null;
}

async function buildRows(): Promise<Row[]> {
  const [tenants, plans, addons] = await Promise.all([
    TenantModel.find().lean().exec(),
    SubscriptionPlanModel.find().lean().exec(),
    ProductAddonModel.find({ isActive: true }).lean().exec(),
  ]);
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  return tenants.map((tenant) => {
    const plan = tenant.planId ? planById.get(String(tenant.planId)) : null;
    const enabledAddonSlugs = tenant.enabledAddonSlugs ?? [];
    const tenantAddons = addons.filter((a) => enabledAddonSlugs.includes(a.slug));

    const addonStudents = tenantAddons.reduce(
      (total, a) => total + (a.capacityBoost?.additionalStudents ?? 0),
      0,
    );
    const addonEmployees = tenantAddons.reduce(
      (total, a) => total + (a.capacityBoost?.additionalEmployees ?? 0),
      0,
    );

    const planStudentLimit = plan?.studentLimit ?? null;
    const planEmployeeLimit = plan?.employeeLimit ?? null;
    const expectedMaxStudents = (planStudentLimit ?? 0) + addonStudents;
    const expectedMaxEmployees = (planEmployeeLimit ?? 0) + addonEmployees;

    const currentMaxStudents = tenant.maxStudents ?? null;
    const currentMaxEmployees = tenant.maxEmployees ?? null;

    let needsFix = false;
    let reason: string | null = null;

    if (!plan) {
      // No plan linked — cannot compute expected; leave alone but flag for review.
      needsFix = false;
      reason = "No subscription plan linked — manual review required";
    } else if (currentMaxStudents === null) {
      needsFix = true;
      reason = "maxStudents is unset";
    } else if (currentMaxStudents < planStudentLimit!) {
      needsFix = true;
      reason = `maxStudents (${currentMaxStudents}) is below plan floor (${planStudentLimit})`;
    } else if (currentMaxStudents !== expectedMaxStudents) {
      // Drift between stored value and plan + addons. Only auto-fix when the
      // stored value is *lower* than expected (the blocking direction). Higher
      // values may be intentional manual overrides — report but don't clobber.
      if (currentMaxStudents < expectedMaxStudents) {
        needsFix = true;
        reason = `maxStudents (${currentMaxStudents}) drifted below expected (${expectedMaxStudents})`;
      } else {
        needsFix = false;
        reason = `maxStudents (${currentMaxStudents}) is above expected (${expectedMaxStudents}) — possible manual override, left unchanged`;
      }
    }

    return {
      tenantId: tenant.tenantId,
      name: tenant.name,
      planSlug: plan?.slug ?? null,
      currentMaxStudents,
      planStudentLimit,
      expectedMaxStudents,
      currentMaxEmployees,
      planEmployeeLimit,
      expectedMaxEmployees,
      needsFix,
      reason,
    };
  });
}

function printReport(rows: Row[]): void {
  const width = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.info("\n┌─ Tenant student-limit audit ─────────────────────────────────────────────");
  console.info(
    `│ ${width("tenantId", 18)} ${width("plan", 14)} ${width("current", 10)} ${width("planLimit", 10)} ${width("expected", 10)} ${width("fix?", 6)} reason`,
  );
  console.info("├──────────────────────────────────────────────────────────────────────────");
  for (const r of rows) {
    console.info(
      `│ ${width(r.tenantId, 18)} ${width(r.planSlug ?? "—", 14)} ${width(String(r.currentMaxStudents ?? "—"), 10)} ${width(String(r.planStudentLimit ?? "—"), 10)} ${width(String(r.expectedMaxStudents), 10)} ${width(r.needsFix ? "YES" : "no", 6)} ${r.reason ?? ""}`,
    );
  }
  console.info("└──────────────────────────────────────────────────────────────────────────\n");

  const flagged = rows.filter((r) => r.needsFix);
  if (flagged.length === 0) {
    console.info("✓ No misconfigurations detected.");
  } else {
    console.info(`⚠ ${flagged.length} tenant(s) require correction.`);
  }
}

async function applyTenantFixes(rows: Row[]): Promise<void> {
  const flagged = rows.filter((r) => r.needsFix);
  if (flagged.length === 0) {
    console.info("✓ No tenant corrections needed.");
    return;
  }
  if (DRY_RUN) {
    console.info(`[dry-run] Would correct ${flagged.length} tenant(s):`);
    for (const r of flagged) {
      console.info(
        `  • ${r.tenantId}: maxStudents ${r.currentMaxStudents} → ${r.expectedMaxStudents}, maxEmployees ${r.currentMaxEmployees} → ${r.expectedMaxEmployees}`,
      );
    }
    return;
  }
  for (const r of flagged) {
    const res = await TenantModel.updateOne(
      { tenantId: r.tenantId },
      {
        $set: {
          maxStudents: r.expectedMaxStudents,
          maxEmployees: r.expectedMaxEmployees,
        },
      },
    );
    console.info(
      `  ✓ ${r.tenantId}: maxStudents ${r.currentMaxStudents} → ${r.expectedMaxStudents}, maxEmployees ${r.currentMaxEmployees} → ${r.expectedMaxEmployees} (matched=${res.matchedCount}, modified=${res.modifiedCount})`,
    );
  }
  console.info(`\nApplied corrections to ${flagged.length} tenant(s).`);
}

async function applyPlanFixes(rows: PlanRow[]): Promise<void> {
  const flagged = rows.filter((r) => r.needsFix);
  if (flagged.length === 0) {
    console.info("✓ No plan corrections needed.");
    return;
  }
  if (DRY_RUN) {
    console.info(`[dry-run] Would correct ${flagged.length} plan(s):`);
    for (const r of flagged) {
      console.info(`  • ${r.slug}: ${r.reason}`);
    }
    return;
  }
  for (const r of flagged) {
    const update: Record<string, number> = {};
    if (r.studentLimit < 10) update.studentLimit = 10;
    if (r.employeeLimit < 1) update.employeeLimit = 1;
    const res = await SubscriptionPlanModel.updateOne({ slug: r.slug }, { $set: update });
    console.info(
      `  ✓ ${r.slug}: ${r.reason} → raised to ${JSON.stringify(update)} (matched=${res.matchedCount}, modified=${res.modifiedCount})`,
    );
  }
  console.info(`\nApplied corrections to ${flagged.length} plan(s).`);
}

interface PlanRow {
  slug: string;
  name: string;
  studentLimit: number;
  employeeLimit: number;
  minimumBillableUsers: number;
  pricingModel: string;
  needsFix: boolean;
  reason: string | null;
}

async function buildPlanRows(): Promise<PlanRow[]> {
  const plans = await SubscriptionPlanModel.find().sort({ sortOrder: 1 }).lean().exec();
  return plans.map((plan) => {
    let needsFix = false;
    let reason: string | null = null;
    if (plan.studentLimit < 10) {
      needsFix = true;
      reason = `studentLimit ${plan.studentLimit} is below the safe floor of 10`;
    } else if (plan.employeeLimit < 1) {
      needsFix = true;
      reason = `employeeLimit ${plan.employeeLimit} is below the safe floor of 1`;
    }
    return {
      slug: plan.slug,
      name: plan.name,
      studentLimit: plan.studentLimit,
      employeeLimit: plan.employeeLimit,
      minimumBillableUsers: plan.minimumBillableUsers,
      pricingModel: plan.pricingModel,
      needsFix,
      reason,
    };
  });
}

function printPlanReport(rows: PlanRow[]): void {
  const width = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.info("\n┌─ Subscription plan limit audit ────────────────────────────────────────────");
  console.info(
    `│ ${width("slug", 16)} ${width("studentLimit", 14)} ${width("employeeLimit", 14)} ${width("minBillable", 12)} ${width("pricing", 12)} ${width("fix?", 6)} reason`,
  );
  console.info("├──────────────────────────────────────────────────────────────────────────");
  for (const r of rows) {
    console.info(
      `│ ${width(r.slug, 16)} ${width(String(r.studentLimit), 14)} ${width(String(r.employeeLimit), 14)} ${width(String(r.minimumBillableUsers), 12)} ${width(r.pricingModel, 12)} ${width(r.needsFix ? "YES" : "no", 6)} ${r.reason ?? ""}`,
    );
  }
  console.info("└──────────────────────────────────────────────────────────────────────────\n");
  const flagged = rows.filter((r) => r.needsFix);
  if (flagged.length === 0) {
    console.info("✓ All subscription plans have sane limits.");
  } else {
    console.info(
      `⚠ ${flagged.length} plan(s) have unsafe limits — fix via the super-admin Plans UI.`,
    );
  }
}

interface TenantCleanupResult {
  tenantId: string;
  dbName: string;
  orphanedApplications: number;
  deactivatedUsers: number;
  enrolledStudents: number;
  maxStudents: number | null;
  seatsFree: number | null;
}

/**
 * For a single tenant database, find admission applications in a terminal
 * non-enrolled state (REJECTED / WITHDRAWN) whose linked user account is still
 * `active`, and deactivate those orphaned users. Also reports the enrolled
 * student count vs the tenant's maxStudents so you can see seat availability.
 *
 * Models are re-bound to the tenant connection via `connection.model()` so the
 * queries hit the tenant DB, not the master DB.
 */
async function cleanupTenantDatabase(
  tenantId: string,
  tenantDb: Connection,
  maxStudents: number | null,
): Promise<TenantCleanupResult> {
  const dbName = tenantDb.name;
  const TenantUser = tenantDb.model(UserModel.modelName, UserModel.schema);
  const TenantAdmissionApp = tenantDb.model(
    AdmissionApplicationModel.modelName,
    AdmissionApplicationModel.schema,
  );
  const TenantStudentProfile = tenantDb.model(
    StudentProfileModel.modelName,
    StudentProfileModel.schema,
  );

  // Find terminal non-enrolled applications with a linked user.
  const orphanApps = await TenantAdmissionApp.find({
    status: { $in: ORPHANING_STATUSES },
    enrolledUserId: { $exists: true, $ne: null },
  })
    .select("enrolledUserId status applicationNumber")
    .lean()
    .exec();

  const orphanUserIds = Array.from(
    new Set(
      orphanApps
        .map((a) => (a as { enrolledUserId?: Types.ObjectId }).enrolledUserId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  );

  // Of those, which users are still active (i.e. truly orphaned)?
  let deactivatedUsers = 0;
  if (orphanUserIds.length > 0) {
    if (DRY_RUN) {
      const stillActive = await TenantUser.countDocuments({
        _id: { $in: orphanUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: "active",
      }).exec();
      deactivatedUsers = stillActive;
    } else {
      const res = await TenantUser.updateMany(
        {
          _id: { $in: orphanUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
          status: "active",
        },
        { $set: { status: "inactive" } },
      ).exec();
      deactivatedUsers = res.modifiedCount;
    }
  }

  // Report enrolled student count vs limit for visibility.
  const enrolledStudentStatuses: StudentStatus[] = [
    StudentStatus.ACTIVE,
    StudentStatus.DETAINED,
    StudentStatus.LATERAL_PROMOTED,
  ];
  const enrolledStudents = await TenantStudentProfile.countDocuments({
    status: { $in: enrolledStudentStatuses },
  }).exec();

  const seatsFree = maxStudents === null ? null : Math.max(0, maxStudents - enrolledStudents);

  return {
    tenantId,
    dbName,
    orphanedApplications: orphanApps.length,
    deactivatedUsers,
    enrolledStudents,
    maxStudents,
    seatsFree,
  };
}

function printTenantCleanupReport(results: TenantCleanupResult[]): void {
  const width = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.info(
    "\n┌─ Tenant database cleanup (orphaned users from rejected/withdrawn admissions) ─",
  );
  console.info(
    `│ ${width("tenantId", 16)} ${width("orphanApps", 11)} ${width("deactivated", 12)} ${width("enrolled", 9)} ${width("maxStudents", 12)} ${width("seatsFree", 10)}`,
  );
  console.info("├──────────────────────────────────────────────────────────────────────────");
  for (const r of results) {
    console.info(
      `│ ${width(r.tenantId, 16)} ${width(String(r.orphanedApplications), 11)} ${width(String(r.deactivatedUsers), 12)} ${width(String(r.enrolledStudents), 9)} ${width(String(r.maxStudents ?? "—"), 12)} ${width(String(r.seatsFree ?? "—"), 10)}`,
    );
  }
  console.info("└──────────────────────────────────────────────────────────────────────────\n");
  const totalDeactivated = results.reduce((sum, r) => sum + r.deactivatedUsers, 0);
  if (totalDeactivated === 0) {
    console.info("✓ No orphaned user accounts found in any tenant database.");
  } else {
    console.info(
      `⚠ ${totalDeactivated} orphaned user account(s) ${DRY_RUN ? "would be" : "were"} deactivated.`,
    );
  }
}

async function main(): Promise<void> {
  if (!mongoUri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });

  console.info(
    DRY_RUN
      ? "=== DRY-RUN (read-only, nothing will be written) ==="
      : "=== ONE-SHOT AUDIT & REPAIR ===",
  );
  console.info(`Target: ${masterDatabaseName} on ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  // ── 1. Subscription plans (master DB) ───────────────────────────────────────
  console.info("▸ Step 1: Auditing subscription plans...");
  const planRows = await buildPlanRows();
  printPlanReport(planRows);
  console.info("▸ Step 1: Applying plan corrections...");
  await applyPlanFixes(planRows);

  // ── 2. Tenants — maxStudents/maxEmployees (master DB) ───────────────────────
  console.info("\n▸ Step 2: Auditing tenant limits...");
  const rows = await buildRows();
  printReport(rows);
  console.info("▸ Step 2: Applying tenant limit corrections...");
  await applyTenantFixes(rows);

  // ── 3. Tenant databases — cleanup orphaned users (per-tenant DBs) ──────────
  console.info("\n▸ Step 3: Cleaning up orphaned users in each tenant database...");
  const tenants = await TenantModel.find({ status: TenantStatus.ACTIVE })
    .select("tenantId databaseName maxStudents")
    .lean()
    .exec();
  const cleanupResults: TenantCleanupResult[] = [];
  for (const tenant of tenants) {
    const dbName = `tenant_${tenant.tenantId}`;
    try {
      const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
      const result = await cleanupTenantDatabase(
        tenant.tenantId,
        tenantDb,
        tenant.maxStudents ?? null,
      );
      cleanupResults.push(result);
    } catch (err) {
      console.info(`  ✗ ${tenant.tenantId} (${dbName}): skipped — ${(err as Error).message}`);
    }
  }
  printTenantCleanupReport(cleanupResults);

  // ── Summary ────────────────────────────────────────────────────────────────
  const plansFixed = planRows.filter((r) => r.needsFix).length;
  const tenantsFixed = rows.filter((r) => r.needsFix).length;
  const usersDeactivated = cleanupResults.reduce((sum, r) => sum + r.deactivatedUsers, 0);
  console.info("\n=== SUMMARY ===");
  if (DRY_RUN) {
    console.info(
      `[dry-run] Would fix ${plansFixed} plan(s), ${tenantsFixed} tenant limit(s), and deactivate ${usersDeactivated} orphaned user(s). No changes written.`,
    );
  } else {
    console.info(
      `Fixed ${plansFixed} plan(s), ${tenantsFixed} tenant limit(s), deactivated ${usersDeactivated} orphaned user(s).`,
    );
    if (plansFixed === 0 && tenantsFixed === 0 && usersDeactivated === 0) {
      console.info("✓ Everything was already correctly configured — no changes needed.");
    }
  }
}

main()
  .catch((error) => {
    console.error("Tenant student-limit audit failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
