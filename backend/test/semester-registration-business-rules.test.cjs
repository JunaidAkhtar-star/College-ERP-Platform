const assert = require("node:assert/strict");
const test = require("node:test");
const { canEditRegistrationAt } = require("../build/services/semester-registration.service.js");

const window = {
  opensAt: new Date("2026-07-01T00:00:00.000Z"),
  closesAt: new Date("2026-07-10T23:59:59.000Z"),
  addDropEndsAt: new Date("2026-07-15T23:59:59.000Z"),
};

test("enforces initial registration and add/drop deadlines by workflow state", () => {
  assert.equal(canEditRegistrationAt(new Date("2026-06-30T23:59:59.000Z"), window), false);
  assert.equal(canEditRegistrationAt(new Date("2026-07-05T00:00:00.000Z"), window), true);
  assert.equal(canEditRegistrationAt(new Date("2026-07-12T00:00:00.000Z"), window), false);
  assert.equal(
    canEditRegistrationAt(new Date("2026-07-12T00:00:00.000Z"), window, "approved"),
    true,
  );
  assert.equal(
    canEditRegistrationAt(new Date("2026-07-16T00:00:00.000Z"), window, "approved"),
    false,
  );
});
