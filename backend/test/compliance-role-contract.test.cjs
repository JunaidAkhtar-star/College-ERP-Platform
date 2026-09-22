const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = read("routes/compliance-workspace.routes.ts");
const controller = read("controllers/compliance-workspace.controller.ts");
const service = read("services/compliance-workspace.service.ts");

test("compliance read configure contribute review and Tally roles are separate", () => {
  for (const contract of ["readers", "editors", "contributors", "reviewers", "tallyEditors"]) {
    assert.match(routes, new RegExp(`const ${contract} = requirePermission`));
  }
  assert.match(routes, /"\/submissions"[\s\S]*?contributors[\s\S]*?createSubmission/);
  assert.match(routes, /"\/submissions\/:id\/review"[\s\S]*?reviewers/);
  assert.match(routes, /"\/tally\/export"[\s\S]*?tallyEditors/);
});

test("compliance years filters submissions reviews and Tally inputs are validated", () => {
  assert.match(routes, /const academicYearQuery = \(\) =>/);
  assert.match(routes, /body\("status"\)\.isIn\(\["in_progress", "submitted"\]\)/);
  assert.match(routes, /body\("status"\)\.isIn\(\["approved", "non_compliant"\]\)/);
  assert.match(routes, /body\("financialYear"\)\.matches/);
  assert.match(routes, /query\("financialYear"\)\.matches/);
});

test("compliance records are department scoped immutable after submission and independently reviewed", () => {
  assert.match(controller, /await applyDepartmentScope\([\s\S]*?"departmentId"/);
  assert.match(controller, /const departmentId = await getDepartmentScope\(req\)/);
  assert.match(service, /Submitted or approved compliance records are immutable/);
  assert.match(service, /Compliance requirement is immutable/);
  assert.match(service, /Compliance academic year is immutable/);
  assert.match(service, /Only submitted compliance records can be reviewed/);
  assert.match(service, /Compliance review requires an independent reviewer/);
});

test("compliance reads never seed static frameworks or requirement records", () => {
  assert.doesNotMatch(service, /starterFrameworks|ensureStarterFrameworks/);
  assert.doesNotMatch(service, /estimatedDocumentCount\(\)|insertMany\(\[/);
  assert.doesNotMatch(service, /AICTE-FSR|D-FORM-1|BPUT Statutory Reporting/);
});
