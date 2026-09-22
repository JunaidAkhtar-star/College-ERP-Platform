const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverRoot = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(serverRoot, file), "utf8");

test("examination schedule reads enforce department ownership", () => {
  const controller = read("controllers/examination.controller.ts");

  assert.match(controller, /getSchedule:[\s\S]*?assertDepartmentAccess\(req, data\.departmentId\)/);
  assert.match(controller, /listSchedules:[\s\S]*?getScopedDepartmentCode\(req\)/);
  assert.match(controller, /filter\["subjects\.invigilators"\] = req\.user\?\._id/);
  assert.match(controller, /Faculty can access only their assigned examination schedules/);
  assert.doesNotMatch(
    controller,
    /getScopedDepartmentCode[\s\S]{0,100}activeRole !== SystemRole\.HOD/,
  );
});

test("marks entry excludes department viewers and preserves independent verification", () => {
  const routes = read("routes/examination.routes.ts");

  const markEditor = routes.match(/const markEditor = requireRoles\([\s\S]*?\);/)?.[0] ?? "";
  assert.match(markEditor, /SystemRole\.FACULTY/);
  assert.match(markEditor, /SystemRole\.EXAMINATION_CELL/);
  assert.doesNotMatch(markEditor, /SystemRole\.HOD/);
  assert.match(routes, /"\/marks",\s*auth,\s*markEditor/);
  assert.match(routes, /"\/marks\/verify",[\s\S]*?auth,\s*admin/);
});

test("department recheck queues use student ownership rather than roll-number guessing", () => {
  const controller = read("controllers/examination.controller.ts");
  const repository = read("repositories/student-profile.repository.ts");

  assert.match(repository, /findUserIdsByDepartment\(departmentId: string\)/);
  assert.match(controller, /filter\.studentId = \{[\s\S]*?findUserIdsByDepartment\(departmentId\)/);
  assert.doesNotMatch(controller, /filter\.rollNumber = \{ \$regex: departmentCode/);
});

test("student examination records remain restricted to the authenticated owner", () => {
  const controller = read("controllers/examination.controller.ts");

  assert.match(controller, /Students can access only their own examination records/);
  assert.match(controller, /assertStudentDepartmentAccess\(req, studentId\)/);
  assert.match(controller, /req\.activeRole === SystemRole\.STUDENT/);
});
