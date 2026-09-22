const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("timetable read routes admit only configured timetable roles", () => {
  const routes = read("routes/timetable.routes.ts");
  assert.match(
    routes,
    /const TIMETABLE_VIEWERS = \[\.\.\.TIMETABLE_EDITORS, FACULTY, STUDENT, PARENT\]/,
  );
  assert.match(routes, /requireRoles\(TIMETABLE_VIEWERS\),\s*timetableController\.list/);
  assert.match(
    routes,
    /requireRoles\(\[\.\.\.TIMETABLE_EDITORS, FACULTY\]\),\s*timetableController\.getFacultyTimetable/,
  );
  assert.doesNotMatch(routes, /"\/auto-generate"/);
});

test("faculty, student, and parent timetable lists are ownership scoped", () => {
  const controller = read("controllers/timetable.controller.ts");
  assert.match(
    controller,
    /req\.activeRole === SystemRole\.FACULTY[\s\S]*?"slots\.facultyId": req\.user!\._id/,
  );
  assert.match(controller, /SystemRole\.STUDENT \|\| req\.activeRole === SystemRole\.PARENT/);
  assert.match(controller, /parentService\.getWard/);
  assert.match(controller, /findCurrentActiveForStudent/);
  assert.match(controller, /studentProfileRepository\.findByUserId/);
  assert.match(controller, /sectionId: \{ \$exists: false \}/);
  assert.match(controller, /currentSemester/);
  assert.match(controller, /await timetableViewerFilter\(req\)/);
});

test("section and whole-cohort timetable planning is transactional and editor restricted", () => {
  const routes = read("routes/timetable.routes.ts");
  const service = read("services/timetable.service.ts");
  assert.match(routes, /"\/batch"[\s\S]*body\("sectionIds"\)\.optional\(\)\.isArray/);
  assert.match(routes, /body\("directScopes"\)\.optional\(\)\.isArray/);
  assert.match(routes, /timetableController\.createBatch/);
  assert.match(service, /createBatch: async/);
  assert.match(service, /Select sections or add at least one direct academic scope/);
  assert.match(service, /withTimetableLocks\(keys/);
});

test("direct detail and class reads repeat viewer ownership checks", () => {
  const controller = read("controllers/timetable.controller.ts");
  assert.match(controller, /getById:[\s\S]*?assertTimetableViewerAccess\(req/);
  assert.match(controller, /getForClass:[\s\S]*?assertTimetableViewerAccess\(req/);
});

test("HOD timetable reads include combined timetables that contain their department", () => {
  const controller = read("controllers/timetable.controller.ts");
  assert.match(
    controller,
    /applyTimetableDepartmentVisibility[\s\S]*?\$or: \[\{ departmentId \}, \{ branchDepartmentIds: departmentId \}\]/,
  );
  assert.match(
    controller,
    /assertTimetableDepartmentVisibility[\s\S]*?participatingDepartmentIds\.includes\(departmentId\)/,
  );
  assert.match(controller, /list:[\s\S]*?applyTimetableDepartmentVisibility\(req/);
  assert.match(controller, /getById:[\s\S]*?assertTimetableDepartmentVisibility/);
});

test("multi-department section lookups are safely intersected with HOD ownership", () => {
  const ownership = read("utils/ownership.util.ts");
  const sectionController = read("controllers/section.controller.ts");
  assert.match(sectionController, /departmentIds[\s\S]*?\$in:/);
  assert.match(ownership, /"\$in" in requestedScope/);
  assert.match(ownership, /requestedIds\.includes\(departmentId\)/);
  assert.match(ownership, /return \{ \.\.\.filter, \[field\]: departmentId \}/);
});

test("faculty attendance schedules include combined timetables containing their department", () => {
  const repository = read("repositories/timetable.repository.ts");
  assert.match(
    repository,
    /getFacultyTimetable:[\s\S]*?\$or: \[\{ departmentId \}, \{ branchDepartmentIds: departmentId \}\]/,
  );
});

test("operational classes govern replacements, extra classes, and notifications", () => {
  const routes = read("routes/timetable.routes.ts");
  const service = read("services/timetable.service.ts");
  const attendance = read("services/attendance.service.ts");
  const operationModel = read("models/class-operation.model.ts");
  assert.match(routes, /"\/:id\/substitute\/:substituteEntryId\/cancel"/);
  assert.match(routes, /"\/:id\/extra-class"/);
  assert.match(routes, /"\/:id\/class-operations"/);
  assert.match(service, /is absent or on approved leave for this date/);
  assert.match(service, /notifyStudentsByClass/);
  assert.match(service, /Substitute class assigned/);
  assert.match(service, /Extra class scheduled/);
  assert.match(attendance, /isActiveSubstitute/);
  assert.match(operationModel, /"scheduled" \| "cancelled" \| "completed"/);
});

test("faculty workload exposes dated operational adjustments", () => {
  const routes = read("routes/faculty-workload.routes.ts");
  const service = read("services/faculty-workload.service.ts");
  assert.match(routes, /"\/:id\/operational-summary"/);
  assert.match(service, /substituteTakenMinutes/);
  assert.match(service, /substituteReleasedMinutes/);
  assert.match(service, /extraClassMinutes/);
  assert.match(service, /netOperationalMinutes/);
});
