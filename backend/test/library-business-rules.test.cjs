const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateLibraryFine } = require("../build/services/library.service.js");

test("charges library fines for each started overdue day", () => {
  const due = new Date("2026-07-01T10:00:00.000Z");
  assert.deepEqual(calculateLibraryFine(due, new Date("2026-07-01T10:00:00.000Z")), {
    overdueDays: 0,
    fineAmount: 0,
  });
  assert.deepEqual(calculateLibraryFine(due, new Date("2026-07-01T10:00:01.000Z")), {
    overdueDays: 1,
    fineAmount: 2,
  });
  assert.deepEqual(calculateLibraryFine(due, new Date("2026-07-03T10:00:00.000Z")), {
    overdueDays: 2,
    fineAmount: 4,
  });
});
