const assert = require("node:assert/strict");
const test = require("node:test");
const {
  allocateScholarshipFeeCredit,
  evaluateScholarshipEligibility,
} = require("../build/services/scholarship.service.js");

test("evaluates all configured scholarship eligibility rules", () => {
  assert.deepEqual(
    evaluateScholarshipEligibility(
      { currentCgpa: 8.2, familyIncome: 240000, backlogs: 0 },
      { minCgpa: 8, maxFamilyIncome: 250000, maxBacklogs: 0 },
    ),
    { eligible: true, reasons: [] },
  );
  const failed = evaluateScholarshipEligibility(
    { currentCgpa: 7.5, familyIncome: 300000, backlogs: 2 },
    { minCgpa: 8, maxFamilyIncome: 250000, maxBacklogs: 0 },
  );
  assert.equal(failed.eligible, false);
  assert.equal(failed.reasons.length, 3);
});

test("requires verified income when a scheme has an income ceiling", () => {
  const result = evaluateScholarshipEligibility(
    { currentCgpa: 9, backlogs: 0 },
    { maxFamilyIncome: 250000, maxBacklogs: 0 },
  );
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /Verified family income/);
});

test("allocates fee credits oldest-first without exceeding invoice balances", () => {
  assert.deepEqual(
    allocateScholarshipFeeCredit(
      [
        { id: "old", balanceDue: 10000 },
        { id: "new", balanceDue: 8000 },
      ],
      15000,
    ),
    [
      { id: "old", credit: 10000 },
      { id: "new", credit: 5000 },
    ],
  );
});

test("rejects a fee credit above authoritative outstanding fees", () => {
  assert.throws(
    () => allocateScholarshipFeeCredit([{ id: "invoice", balanceDue: 1000 }], 1001),
    /exceeds the student's outstanding fees/,
  );
});
