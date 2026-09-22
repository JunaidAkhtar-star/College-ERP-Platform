const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = read("routes/hr.routes.ts");
const repository = read("repositories/hr.repository.ts");

test("HR organization view edit and termination role contracts are distinct", () => {
  assert.match(routes, /const hrAdmin = requireRoles\([\s\S]*?SystemRole\.ADMIN[\s\S]*?SystemRole\.HR_DEPARTMENT/);
  assert.match(routes, /const hrMonitors = requireRoles\([\s\S]*?SystemRole\.ADMINISTRATION_OFFICE/);
  assert.match(routes, /const anyStaff = requireRoles\(EMPLOYEE_ROLES\)/);
  assert.match(routes, /requireRoles\(\[SystemRole\.SUPER_ADMIN, SystemRole\.ADMIN, SystemRole\.PRINCIPAL\]\)/);
});

test("HR create update and list contracts validate the model employment types", () => {
  for (const value of ["permanent", "contractual", "visiting", "adhoc", "guest_faculty"]) {
    assert.match(routes, new RegExp(`"${value}"`));
  }
  assert.doesNotMatch(routes, /"(?:full_time|part_time|contract|temporary|guest)"/);
  assert.match(routes, /body\("dateOfJoining"\)\.isISO8601\(\)/);
  assert.match(routes, /query\("page"\)\.optional\(\)\.isInt/);
  assert.match(routes, /query\("limit"\)\.optional\(\)\.isInt/);
});

test("HR list analytics are calculated across the filtered result not the current page", () => {
  assert.match(repository, /HrEmployeeModel\.countDocuments\(activeFilter\)/);
  assert.match(repository, /HrEmployeeModel\.countDocuments\(permanentFilter\)/);
  assert.match(repository, /summary: \{ total, active, permanent \}/);
});
