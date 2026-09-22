const test = require("node:test");
const assert = require("node:assert/strict");
const { periodForDate, availableBudget } = require("../build/services/finance-control.service");

test("maps the April-to-March accounting periods deterministically", () => {
  assert.equal(periodForDate(new Date(2026, 3, 1)), 1);
  assert.equal(periodForDate(new Date(2026, 11, 31)), 9);
  assert.equal(periodForDate(new Date(2027, 2, 31)), 12);
});

test("available budget deducts both commitments and consumed spend", () => {
  assert.equal(
    availableBudget({ approvedAmount: 100000, encumberedAmount: 25000, consumedAmount: 32500.5 }),
    42499.5,
  );
});
