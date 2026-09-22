const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = read("routes/naac-nba.routes.ts");
const controller = read("controllers/naac-nba.controller.ts");
const service = read("services/naac-nba.service.ts");
const repository = read("repositories/naac-nba.repository.ts");

test("NAAC and NBA list and mutation inputs are validated", () => {
  assert.match(routes, /query\("academicYear"\)\.matches\(\/\^\\d\{4\}-\\d\{2\}\$\//);
  assert.match(routes, /body\("metricNo"\)\.matches/);
  assert.match(routes, /body\("reviewNotes"\)[\s\S]*?\.isLength\(\{ min: 5, max: 2000 \}\)/);
  assert.match(routes, /body\("programId"\)\.isMongoId\(\)/);
  assert.match(routes, /body\("coAttainments"\)\.isArray\(\{ min: 1, max: 100 \}\)/);
});

test("faculty evidence and departmental NBA reads are server scoped", () => {
  assert.match(controller, /req\.activeRole === SystemRole\.FACULTY/);
  assert.match(controller, /You can access only your own evidence/);
  assert.match(controller, /await applyDepartmentScope\(req, filter\)/);
  assert.match(controller, /await assertDepartmentAccess\(req, report\.departmentId\)/);
  assert.match(controller, /const departmentId = await getDepartmentScope\(req\)/);
});

test("NAAC evidence and NBA reports require independent approval and immutable approved state", () => {
  assert.match(service, /Only the owner can edit evidence/);
  assert.match(service, /Evidence requires an independent reviewer/);
  assert.match(service, /Only submitted evidence can be reviewed/);
  assert.match(service, /NBA reports require an independent approver/);
  assert.match(service, /Approved reports are immutable/);
});

test("NBA report entities and calculated attainment are authoritative", () => {
  assert.match(service, /Active program must belong to the selected department/);
  assert.match(service, /Program label does not match the selected program/);
  assert.match(
    service,
    /const finalAttainment = item\.directAttainment \* 0\.8 \+ item\.indirectAttainment \* 0\.2/,
  );
  assert.match(repository, /averageScore: \{ \$avg: "\$score" \}/);
  assert.match(repository, /poBreakdown:/);
  assert.match(repository, /averagePo:/);
});

test("accreditation exports enforce permission, academic-year, department, and CSV safety", () => {
  const exportRoutes = read("routes/compliance.routes.ts");
  const exportController = read("controllers/compliance.controller.ts");
  const exportService = read("services/compliance.service.ts");
  const routePermissions = read("constants/route-permissions.ts");

  assert.match(exportRoutes, /query\("academicYear"\)\.matches\(\/\^\\d\{4\}-\\d\{2\}\$\//);
  assert.match(routePermissions, /\/export\\\/naac-/);
  assert.match(routePermissions, /Module\.NAAC, action: PermissionAction\.EXPORT/);
  assert.match(routePermissions, /\/export\\\/nba-/);
  assert.match(routePermissions, /Module\.NBA, action: PermissionAction\.EXPORT/);
  assert.match(exportController, /await getDepartmentScope\(req\)/);
  assert.match(exportService, /academicYearRange\(academicYear\)/);
  assert.match(exportService, /academicYear,/);
  assert.match(exportService, /department: departmentId/);
  assert.match(exportService, /text\.replace\(\/"\/g, '""'\)/);
  assert.match(exportService, /\/\^\[=\+\\-@\]\//);
});
