const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = read("routes/leave.routes.ts");
const controller = read("controllers/leave.controller.ts");
const service = read("services/leave.service.ts");
const roles = read("constants/roles.ts");

test("leave self-service is employee-only while approval stages remain distinct", () => {
  assert.match(routes, /requireRoles\(EMPLOYEE_ROLES\)/);
  assert.match(roles, /export const EMPLOYEE_ROLES: SystemRole\[\] = \[/);
  assert.doesNotMatch(
    roles.slice(roles.indexOf("export const EMPLOYEE_ROLES"), roles.indexOf("export const ADMISSION_ROLES")),
    /SystemRole\.(?:STUDENT|PARENT)/,
  );
  assert.match(routes, /"\/:id\/hod-approve"[\s\S]*?requireRoles\(\[SUPER_ADMIN, HOD\]\)/);
  assert.match(routes, /"\/:id\/approve"[\s\S]*?requireRoles\(\[SUPER_ADMIN, PRINCIPAL\]\)/);
});

test("leave inputs IDs filters rejection reasons and academic year are validated", () => {
  assert.match(routes, /query\("academicYear"\)[\s\S]*?\.matches/);
  assert.match(routes, /query\("employeeId"\)\.optional\(\)\.isMongoId\(\)/);
  assert.match(routes, /body\("leaveType"\)\.isIn/);
  assert.match(routes, /body\("fromDate"\)\.isISO8601/);
  assert.match(
    routes,
    /body\("reason"\)[\s\S]*?\.isString\(\)[\s\S]*?\.trim\(\)[\s\S]*?\.isLength\(\{ min: 3, max: 500 \}\)/,
  );
});

test("leave ownership and workflow transitions are enforced server-side", () => {
  assert.match(controller, /You can access only your own leave requests/);
  assert.match(controller, /await applyDepartmentScope\(req, filter\)/);
  assert.match(controller, /await assertDepartmentAccess\(req, existing\.departmentId\)/);
  assert.match(service, /status: "pending", hodApproval: "pending"/);
  assert.match(service, /status: "pending", hodApproval: "approved", adminApproval: "pending"/);
  assert.match(service, /Only your own unreviewed leave can be cancelled/);
});
