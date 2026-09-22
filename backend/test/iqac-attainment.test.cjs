const assert = require("node:assert/strict");
const test = require("node:test");
const {
  attainmentLevelFromPercentage,
  calculateWeightedAttainment,
  normalizeIqacFeedback,
} = require("../build/services/iqac.service.js");

test("calculates weighted direct and indirect OBE attainment", () => {
  assert.equal(calculateWeightedAttainment(75, 50, 80, 20), 70);
  assert.equal(attainmentLevelFromPercentage(70), 3);
  assert.equal(attainmentLevelFromPercentage(69.99), 2);
  assert.throws(() => calculateWeightedAttainment(75, 50, 70, 20), /weights are invalid/);
});

test("allows students to submit governed course-exit ratings", () => {
  const normalized = normalizeIqacFeedback(
    {
      academicYear: "2026-27",
      semesterType: "odd",
      feedbackType: "student_course_exit",
      targetId: "507f1f77bcf86cd799439011",
      ratings: [
        { criterion: "CO1", score: 4 },
        { criterion: "CO2", score: 5 },
      ],
      respondentId: "507f1f77bcf86cd799439012",
    },
    ["student"],
  );
  assert.equal(normalized.feedbackType, "student_course_exit");
  assert.equal(normalized.averageScore, 4.5);
});
