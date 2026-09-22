const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AssessmentScoreLedgerModel,
  GradebookStatus,
} = require("../build/models/assessment-gradebook.model.js");

test("gradebook supports correction without weakening frozen state", () => {
  assert.equal(GradebookStatus.RETURNED, "returned");
  assert.ok(AssessmentScoreLedgerModel.schema.path("reviewNote"));
  assert.ok(AssessmentScoreLedgerModel.schema.path("frozenAt"));
});

test("policy snapshots retain result and grade configuration", () => {
  assert.ok(AssessmentScoreLedgerModel.schema.path("policySnapshot.resultTarget"));
  assert.ok(AssessmentScoreLedgerModel.schema.path("policySnapshot.minimumTotalMarks"));
  assert.ok(AssessmentScoreLedgerModel.schema.path("policySnapshot.gradeScale"));
});
