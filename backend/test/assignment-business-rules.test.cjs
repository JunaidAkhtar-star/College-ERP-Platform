const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateAssignmentGrade } = require("../build/services/assignment.service.js");

test("applies assignment late penalty before deriving the grade", () => {
  const result = calculateAssignmentGrade(80, 100, true, 10);
  assert.equal(result.rawMarks, 80);
  assert.equal(result.marks, 72);
  assert.equal(result.penaltyApplied, 10);
  assert.equal(result.grade, "A");
});

test("does not penalize on-time work and rejects invalid marks", () => {
  const result = calculateAssignmentGrade(80, 100, false, 25);
  assert.equal(result.marks, 80);
  assert.equal(result.penaltyApplied, 0);
  assert.equal(result.grade, "A+");
  assert.throws(() => calculateAssignmentGrade(101, 100, false, 0), /configured limits/);
  assert.throws(() => calculateAssignmentGrade(50, 100, true, 101), /configured limits/);
});
