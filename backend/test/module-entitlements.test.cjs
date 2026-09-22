const assert = require("node:assert/strict");
const test = require("node:test");
const {
  API_MODULE_ENTITLEMENTS,
  canonicalEntitlementSlug,
  entitlementForPath,
  entitlementForNavHref,
} = require("../build/constants/module-entitlements.js");
const {
  PLATFORM_ADDONS,
  PLATFORM_MODULES,
  PLATFORM_PLANS,
} = require("../build/scripts/data/platform-catalog.js");

test("canonicalizes legacy commercial entitlement slugs", () => {
  assert.equal(canonicalEntitlementSlug("admission"), "admissions");
  assert.equal(canonicalEntitlementSlug("academic-structure"), "academics");
  assert.equal(canonicalEntitlementSlug("examination"), "examinations");
  assert.equal(canonicalEntitlementSlug("faculty"), "academics");
  assert.equal(canonicalEntitlementSlug("fee"), "fees");
  assert.equal(canonicalEntitlementSlug("meeting"), "virtual-classrooms");
  assert.equal(canonicalEntitlementSlug("placement"), "placements");
  assert.equal(canonicalEntitlementSlug("students"), "academics");
  assert.equal(canonicalEntitlementSlug("academics"), "academics");
});

test("maps every commercial API family to its product entitlement", () => {
  assert.equal(entitlementForPath("/api/v1/fee/records"), "fees");
  assert.equal(entitlementForPath("/api/v1/accounts/summary"), "fees");
  assert.equal(entitlementForPath("/api/v1/store/items"), "procurement");
  assert.equal(entitlementForPath("/api/v1/faculty-attendance/summary"), "attendance");
  assert.equal(entitlementForPath("/api/v1/assessment-gradebook/ledgers"), "academics");
  assert.equal(entitlementForPath("/api/v1/meeting/upcoming"), "virtual-classrooms");
  assert.equal(entitlementForPath("/api/v1/meeting-recording/abc"), "virtual-classrooms");
  assert.equal(entitlementForPath("/api/v1/tenant-integrations"), "security");
  assert.equal(entitlementForPath("/api/v1/tenant-integrations/stripe/checkout"), "fees");
  assert.equal(entitlementForPath("/api/v1/tenant-integrations/stripe/webhook"), "fees");
  assert.equal(entitlementForPath("/api/v1/grievance"), "communication");
  assert.equal(entitlementForPath("/api/v1/parent/ward"), "academics");
  assert.equal(entitlementForPath("/api/v1/parent/attendance"), "attendance");
  assert.equal(entitlementForPath("/api/v1/parent/results"), "examinations");
  assert.equal(entitlementForPath("/api/v1/parent/fees/pay"), "fees");
  assert.equal(entitlementForPath("/api/v1/parent/notices"), "communication");
  assert.equal(entitlementForPath("/api/v1/parent/messages"), "communication");
  assert.equal(entitlementForPath("/api/v1/operations/outbox/summary"), "security");
  assert.equal(entitlementForPath("/api/v1/campus-governance/campuses"), "multi-campus-governance");
});

test("maps ERP navigation aliases to the same commercial entitlements", () => {
  assert.equal(entitlementForNavHref("/academic-structure"), "academics");
  assert.equal(entitlementForNavHref("/parent/fees"), "fees");
  assert.equal(entitlementForNavHref("/sso-settings"), "security");
  assert.equal(entitlementForNavHref("/gate-pass"), "procurement");
  assert.equal(entitlementForNavHref("/clubs"), "clubs");
  assert.equal(entitlementForNavHref("/campus-governance"), "multi-campus-governance");
});

test("leaves core platform routes available to every subscribed tenant", () => {
  assert.equal(entitlementForPath("/api/v1/auth/login"), undefined);
  assert.equal(entitlementForPath("/api/v1/user/me"), undefined);
  assert.equal(entitlementForPath("/api/v1/institution-setting/public"), undefined);
});

test("catalogue contains no blank entitlement identifiers", () => {
  for (const [route, entitlement] of Object.entries(API_MODULE_ENTITLEMENTS)) {
    assert.ok(route.length > 0);
    assert.ok(entitlement.length > 0);
  }
});

test("plans, add-ons and API policies reference canonical catalogue modules", () => {
  const moduleSlugs = PLATFORM_MODULES.map(({ slug }) => slug);
  const knownModules = new Set(moduleSlugs);

  assert.equal(new Set(moduleSlugs).size, moduleSlugs.length, "module slugs must be unique");
  assert.equal(new Set(PLATFORM_PLANS.map(({ slug }) => slug)).size, PLATFORM_PLANS.length);
  assert.equal(new Set(PLATFORM_ADDONS.map(({ slug }) => slug)).size, PLATFORM_ADDONS.length);

  for (const plan of PLATFORM_PLANS) {
    assert.equal(new Set(plan.moduleSlugs).size, plan.moduleSlugs.length, `${plan.slug} repeats modules`);
    for (const slug of plan.moduleSlugs) {
      assert.ok(knownModules.has(slug), `${plan.slug} references unknown module ${slug}`);
      assert.equal(canonicalEntitlementSlug(slug), slug, `${plan.slug} uses legacy module ${slug}`);
    }
  }

  for (const addon of PLATFORM_ADDONS) {
    for (const slug of addon.moduleSlugs) {
      assert.ok(knownModules.has(slug), `${addon.slug} references unknown module ${slug}`);
      assert.equal(canonicalEntitlementSlug(slug), slug, `${addon.slug} uses legacy module ${slug}`);
    }
  }

  for (const entitlement of Object.values(API_MODULE_ENTITLEMENTS)) {
    const canonical = canonicalEntitlementSlug(entitlement);
    assert.ok(knownModules.has(canonical), `API policy references unknown module ${canonical}`);
  }
});

test("paid plan tiers are cumulative", () => {
  const paidPlans = ["starter", "growth", "professional", "enterprise"].map((slug) => {
    const plan = PLATFORM_PLANS.find((candidate) => candidate.slug === slug);
    assert.ok(plan, `missing ${slug} plan`);
    return plan;
  });

  for (let index = 1; index < paidPlans.length; index += 1) {
    const previous = paidPlans[index - 1];
    const current = new Set(paidPlans[index].moduleSlugs);
    for (const slug of previous.moduleSlugs) {
      assert.ok(current.has(slug), `${paidPlans[index].slug} is missing ${slug} from ${previous.slug}`);
    }
  }
});
