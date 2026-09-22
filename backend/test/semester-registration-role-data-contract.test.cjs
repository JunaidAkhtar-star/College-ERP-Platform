const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "..", "server/services/semester-registration.service.ts"),
  "utf8",
);

test("registration context derives outstanding backlogs from published results", () => {
  assert.match(source, /SemesterResultModel\.find\(\{ studentId, isPublished: true \}\)/);
  assert.match(source, /const passedCodes = new Set/);
  assert.match(source, /const failedCodes = new Set/);
  assert.match(source, /failedCodes\.has\(code\) && !passedCodes\.has\(code\)/);
  assert.match(source, /isBacklogEligible: true/);
});

test("registration notifications target the registration approval permission", () => {
  assert.match(
    source,
    /notifyByPermission\(Module\.SEMESTER_REGISTRATION, PermissionAction\.APPROVE/,
  );
  assert.doesNotMatch(source, /notifyByPermission\(Module\.STUDENT_PROFILE/);
});

test("submitted subjects remain server-authoritative", () => {
  assert.match(source, /Mandatory subjects cannot be omitted/);
  assert.match(source, /Exactly one elective must be selected/);
  assert.match(source, /is not an outstanding published backlog/);
  assert.match(source, /subjectCode: planned\.subjectCode/);
});
