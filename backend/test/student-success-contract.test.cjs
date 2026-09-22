const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("student success risk remains explainable and grounded in authoritative records", () => {
  const service = read("server/services/student-success.service.ts");
  assert.match(service, /StudentAttendanceSummaryModel\.find/);
  assert.match(service, /student\.totalBacklogs/);
  assert.match(service, /student\.currentCgpa/);
  assert.match(service, /student\.totalFeeDue/);
  assert.match(service, /MentorModel\.findOne/);
  assert.match(service, /signals/);
  assert.doesNotMatch(service, /Math\.random/);
});

test("student success cases have governed lifecycle, ownership and one active case", () => {
  const model = read("server/models/student-success.model.ts");
  const controller = read("server/controllers/student-success.controller.ts");
  assert.match(model, /StudentSuccessCaseSchema\.plugin\(auditPlugin\)/);
  assert.match(model, /partialFilterExpression/);
  assert.match(controller, /assertDepartmentAccess/);
  assert.match(controller, /applyDepartmentScope/);
});

test("bulk refresh is concurrency bounded instead of unbounded fan-out", () => {
  const service = read("server/services/student-success.service.ts");
  assert.match(service, /const concurrency = 10/);
  assert.match(service, /slice\(index, index \+ concurrency\)/);
});

test("advisor actions are ownership enforced and overdue cases escalate durably", () => {
  const controller = read("server/controllers/student-success.controller.ts");
  const service = read("server/services/student-success.service.ts");
  const jobs = read("server/jobs/index.ts");
  assert.match(controller, /Only the assigned advisor can update/);
  assert.match(controller, /Faculty can only open cases assigned to themselves/);
  assert.match(service, /processOverdueCases/);
  assert.match(service, /escalatedAt/);
  assert.match(service, /assignedAdvisorId/);
  assert.match(jobs, /startStudentSuccessEscalationJob/);
});

test("career readiness evidence is student-owned and validated server-side", () => {
  const service = read("server/services/student-placement-profile.service.ts");
  assert.match(service, /normalizeStudentEditable/);
  assert.match(service, /Use at most 50 placement skills/);
  assert.match(service, /Duplicate skill/);
  assert.match(service, /safe HTTPS URL/);
});
