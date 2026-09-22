const assert = require("node:assert/strict");
const test = require("node:test");
const { tenantCacheKey } = require("../build/utils/redis.util.js");

test("isolates identical cache keys between tenants", () => {
  assert.equal(tenantCacheKey("exam:result:1", "college-a"), "tenant:college-a:exam:result:1");
  assert.equal(tenantCacheKey("exam:result:1", "college-b"), "tenant:college-b:exam:result:1");
  assert.notEqual(
    tenantCacheKey("exam:result:1", "college-a"),
    tenantCacheKey("exam:result:1", "college-b"),
  );
});
