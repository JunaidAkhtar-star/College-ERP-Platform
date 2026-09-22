const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("suspended tenants expose only a public no-store access status contract", () => {
  const middleware = read("server/middlewares/tenant.middleware.ts");
  const route = read("server/routes/tenant-domain.routes.ts");
  assert.match(middleware, /tenant-domain\/access-status/);
  assert.match(route, /router\.get\("\/access-status"/);
  assert.match(route, /accessible/);
  assert.match(route, /Cache-Control", "no-store"/);
  const resolver = route.slice(route.indexOf('router.get("/resolve"'));
  assert.doesNotMatch(resolver, /status:\s*TenantStatus\.ACTIVE/);
  assert.doesNotMatch(
    route.slice(
      route.indexOf('router.get("/access-status"'),
      route.indexOf('router.get("/resolve"'),
    ),
    /databaseName|billingEmail/,
  );
});

test("push readiness uses one tested platform Firebase project for every client", () => {
  const platformService = read("server/services/platform-integration.service.ts");
  const fcm = read("server/utils/fcm.util.ts");
  const preferences = read("server/controllers/notification.controller.ts");
  assert.match(platformService, /row\?\.enabled/);
  assert.match(platformService, /row\.status !== "healthy"/);
  assert.match(fcm, /platformIntegrationService\.credentials/);
  assert.doesNotMatch(fcm, /tenantIntegrationService/);
  assert.match(preferences, /if \(push === true\)/);
  assert.match(preferences, /Platform Firebase must be enabled and connection-tested/);
});
