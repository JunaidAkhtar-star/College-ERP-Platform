const test = require("node:test");
const assert = require("node:assert/strict");
const { redactOperationalLog } = require("../build/utils/operational-dashboard.util.js");

test("redacts credentials and tenant email addresses from operational logs", () => {
  const source =
    "authorization: Bearer abc.def token=raw-token password=hunter2 user=person@tenant.edu";
  const result = redactOperationalLog(source);

  assert.equal(result.includes("abc.def"), false);
  assert.equal(result.includes("raw-token"), false);
  assert.equal(result.includes("hunter2"), false);
  assert.equal(result.includes("person@tenant.edu"), false);
  assert.match(result, /\[REDACTED\]/);
  assert.match(result, /\[REDACTED_EMAIL\]/);
});
