const assert = require("node:assert/strict");
const test = require("node:test");
const { isAllowedCorsOrigin } = require("../build/utils/cors.util.js");

const rules = [
  "http://localhost:3000",
  "http://*.localhost:3000",
  "https://localhost:3000",
  "https://*.localhost:3000",
  "https://erp.devvelocity.in",
  "https://*.erp.devvelocity.in",
].join(",");

test("allows configured ERP roots and direct tenant subdomains", () => {
  assert.equal(isAllowedCorsOrigin("http://localhost:3000", rules), true);
  assert.equal(isAllowedCorsOrigin("http://rajesh.localhost:3000", rules), true);
  assert.equal(isAllowedCorsOrigin("https://giet.localhost:3000", rules), true);
  assert.equal(isAllowedCorsOrigin("https://college.erp.devvelocity.in", rules), true);
});

test("rejects deceptive, nested, wrong-port and wrong-protocol origins", () => {
  assert.equal(isAllowedCorsOrigin("http://rajesh.localhost:3001", rules), false);
  assert.equal(isAllowedCorsOrigin("https://rajesh.localhost:3001", rules), false);
  assert.equal(isAllowedCorsOrigin("https://nested.college.erp.devvelocity.in", rules), false);
  assert.equal(isAllowedCorsOrigin("https://college.erp.devvelocity.in.evil.test", rules), false);
});
