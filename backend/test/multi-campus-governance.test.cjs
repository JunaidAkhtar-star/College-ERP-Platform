const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("campus hierarchy is tenant-local, auditable, and cycle bounded", () => {
  const model = read("server/models/campus-governance.model.ts");
  const service = read("server/services/campus-governance.service.ts");
  assert.match(model, /auditPlugin/);
  assert.match(model, /parentCampusId/);
  assert.match(service, /A campus cannot be its own parent/);
  assert.match(service, /Campus hierarchy cannot contain a cycle/);
  assert.match(service, /Campus hierarchy cannot exceed ten levels/);
});

test("campus scope can narrow access but cannot widen it", () => {
  const scope = read("server/utils/campus-scope.util.ts");
  const controller = read("server/controllers/campus-governance.controller.ts");
  assert.match(scope, /X-Campus-ID/i);
  assert.match(scope, /A campus assignment is required for this role/);
  assert.match(scope, /assertCampusAccess/);
  assert.match(controller, /getCampusScope/);
  assert.match(controller, /for \(const id of req\.body\.consumerCampusIds\)/);
});

test("calendar inheritance and shared services enforce governance rules", () => {
  const service = read("server/services/campus-governance.service.ts");
  assert.match(service, /while \(parentId && depth\+\+ < 10\)/);
  assert.match(service, /inheritedFromParent/);
  assert.match(service, /Select at least one different consumer campus/);
  assert.match(service, /Active shared-service owner not found/);
  assert.match(service, /createdBy: \{ \$ne: actorId \}/);
  assert.match(service, /independent approver/);
  assert.match(service, /Academic year must use YYYY-YY format/);
});

test("campus governance uses dynamic action permissions", () => {
  const routes = read("server/routes/campus-governance.routes.ts");
  for (const action of ["VIEW", "CREATE", "EDIT", "APPROVE", "DELETE"])
    assert.match(routes, new RegExp(`PermissionAction\\.${action}`));
  assert.match(routes, /requirePermission\(Module\.USER_MANAGEMENT/);
  assert.doesNotMatch(routes, /requireRoles|SystemRole/);
});

test("migration creates a recoverable default campus and campus-scoped department code", () => {
  const migration = read("server/scripts/migrate-multi-campus.ts");
  const department = read("server/models/department.model.ts");
  assert.match(migration, /code: "MAIN"/);
  assert.match(migration, /departments\.updateMany/);
  assert.match(migration, /dropIndex/);
  assert.match(department, /campusId: 1, code: 1.*unique: true/);
});

test("multi-campus governance has an explicit commercial entitlement and add-on", () => {
  const entitlements = read("server/constants/module-entitlements.ts");
  const catalogue = read("server/scripts/data/platform-catalog.ts");
  assert.match(entitlements, /"campus-governance": "multi-campus-governance"/);
  assert.match(catalogue, /slug: "multi-campus-governance"/);
  assert.match(catalogue, /slug: "multi-campus-governance-addon"/);
});
