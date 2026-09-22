const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateGrade,
  examDurationMinutes,
  examSlotsOverlap,
} = require("../build/services/examination.service.js");

test("enforces configured marks maximums and component pass rules", () => {
  const grade = calculateGrade({
    internalTotal: 24,
    internalMax: 30,
    externalMarks: 56,
    externalMax: 70,
  });
  assert.equal(grade.totalMarks, 80);
  assert.equal(grade.gradeLetter, "A+");
  assert.equal(grade.isPassed, true);
  assert.throws(
    () =>
      calculateGrade({ internalTotal: 31, internalMax: 30, externalMarks: 50, externalMax: 70 }),
    /within the configured/,
  );
});

test("requires both internal and external pass minimums", () => {
  const grade = calculateGrade({
    internalTotal: 10,
    internalMax: 30,
    externalMarks: 60,
    externalMax: 70,
  });
  assert.equal(grade.gradePoint > 0, true);
  assert.equal(grade.isPassed, false);
});

test("derives exam duration from valid ordered times", () => {
  assert.equal(examDurationMinutes("09:30", "12:30"), 180);
  assert.throws(() => examDurationMinutes("12:30", "09:30"), /follow start/);
  assert.throws(() => examDurationMinutes("bad", "12:30"), /HH:mm/);
});

test("detects exact and partial exam resource overlaps but allows adjacent slots", () => {
  assert.equal(
    examSlotsOverlap(
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "11:30", endTime: "13:00" },
    ),
    true,
  );
  assert.equal(
    examSlotsOverlap(
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "12:00", endTime: "15:00" },
    ),
    false,
  );
});
