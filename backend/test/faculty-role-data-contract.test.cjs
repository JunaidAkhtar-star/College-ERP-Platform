const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("faculty directory and statistics use active-role department ownership", () => {
  const controller = read("controllers/faculty-profile.controller.ts");
  const service = read("services/faculty-profile.service.ts");
  assert.match(controller, /list:[\s\S]*?applyDepartmentScope\(req, query, "departmentId"\)/);
  assert.match(controller, /getById:[\s\S]*?assertDepartmentAccess\(req, data\.department\)/);
  assert.match(controller, /getStats:[\s\S]*?getDepartmentScope\(req\)/);
  assert.match(service, /getStats: async \(matchFilter: Record<string, unknown> = \{\}\)/);
});

test("faculty self-service endpoints require a faculty identity", () => {
  const routes = read("routes/faculty-profile.routes.ts");
  assert.match(routes, /"\/me",[\s\S]*?requireRoles\(\[SystemRole\.FACULTY, SystemRole\.HOD\]\)/);
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/me",[\s\S]*?requireRoles\(\[SystemRole\.FACULTY, SystemRole\.HOD\]\)/,
  );
  assert.match(routes, /router\.delete\([\s\S]*?hrAdm,\s*facultyProfileController\.remove/);
});

test("workload reads reject unrelated roles and use active role for scope", () => {
  const routes = read("routes/faculty-workload.routes.ts");
  const controller = read("controllers/faculty-workload.controller.ts");
  assert.match(routes, /router\.get\("\/", authenticate, viewers/);
  assert.match(routes, /authenticate,\s*viewers,\s*facultyWorkloadController\.getById/);
  assert.match(controller, /req\.activeRole === SystemRole\.FACULTY/);
  assert.match(controller, /req\.activeRole === SystemRole\.HOD/);
  assert.match(controller, /const isLeadership = \[[\s\S]*?SystemRole\.SUPER_ADMIN/);
});

test("workload updates and department summaries enforce department ownership", () => {
  const controller = read("controllers/faculty-workload.controller.ts");
  assert.match(controller, /update:[\s\S]*?assertDepartmentAccess\(req, current\.departmentId\)/);
  assert.match(controller, /getDepartmentSummary:[\s\S]*?getDepartmentScope\(req\)/);
  assert.match(controller, /scopedDepartmentId \?\? \(departmentId as string\)/);
});

test("workload assignments reject fabricated or incomplete academic context", () => {
  const service = read("services/faculty-workload.service.ts");
  assert.match(service, /Assignment programme is required/);
  assert.match(service, /Assignment semester is invalid/);
  assert.match(service, /Assignment section is required/);
  assert.match(service, /Assignment total hours are invalid/);
});

test("faculty workload lifecycle grants self-service access and sends targeted notifications", () => {
  const defaults = read("constants/role-defaults.ts");
  const service = read("services/faculty-workload.service.ts");
  const notificationModel = read("models/notification.model.ts");
  assert.match(
    defaults,
    /\[SystemRole\.FACULTY\]: map\([\s\S]*?\[M\.FACULTY_WORKLOAD\]: VIEW_ONLY/,
  );
  assert.match(defaults, /\[SystemRole\.HOD\]: map\([\s\S]*?\[M\.FACULTY_WORKLOAD\]: VIEW_EDIT,/);
  assert.match(notificationModel, /WORKLOAD = "Workload"/);
  assert.match(service, /notifyFacultySafely\(created, "assigned", createdBy\)/);
  assert.match(service, /notifyFacultySafely\(updated, "updated", updatedBy\)/);
  assert.match(service, /notifyFacultySafely\(approved, "approved", approverId\)/);
  assert.match(service, /NotificationAudience\.SPECIFIC_USER/);
  assert.match(service, /NotificationChannel\.IN_APP/);
  assert.match(service, /NotificationChannel\.EMAIL/);
  assert.match(service, /NotificationChannel\.PUSH/);
});
