/**
 * Seeds a draft accreditation setup for existing tenants without activating or
 * claiming verification. Dry-run by default. Applying requires explicit scope
 * and the hash printed by an identical dry run.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { COMPLIANCE_CATALOG } from "../constants/compliance-catalog";

interface IPlanRow {
  tenantId: string;
  databaseName: string;
  country: string;
  domains: string[];
  frameworkSlugs: string[];
}

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...rest] = argument.split("=");
    return [key, rest.join("=") || "true"];
  }),
);
const apply = args.has("--apply");
const all = args.has("--all");
const tenantSelector = args.get("--tenant");
const approvedPlan = args.get("--approve-plan");

const currentAcademicYear = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const normalizeDomain = (value: string) => {
  const text = value.toLowerCase();
  if (/engineer|technology|b\.?tech|m\.?tech/.test(text)) return "engineering";
  if (/manage|business|mba|bba/.test(text)) return "management";
  if (/pharmacy|pharma/.test(text)) return "pharmacy";
  if (/computer|mca|bca/.test(text)) return "computing";
  if (/architect/.test(text)) return "architecture";
  return "general";
};

const catalogueMatch = (label: string) => {
  const normalized = label.toLowerCase();
  return COMPLIANCE_CATALOG.find(
    (item) =>
      normalized.includes(item.key) ||
      normalized.includes(item.shortName.toLowerCase()) ||
      normalized.includes(item.authority.toLowerCase()),
  );
};

function assertArguments() {
  if (all && tenantSelector) throw new Error("Choose either --all or --tenant");
  if (apply && !all && !tenantSelector) throw new Error("Writes require --all or --tenant=<id|db>");
}

async function tenants() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Master database unavailable");
  const filter = tenantSelector
    ? { $or: [{ tenantId: tenantSelector }, { databaseName: tenantSelector }] }
    : {};
  return db
    .collection("tenants")
    .find(filter)
    .project({ tenantId: 1, databaseName: 1 })
    .sort({ tenantId: 1 })
    .toArray();
}

async function buildPlan(): Promise<IPlanRow[]> {
  const plan: IPlanRow[] = [];
  for (const tenant of await tenants()) {
    const tenantId = String(tenant.tenantId ?? "");
    const databaseName = String(tenant.databaseName ?? "");
    if (!tenantId || !databaseName) continue;
    const db = mongoose.connection.getClient().db(databaseName);
    if (await db.collection("accreditationsetups").findOne({})) continue;
    const [settings, campus, programmes] = await Promise.all([
      db.collection("institutionsettings").findOne({}),
      db.collection("campuses").findOne({ status: "active" }),
      db.collection("curriculums").find({ isActive: true }).project({ program: 1 }).toArray(),
    ]);
    const country = String(campus?.address?.country ?? "India");
    const domains = [
      ...new Set(programmes.map((item) => normalizeDomain(String(item.program ?? "")))),
    ];
    const frameworkSlugs = [
      ...new Set(
        (Array.isArray(settings?.accreditations) ? settings.accreditations : [])
          .map((label: unknown) => catalogueMatch(String(label))?.slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
    ];
    plan.push({ tenantId, databaseName, country, domains, frameworkSlugs });
  }
  return plan;
}

const hashPlan = (plan: IPlanRow[]) =>
  createHash("sha256").update(JSON.stringify(plan)).digest("hex");

async function run() {
  assertArguments();
  await mongoose.connect(process.env.MONGODB_URI ?? "", {
    dbName: process.env.MASTER_DB_NAME || "devvelocity_master",
  });
  const plan = await buildPlan();
  const planHash = hashPlan(plan);
  console.table(
    plan.map((row) => ({
      tenantId: row.tenantId,
      country: row.country,
      domains: row.domains.join(", "),
      candidateFrameworks: row.frameworkSlugs.join(", ") || "none",
    })),
  );
  console.info(`PLAN_HASH=${planHash}`);
  if (!apply) {
    console.info("Dry run only. Re-run with --apply and --approve-plan=<PLAN_HASH>.");
    return;
  }
  if (approvedPlan !== planHash) throw new Error("Plan approval missing or stale");
  const runId = randomUUID();
  for (const row of plan) {
    const db = mongoose.connection.getClient().db(row.databaseName);
    const frameworks = row.frameworkSlugs.map((slug) => {
      const catalog = COMPLIANCE_CATALOG.find((item) => item.slug === slug)!;
      return {
        frameworkSlug: slug,
        frameworkVersion: "verification-required",
        authority: catalog.authority,
        scopeType: slug.includes("nba") || slug.includes("abet") ? "programme" : "institution",
        campusIds: [],
        departmentIds: [],
        programIds: [],
        cycleType: "first",
        academicYear: currentAcademicYear(),
        officialSourceUrl: catalog.officialSourceUrl,
        trustState: "draft_mapping",
        trustHistory: [],
        status: "draft",
        ownerIds: [],
        reviewerIds: [],
      };
    });
    await db.collection("migrationbackups").insertOne({
      migration: "accreditation-setup-v1",
      runId,
      tenantId: row.tenantId,
      previous: null,
      createdAt: new Date(),
    });
    await db.collection("accreditationsetups").insertOne({
      country: row.country,
      institutionType: "other",
      universityType: "not_applicable",
      isAutonomous: false,
      programmeDomains: row.domains,
      setupStatus: "in_progress",
      frameworks,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  console.info(`Created ${plan.length} draft tenant setups. RUN_ID=${runId}`);
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
