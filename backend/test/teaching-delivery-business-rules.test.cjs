const assert = require("node:assert/strict");
const test = require("node:test");
const { validateLessonPlanUnits } = require("../build/services/lesson-plan.service.js");
const { calculateCourseCompletion } = require("../build/services/course-progress.service.js");

const validUnits = () => [
  {
    unitNo: 1,
    unitTitle: "Foundations",
    plannedTopics: ["Variables", "Control flow"],
    plannedClasses: 3,
    plannedStartDate: "2026-07-20",
    plannedEndDate: "2026-07-25",
    coMappings: ["CO1"],
  },
  {
    unitNo: 2,
    unitTitle: "Data structures",
    plannedTopics: ["Arrays"],
    plannedClasses: 2,
    plannedStartDate: "2026-07-26",
    plannedEndDate: "2026-07-30",
    coMappings: ["CO2"],
  },
];

test("normalizes a valid ordered lesson plan", () => {
  const units = validateLessonPlanUnits(validUnits(), ["CO1", "CO2"]);
  assert.equal(units.length, 2);
  assert.equal(units[0].actualClasses, 0);
  assert.deepEqual(units[1].coMappings, ["CO2"]);
});

test("rejects duplicate topics, overlapping dates, and invalid outcomes", () => {
  const duplicate = validUnits();
  duplicate[1].plannedTopics = [" variables "];
  assert.throws(() => validateLessonPlanUnits(duplicate, ["CO1", "CO2"]), /duplicated/);
  const overlap = validUnits();
  overlap[1].plannedStartDate = "2026-07-25";
  assert.throws(() => validateLessonPlanUnits(overlap, ["CO1", "CO2"]), /non-overlapping/);
  const invalidOutcome = validUnits();
  invalidOutcome[0].coMappings = ["CO9"];
  assert.throws(
    () => validateLessonPlanUnits(invalidOutcome, ["CO1", "CO2"]),
    /valid curriculum course outcomes/,
  );
});

test("excludes unverified legacy delivery evidence from completion", () => {
  const result = calculateCourseCompletion(validUnits(), [
    { unitNo: 1, plannedTopic: "Variables", noOfClasses: 2, evidenceVerified: true },
    { unitNo: 1, plannedTopic: "Control flow", noOfClasses: 1, evidenceVerified: false },
  ]);
  assert.equal(result.totalConducted, 2);
  assert.equal(result.completionPercentage, 40);
  assert.equal(result.unitProgress[0].isComplete, false);
  assert.equal(result.isComplete, false);
});

test("completes only after every planned topic and class requirement is satisfied", () => {
  const result = calculateCourseCompletion(validUnits(), [
    { unitNo: 1, plannedTopic: "Variables", noOfClasses: 2, evidenceVerified: true },
    { unitNo: 1, plannedTopic: "Control flow", noOfClasses: 1, evidenceVerified: true },
    { unitNo: 2, plannedTopic: "Arrays", noOfClasses: 2, evidenceVerified: true },
  ]);
  assert.equal(result.completionPercentage, 100);
  assert.equal(result.isComplete, true);
});
