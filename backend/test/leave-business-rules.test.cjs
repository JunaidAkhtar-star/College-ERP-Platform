const assert = require("node:assert/strict");
const test = require("node:test");
const { academicYearForDate, periodMonths } = require("../build/services/leave.service.js");

test("uses the April to March academic-year boundary", () => {
  assert.equal(academicYearForDate(new Date(2026, 2, 31)), "2025-2026");
  assert.equal(academicYearForDate(new Date(2026, 3, 1)), "2026-2027");
});

test("identifies every payroll period touched by cross-month leave", () => {
  assert.deepEqual(periodMonths(new Date(2026, 0, 30), new Date(2026, 2, 2)), [
    { month: 1, year: 2026 },
    { month: 2, year: 2026 },
    { month: 3, year: 2026 },
  ]);
});
