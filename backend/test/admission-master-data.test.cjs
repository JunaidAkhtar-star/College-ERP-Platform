const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("admission programmes are validated from active curriculum master data", () => {
  const service = read("server/services/admission.service.ts");
  const model = read("server/models/admission-application.model.ts");
  assert.match(service, /activeAdmissionPrograms/);
  assert.match(service, /openForAdmissions: true/);
  assert.doesNotMatch(model, /export enum AcademicProgram/);
  assert.doesNotMatch(
    model,
    /programPreferences:[\s\S]{0,100}enum: Object\.values\(AcademicProgram\)/,
  );
});

test("enrollment resolves department through the active curriculum", () => {
  const service = read("server/services/admission.service.ts");
  assert.match(service, /CurriculumModel\.findOne\(\{ program, isActive: true \}\)/);
  assert.match(service, /curriculumIds: curriculum\._id/);
});

test("academic year options combine live academic and admission records", () => {
  const search = read("server/routes/search.routes.ts");
  assert.match(search, /SectionModel\.distinct\("academicYear",\s*structureFilter\)/);
  assert.match(search, /AdmissionApplicationModel\.distinct\("academicYear"\)/);
  assert.match(search, /BatchModel\.distinct\("admissionYear",\s*structureFilter\)/);
});

test("admission branch preference is optional and constrained by programme curriculum", () => {
  const service = read("server/services/admission.service.ts");
  const model = read("server/models/admission-application.model.ts");
  const search = read("server/routes/search.routes.ts");
  const routes = read("server/routes/admission.routes.ts");
  assert.match(model, /preferredDepartmentId.*ref: "Department"/);
  assert.match(service, /validatePreferredDepartment/);
  assert.match(service, /Selected branch is not available for this programme/);
  assert.match(search, /params\?\.\["program"\]/);
  assert.match(search, /curriculumIds: \{ \$in: curriculumIds \}/);
  assert.match(routes, /optional\(\{ nullable: true, checkFalsy: true \}\)/);
});

test("admission initiation reports email intent and returns one-time credentials", () => {
  const service = read("server/services/admission.service.ts");
  assert.match(service, /const credentialsEmailRequested = Boolean/);
  assert.match(service, /tempPassword,\n\s+credentialsEmailRequested/);
  assert.doesNotMatch(service, /NODE_ENV !== "production" \? tempPassword/);
});

test("enrollment records its authoritative completion timestamp", () => {
  const service = read("server/services/admission.service.ts");
  const model = read("server/models/admission-application.model.ts");
  assert.match(model, /enrolledAt.*Date/);
  assert.match(service, /application\.enrolledAt = new Date\(\)/);
});
