const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = read("routes/admission.routes.ts");
const controller = read("controllers/admission.controller.ts");
const service = read("services/admission.service.ts");

test("admission operations decisions payments and enrollment have separate role contracts", () => {
  assert.match(routes, /ADMISSION_OPERATIONS_ROLES = \[\.\.\.ADMISSION_DECISION_ROLES, SystemRole\.ADMISSION_COUNSELOR\]/);
  assert.match(routes, /ADMISSION_PAYMENT_ROLES = \[[\s\S]*?SystemRole\.ACCOUNTS_DEPARTMENT/);
  assert.match(routes, /"\/applications\/:id\/decide"[\s\S]*?requireAnyRole\(ADMISSION_DECISION_ROLES\)/);
  assert.match(routes, /"\/applications\/:id\/payment\/review"[\s\S]*?requireAnyRole\(ADMISSION_PAYMENT_ROLES\)/);
  assert.match(routes, /"\/applications\/:id\/enroll"[\s\S]*?SystemRole\.ASSISTANT_ADMINISTRATION_OFFICER/);
});

test("admission year is validated for public apply initiation dashboard and bulk import", () => {
  assert.match(routes, /body\("academicYear"\)[\s\S]*?matches\(\/\^\\d\{4\}/);
  assert.match(routes, /"\/dashboard"[\s\S]*?query\("academicYear"\)\.matches/);
  assert.match(routes, /"\/bulk-import"[\s\S]*?query\("academicYear"\)[\s\S]*?\.matches/);
  assert.match(controller, /submitApplication\([\s\S]*?String\(req\.body\.academicYear\)/);
  assert.match(controller, /getDashboardStats\(String\(req\.query\.academicYear\)\)/);
  assert.match(controller, /const academicYear = String\(req\.query\.academicYear\)/);
});

test("admission initiation and bulk import do not silently choose the current academic year", () => {
  assert.match(service, /academicYear: string;/);
  assert.match(service, /const academicYear = data\.academicYear;/);
  assert.doesNotMatch(
    controller.slice(controller.indexOf("async bulkImport"), controller.indexOf("async updateMyOnboarding")),
    /new Date\(\)\.getFullYear/,
  );
  assert.doesNotMatch(
    service.slice(service.indexOf("async initiateApplication"), service.indexOf("await activeAdmissionPrograms")),
    /new Date\(\)\.getFullYear/,
  );
});
