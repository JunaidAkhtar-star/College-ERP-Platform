const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");
const routes = read("server/routes/iqac.routes.ts");
const controller = read("server/controllers/iqac.controller.ts");
const service = read("server/services/iqac.service.ts");

test("IQAC feedback authorizes only the active role and validates business inputs", () => {
  assert.match(controller, /\[\s*String\(req\.activeRole\),?\s*\]/);
  assert.doesNotMatch(controller, /req\.user!\.roles as string\[\]/);
  assert.match(routes, /body\("ratings\.\*\.score"\)\.isInt\(\{ min: 1, max: 5 \}\)/);
  assert.match(service, /This feedback type requires a valid target/);
});

test("HOD audit reads are department scoped including direct record access", () => {
  assert.match(controller, /applyDepartmentScope\(req, filter\)/);
  assert.match(controller, /assertDepartmentAccess\(req, data\.departmentId\)/);
});

test("IQAC query endpoints require academic year and governed filters", () => {
  assert.match(routes, /const academicYear = query\("academicYear"\)/);
  assert.match(routes, /query\("feedbackType"\)\.isIn\(feedbackTypes\)/);
  assert.match(routes, /query\("subjectId"\)\.isMongoId\(\)/);
});
