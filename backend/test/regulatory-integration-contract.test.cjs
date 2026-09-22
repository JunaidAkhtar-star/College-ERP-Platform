const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("regulatory integrations are commercially entitled and RBAC protected", () => {
  const entitlements = read("server/constants/module-entitlements.ts");
  const permissions = read("server/constants/permissions.ts");
  const routes = read("server/routes/regulatory-integration.routes.ts");
  assert.match(entitlements, /government-regulatory-integrations/);
  assert.match(permissions, /REGULATORY_INTEGRATION/);
  assert.match(routes, /requirePermission\(Module\.REGULATORY_INTEGRATION/);
  assert.match(routes, /PermissionAction\.VIEW/);
  assert.match(routes, /PermissionAction\.EDIT/);
  assert.match(routes, /PermissionAction\.APPROVE/);
  assert.match(routes, /PermissionAction\.CREATE/);
  assert.match(routes, /PermissionAction\.DELETE/);
});

test("production authorization requires readiness evidence and maker-checker approval", () => {
  const service = read("server/services/regulatory-integration.service.ts");
  assert.match(service, /async requestApproval/);
  assert.match(service, /current\.status !== "configured"/);
  assert.match(service, /!current\.consentConfirmed/);
  assert.match(service, /current\.checklist\.some\(\(entry\) => !entry\.completed\)/);
  assert.match(service, /Upload \$\{missing\.label\} before requesting approval/);
  assert.match(service, /requester cannot approve their own production authorization/i);
  assert.match(service, /current\.productionEnabled = decision === "approved"/);
});

test("catalogue assigns the module to Enterprise and exposes a Professional add-on", () => {
  const catalog = read("server/scripts/data/platform-catalog.ts");
  assert.match(catalog, /slug: "government-regulatory-integrations"/);
  assert.match(catalog, /moduleSlugs: PLATFORM_MODULES\.map/);
  assert.match(catalog, /slug: "government-regulatory-integrations-addon"/);
  assert.match(catalog, /amountInPaise: 3000000/);
});

test("provider operations derive regulatory readiness from live ERP records", () => {
  const service = read("server/services/regulatory-data.service.ts");
  const routes = read("server/routes/regulatory-integration.routes.ts");
  assert.match(routes, /\/:provider\/operations/);
  assert.match(service, /StudentProfileModel\.find/);
  assert.match(service, /AssessmentScoreLedgerModel\.find/);
  assert.match(service, /FacultyProfileModel\.find/);
  assert.match(service, /FeeRecordModel\.find/);
  assert.match(service, /RndPublicationModel\.find/);
  assert.match(service, /PlacementApplicationModel\.find/);
  assert.match(service, /source: "live_erp"/);
  assert.match(service, /Missing APAAR\/ABC ID/);
  assert.match(service, /Verified marksheet file is missing/);
});

test("submission batches enforce review separation, export, and reconciliation", () => {
  const model = read("server/models/regulatory-submission.model.ts");
  const service = read("server/services/regulatory-submission.service.ts");
  const routes = read("server/routes/regulatory-integration.routes.ts");
  assert.match(model, /partially_accepted/);
  assert.match(model, /acknowledgementReference/);
  assert.match(service, /batch preparer cannot approve their own submission/i);
  assert.match(service, /No validated records are ready/);
  assert.match(service, /BATCH_EXPORTED/);
  assert.match(service, /BATCH_RECONCILED/);
  assert.match(routes, /submissions\/:batchId\/decision/);
  assert.match(routes, /PermissionAction\.APPROVE/);
  assert.match(routes, /submissions\/:batchId\/reconcile/);
});

test("external connectivity is encrypted and never claims an unavailable API is live", () => {
  const model = read("server/models/regulatory-connection.model.ts");
  const service = read("server/services/regulatory-connection.service.ts");
  const routes = read("server/routes/regulatory-integration.routes.ts");
  assert.match(model, /secretCiphertext: \{ type: String, select: false \}/);
  assert.match(service, /cryptoUtil\.encrypt\(credential\)/);
  assert.match(service, /Independent production authorization is required/);
  assert.match(service, /no approved provider adapter is installed/i);
  assert.match(service, /No external request was sent/i);
  assert.match(service, /mode === "portal_export"/);
  assert.match(routes, /\/:provider\/connection\/test/);
  assert.match(routes, /PermissionAction\.EDIT/);
});

test("student ABC ledger is self-only, frozen-ledger backed, and provider-honest", () => {
  const routes = read("server/routes/student-profile.routes.ts");
  const controller = read("server/controllers/student-profile.controller.ts");
  const service = read("server/services/student-abc.service.ts");

  assert.match(routes, /"\/me\/abc-ledger"/);
  assert.match(routes, /requireRoles\(\[SystemRole\.STUDENT\]\)/);
  assert.doesNotMatch(routes, /:\w+\/abc-ledger/);
  assert.match(controller, /studentAbcService\.myLedger\(String\(req\.user\?\._id \?\? ""\)\)/);
  assert.match(service, /StudentProfileModel\.findOne\(\{ userId \}\)/);
  assert.match(service, /status: GradebookStatus\.FROZEN/);
  assert.match(service, /institution_recorded_provider_response/);
  assert.match(service, /provider response recorded by the institution/i);
});

test("regulatory operations use a professional maker-checker role matrix", () => {
  const defaults = read("server/constants/role-defaults.ts");
  const routes = read("server/routes/regulatory-integration.routes.ts");

  assert.match(
    defaults,
    /\[SystemRole\.EXAMINATION_CELL\][\s\S]*?\[M\.REGULATORY_INTEGRATION\]: VIEW_EDIT/,
  );
  assert.match(
    defaults,
    /\[SystemRole\.DEAN_ACADEMIC\][\s\S]*?\[M\.REGULATORY_INTEGRATION\]: \[A\.VIEW, A\.APPROVE, A\.EXPORT\]/,
  );
  assert.match(
    defaults,
    /\[SystemRole\.IQAC_NAAC\][\s\S]*?\[M\.REGULATORY_INTEGRATION\]: \[\.\.\.VIEW_EDIT, A\.EXPORT\]/,
  );
  assert.match(
    routes,
    /connectionAdministrators = requireRoles\(\[SystemRole\.SUPER_ADMIN, SystemRole\.ADMIN\]\)/,
  );
  assert.match(routes, /"\/:provider\/connection"[\s\S]*?connectionAdministrators/);
  assert.match(routes, /"\/:provider\/connection\/test"[\s\S]*?connectionAdministrators/);
});
