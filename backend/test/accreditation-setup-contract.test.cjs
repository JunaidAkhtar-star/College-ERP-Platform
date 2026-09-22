const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("tenant accreditation setup supports classification and scoped framework cycles", () => {
  const model = read("server/models/accreditation-setup.model.ts");
  assert.match(model, /institutionType:/);
  assert.match(model, /universityType:/);
  assert.match(model, /scopeType: "institution" \| "campus" \| "programme"/);
  assert.match(model, /frameworkVersion:/);
  assert.match(model, /submissionDueAt/);
  assert.match(model, /ownerIds/);
  assert.match(model, /reviewerIds/);
});

test("framework activation and trust advancement require independent evidence", () => {
  const service = read("server/services/accreditation-setup.service.ts");
  assert.match(service, /The activation requester cannot be an assigned reviewer/);
  assert.match(service, /The activation requester cannot approve their own framework/);
  assert.match(service, /Only an assigned framework reviewer can decide activation/);
  assert.match(service, /scope\.trustState = "institution_reviewed"/);
  assert.match(service, /Verification states must advance sequentially/);
  assert.match(service, /verified portal evidence or a verified API response/);
  assert.match(service, /Only an assigned independent reviewer can advance verification/);
});

test("recommendations are tenant-derived and remain verification candidates", () => {
  const catalog = read("server/constants/compliance-catalog.ts");
  const service = read("server/services/accreditation-setup.service.ts");
  assert.match(catalog, /abet-programme-accreditation/);
  assert.match(catalog, /aacsb-business-accreditation/);
  assert.match(catalog, /qaa-quality-code/);
  assert.match(service, /catalogMatch\(setup\)/);
  assert.match(service, /verificationRequired: true/);
});

test("accreditation preparation snapshots are hashed and immutable", () => {
  const model = read("server/models/accreditation-setup.model.ts");
  const service = read("server/services/accreditation-setup.service.ts");
  assert.match(model, /payloadHash: \{ type: String, required: true, immutable: true/);
  assert.match(model, /Accreditation snapshots are immutable/);
  assert.match(model, /Accreditation snapshot integrity mismatch/);
  assert.match(service, /Only active framework scopes can be snapshotted/);
  assert.match(service, /Publish requirement mappings before creating a snapshot/);
  assert.match(service, /requirementId: \{ \$in: requirements\.map/);
  assert.match(service, /scopeDepartmentIds/);
  assert.match(service, /scopeProgramIds/);
});

test("readiness is framework scoped and detects ownership and evidence expiry", () => {
  const service = read("server/services/accreditation-setup.service.ts");
  assert.match(service, /requirementId: \{ \$in: requirementIds \}/);
  assert.match(service, /EVIDENCE_OWNER_MISSING/);
  assert.match(service, /EVIDENCE_REVIEWER_MISSING/);
  assert.match(service, /EVIDENCE_EXPIRED/);
  assert.match(service, /approvedRequirementIds/);
});

test("accreditation setup routes use granular compliance permissions", () => {
  const routes = read("server/routes/compliance-workspace.routes.ts");
  const permissions = read("server/constants/route-permissions.ts");
  assert.match(routes, /\/accreditation\/recommendations/);
  assert.match(routes, /PermissionAction\.CREATE/);
  assert.match(routes, /PermissionAction\.EDIT/);
  assert.match(routes, /PermissionAction\.APPROVE/);
  assert.match(routes, /PermissionAction\.EXPORT/);
  assert.match(permissions, /\/accreditation\\\/scopes\\\//);
  assert.match(routes, /\/accreditation\/scopes\/:scopeId\/trust/);
});

test("existing tenant accreditation roles have a guarded migration", () => {
  const migration = read("server/scripts/migrate-accreditation-role-matrix.ts");
  const manifest = read("package.json");
  assert.match(manifest, /migrate:accreditation-role-matrix/);
  assert.match(migration, /Module\.COMPLIANCE/);
  assert.match(migration, /Dry run only/);
  assert.match(migration, /approvedPlan !== planHash/);
  assert.match(migration, /migrationbackups/);
  assert.match(migration, /Policy drift/);
  assert.match(migration, /activeSessions: \[\]/);
});

test("campus scope uses live campus options rather than static identifiers", () => {
  const search = read("server/routes/search.routes.ts");
  assert.match(search, /\| "campuses"/);
  assert.match(search, /CampusModel\.find/);
  assert.match(search, /campuses: optionsCampuses/);
});
