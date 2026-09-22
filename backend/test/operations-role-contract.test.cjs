const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("notice mutation and management-list routes require active managers", () => {
  const routes = read("routes/notice.routes.ts");
  assert.match(routes, /const canManage = requireAnyPermission/);
  assert.match(routes, /router\.get\([\s\S]*?"\/",[\s\S]*?canManage/);
  assert.match(routes, /router\.post\([\s\S]*?"\/",[\s\S]*?canCreate/);
  assert.match(routes, /"\/:id\/publish"[\s\S]*?canApprove/);
});

test("notice audience checks use active role and protect direct reads", () => {
  const controller = read("controllers/notice.controller.ts");
  assert.match(controller, /const roles = req\.activeRole \? \[String\(req\.activeRole\)\] : \[\]/);
  assert.match(controller, /await assertNoticeVisible\(req, data/);
  assert.match(controller, /markRead:[\s\S]*?await assertNoticeVisible\(req, notice/);
  assert.doesNotMatch(controller, /req\.user!\.roles/);
  assert.match(controller, /profile\?\.program \? \[String\(profile\.program\)\] : \[\]/);
});

test("payroll direct detail route admits only payroll staff or faculty self-service", () => {
  const routes = read("routes/payroll.routes.ts");
  const controller = read("controllers/payroll.controller.ts");
  assert.match(
    routes,
    /requireRoles\(\[SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT, FACULTY\]\),\s*payrollController\.getById/,
  );
  assert.match(controller, /assertOwnPayroll\(req, data\.employeeId\)/);
});

test("grievance direct reads and staff actions enforce ownership", () => {
  const controller = read("controllers/grievance.controller.ts");
  assert.match(controller, /You can access only your own grievances/);
  assert.match(controller, /await assertGrievanceAccess\(req, existing\)/);
  assert.match(controller, /applyDepartmentScope\(req, filter\)/);
});
