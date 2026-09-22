const assert = require("node:assert/strict");
const test = require("node:test");
const { managedTenantFromHost } = require("../build/middlewares/tenant.middleware.js");

test("resolves a tenant under the configured managed wildcard", () => {
  assert.equal(managedTenantFromHost("rite.erp.devvelocity.in", "erp.devvelocity.in"), "rite");
});

test("does not mistake the platform API hostname for a tenant", () => {
  assert.equal(managedTenantFromHost("api.devvelocity.in", "erp.devvelocity.in"), null);
});

test("does not resolve nested or unrelated public hostnames", () => {
  assert.equal(managedTenantFromHost("foo.rite.erp.devvelocity.in", "erp.devvelocity.in"), null);
  assert.equal(managedTenantFromHost("rite.example.com", "erp.devvelocity.in"), null);
});

test("supports one-label localhost tenant subdomains", () => {
  assert.equal(managedTenantFromHost("rite.localhost", "erp.devvelocity.in"), "rite");
  assert.equal(managedTenantFromHost("foo.rite.localhost", "erp.devvelocity.in"), null);
});
