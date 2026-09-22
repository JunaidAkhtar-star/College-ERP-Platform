const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isEligibleForHostelType,
  isMonthInAcademicYear,
} = require("../build/services/hostel.service.js");

test("enforces hostel eligibility while allowing mixed accommodation", () => {
  assert.equal(isEligibleForHostelType("male", "boys"), true);
  assert.equal(isEligibleForHostelType("female", "boys"), false);
  assert.equal(isEligibleForHostelType("female", "girls"), true);
  assert.equal(isEligibleForHostelType("other", "mixed"), true);
});

test("maps April to March fee months to the correct academic year", () => {
  assert.equal(isMonthInAcademicYear("2026-04", "2026-2027"), true);
  assert.equal(isMonthInAcademicYear("2027-03", "2026-2027"), true);
  assert.equal(isMonthInAcademicYear("2027-04", "2026-2027"), false);
  assert.equal(isMonthInAcademicYear("2026-03", "2026-2027"), false);
});
