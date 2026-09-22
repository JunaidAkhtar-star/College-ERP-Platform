const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("non-sensitive student views exclude identity documents and admission records", () => {
  const service = read("services/student-profile.service.ts");
  assert.match(service, /"documents"/);
  assert.match(service, /"admissionApplicationId"/);
  assert.match(service, /redactStudentProfile/);
});

test("student self endpoints require the student active role", () => {
  const routes = read("routes/student-profile.routes.ts");
  assert.match(routes, /"\/me",\s*auth,\s*requireRoles\(\[SystemRole\.STUDENT\]\)/);
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/me",\s*auth,\s*requireRoles\(\[SystemRole\.STUDENT\]\)/,
  );
});

test("registration-number officers can access the governed student directory", () => {
  const routes = read("routes/student-profile.routes.ts");
  const staff = routes.match(/const staff = requireRoles\([\s\S]*?\);/)?.[0] ?? "";
  assert.match(staff, /SystemRole\.ASSISTANT_ADMINISTRATION_OFFICER/);
  assert.match(staff, /SystemRole\.ADMISSION_INCHARGE/);
});

test("student statistics use the same department ownership boundary as the directory", () => {
  const controller = read("controllers/student-profile.controller.ts");
  const service = read("services/student-profile.service.ts");
  assert.match(controller, /getStats:[\s\S]*?applyDepartmentScope\(req, \{\}, "department"\)/);
  assert.match(service, /getStats: async \(filter: Record<string, unknown> = \{\}\)/);
  assert.match(service, /StudentProfileModel\.countDocuments\(filter\)/);
  assert.match(service, /passedOut: counts\.get\(StudentStatus\.PASSED_OUT\)/);
});
