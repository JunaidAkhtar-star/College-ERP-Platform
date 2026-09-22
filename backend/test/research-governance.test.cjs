const assert = require("node:assert/strict");
const test = require("node:test");

const { validateResearchProject } = require("../build/services/research-development.service");

test("research grant controls reject invalid dates and overspend", () => {
  assert.throws(
    () =>
      validateResearchProject({
        startDate: new Date("2026-08-02"),
        endDate: new Date("2026-08-01"),
      }),
    /end date/i,
  );
  assert.throws(
    () => validateResearchProject({ sanctionedAmount: 100, expenditureAmount: 101 }),
    /expenditure/i,
  );
});

test("ethics-controlled research cannot be approved without ethics approval", () => {
  assert.throws(
    () =>
      validateResearchProject({
        ethicsRequired: true,
        ethicsStatus: "pending",
        status: "approved",
      }),
    /ethics approval/i,
  );
});
