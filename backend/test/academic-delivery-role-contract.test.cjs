const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("course progress reads and writes retain faculty ownership", () => {
  const controller = read("controllers/course-progress.controller.ts");
  const service = read("services/course-progress.service.ts");
  assert.match(
    controller,
    /req\.activeRole === SystemRole\.FACULTY\) filter\.facultyId = req\.user!\._id/,
  );
  assert.match(controller, /Faculty can access only their course progress/);
  assert.match(service, /Only the assigned faculty can record course delivery/);
  assert.match(service, /Matching attendance evidence is required/);
});

test("lesson plan mutation routes separate faculty authors from reviewers", () => {
  const routes = read("routes/lesson-plan.routes.ts");
  assert.match(routes, /router\.put\([\s\S]*?requireRoles\(\[FACULTY\]\)/);
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/:id\/approve"[\s\S]*?requireRoles\(REVIEW_ROLES\)/,
  );
});

test("student assignments use authoritative active section allotment", () => {
  const controller = read("controllers/assignment.controller.ts");
  assert.match(controller, /findCurrentActiveForStudent/);
  assert.match(controller, /sectionId: allotment\.sectionId/);
  assert.match(controller, /String\(data\.sectionId\) !== String\(scope\["sectionId"\]\)/);
  assert.match(controller, /String\(assignment\.sectionId\) !== String\(scope\["sectionId"\]\)/);
  assert.doesNotMatch(controller, /StudentProfileModel\.findOne/);
});

test("assignment authoring supports teaching HODs without weakening ownership", () => {
  const routes = read("routes/assignment.routes.ts");
  const controller = read("controllers/assignment.controller.ts");
  const teachingStaff = routes.match(/requireRoles\(\[HOD, FACULTY\]\)/g) ?? [];
  assert.equal(teachingStaff.length, 4);
  assert.match(routes, /query\("scope"\)\.optional\(\)\.isIn\(\["mine", "department"\]\)/);
  assert.match(controller, /req\.activeRole === SystemRole\.HOD && req\.query\.scope === "mine"/);
  assert.match(controller, /assertTeachingAuthorOwnership\(req, existing\.facultyId, "update"\)/);
  assert.match(controller, /assertTeachingAuthorOwnership\(req, assignment\.facultyId, "grade"\)/);
});
