const assert = require("node:assert/strict");
const test = require("node:test");
const { isTransportFeeMonthValid } = require("../build/services/transport.service.js");

test("limits transport fee months to the allocation academic year", () => {
  assert.equal(isTransportFeeMonthValid("2026-04", "2026-2027"), true);
  assert.equal(isTransportFeeMonthValid("2027-03", "2026-2027"), true);
  assert.equal(isTransportFeeMonthValid("2026-03", "2026-2027"), false);
  assert.equal(isTransportFeeMonthValid("2027-04", "2026-2027"), false);
  assert.equal(isTransportFeeMonthValid("bad-month", "2026-2027"), false);
});
