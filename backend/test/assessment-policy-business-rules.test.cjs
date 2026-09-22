const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateComponentScore } = require("../build/services/assessment-policy.service.js");
const base = {
  key: "ct",
  name: "Class Test",
  category: "internal",
  source: "manual",
  deliveryMode: "hybrid",
  maximumMarks: 15,
  minimumPassMarks: 0,
  attemptCount: 3,
  method: "best_n",
  bestCount: 2,
  scaleFrom: 30,
  rounding: "nearest_half",
  attendanceRequired: false,
  allowMakeup: false,
  isRequired: true,
  displayOrder: 1,
};
test("best-N scores are scaled and rounded without exceeding component maximum", () => {
  assert.equal(calculateComponentScore(base, { componentKey: "ct", attempts: [12, 10, 4] }), 11);
});
test("attendance-gated activities cannot receive marks while absent", () => {
  assert.equal(
    calculateComponentScore(
      { ...base, attendanceRequired: true },
      { componentKey: "ct", attempts: [20], attended: false },
    ),
    0,
  );
});
test("invalid attempt counts and scores are rejected", () => {
  assert.throws(
    () => calculateComponentScore(base, { componentKey: "ct", attempts: [31] }),
    /Invalid score/,
  );
  assert.throws(
    () => calculateComponentScore(base, { componentKey: "ct", attempts: [] }),
    /Invalid attempt count/,
  );
});
test("average and drop-lowest strategies remain bounded by component maximum", () => {
  assert.equal(
    calculateComponentScore(
      { ...base, method: "average", scaleFrom: undefined, maximumMarks: 20 },
      { componentKey: "ct", attempts: [10, 20] },
    ),
    15,
  );
  assert.equal(
    calculateComponentScore(
      { ...base, method: "drop_lowest", scaleFrom: undefined, maximumMarks: 20 },
      { componentKey: "ct", attempts: [4, 7, 9] },
    ),
    16,
  );
});
test("rounding strategy is deterministic", () => {
  assert.equal(
    calculateComponentScore(
      {
        ...base,
        method: "average",
        scaleFrom: undefined,
        maximumMarks: 20,
        rounding: "nearest_half",
      },
      { componentKey: "ct", attempts: [10, 11, 12] },
    ),
    11,
  );
});
