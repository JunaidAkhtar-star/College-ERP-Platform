const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const limiter = fs.readFileSync(
  path.join(__dirname, "..", "server", "middlewares", "rate-limit.middleware.ts"),
  "utf8",
);
const tenant = fs.readFileSync(
  path.join(__dirname, "..", "server", "middlewares", "tenant.middleware.ts"),
  "utf8",
);

test("authenticated ERP traffic has a verified per-session rate-limit bucket", () => {
  assert.match(limiter, /AUTHENTICATED_API_MAX = isDev \? 20000 : 1500/);
  assert.match(limiter, /tokenUtil\.verifyAccessToken/);
  assert.match(limiter, /payload\.tenantId.*payload\.userId.*payload\.jti/s);
  assert.match(limiter, /req\.path === "\/refresh-token"/);
});

test("the access token is authoritative over stale tenant cookies and paths", () => {
  assert.match(tenant, /Tenant context does not match the authenticated session/);
  assert.match(tenant, /tenantId = tokenTenant/);
  assert.match(tenant, /if \(!tenantId && typeof headerTenant === "string"\)/);
});
