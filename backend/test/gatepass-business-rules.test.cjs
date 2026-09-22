const assert = require("node:assert/strict");
const test = require("node:test");
const { formatGatePassNumber } = require("../build/services/gatepass.service.js");

test("formats tenant-local atomic gate-pass sequences consistently", () => {
  assert.equal(formatGatePassNumber(2026, 1), "GP-2026-0001");
  assert.equal(formatGatePassNumber(2026, 10001), "GP-2026-10001");
});

test("rejects invalid gate-pass sequence values", () => {
  assert.throws(() => formatGatePassNumber(2026, 0), /Invalid gate-pass sequence/);
  assert.throws(() => formatGatePassNumber(2026, 1.5), /Invalid gate-pass sequence/);
});
