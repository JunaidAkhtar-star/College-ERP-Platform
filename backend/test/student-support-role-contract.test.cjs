const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("placement drive reads reject unrelated authenticated roles", () => {
  const routes = read("routes/placement.routes.ts");
  assert.match(
    routes,
    /const placementViewers = requireRoles\(\[SUPER_ADMIN, PRINCIPAL, PLACEMENT_CELL, STUDENT\]\)/,
  );
  assert.match(routes, /router\.get\("\/", authenticate, placementViewers/);
  assert.match(routes, /"\/:id"[\s\S]*?placementViewers,[\s\S]*?placementController\.getById/);
});

test("mentor lists use active role and department ownership", () => {
  const controller = read("controllers/mentor.controller.ts");
  assert.match(
    controller,
    /req\.activeRole === SystemRole\.FACULTY\) filter\.facultyId = req\.user!\._id/,
  );
  assert.match(controller, /applyDepartmentScope\(req, filter\)/);
  assert.doesNotMatch(controller, /req\.user!\.roles/);
});

test("mentor detail and assignment operations repeat ownership checks", () => {
  const routes = read("routes/mentor.routes.ts");
  const controller = read("controllers/mentor.controller.ts");
  const service = read("services/mentor.service.ts");
  assert.match(routes, /requireRoles\(\[SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT\]\)/);
  assert.match(routes, /"\/my", authenticate, requireRoles\(\[STUDENT\]\)/);
  assert.match(routes, /"\/:id\/mentees"[\s\S]*?mentorController\.syncMentees/);
  assert.match(controller, /assertMentorAccess\(req/);
  assert.match(service, /Mentor and student must belong to the same department/);
  assert.match(service, /syncMentees: async/);
});

test("scholarship API separates review approval and disbursement roles", () => {
  const routes = read("routes/scholarship.routes.ts");
  assert.match(routes, /"\/:id\/review"[\s\S]*?requireRoles\(\[SCHOLARSHIP_CELL\]\)/);
  assert.match(routes, /"\/:id\/approve"[\s\S]*?requireRoles\(\[SUPER_ADMIN, PRINCIPAL\]\)/);
  assert.match(routes, /"\/:id\/disburse"[\s\S]*?requireRoles\(\[ACCOUNTS_DEPARTMENT\]\)/);
});
