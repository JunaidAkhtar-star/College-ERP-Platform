const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const connectionManager = fs.readFileSync(
  path.join(__dirname, "..", "server", "configs", "connectionManager.ts"),
  "utf8",
);

test("tenant connections register business models lazily", () => {
  const connectionFactory = connectionManager.slice(
    connectionManager.indexOf("export function getTenantConnection"),
    connectionManager.indexOf("export async function dropTenantDatabase"),
  );

  assert.doesNotMatch(connectionFactory, /initializeTenantModels/);
  assert.match(connectionManager, /activateTenantModel\(store\.tenantDb, defaultModel\)/);
  assert.match(connectionManager, /dormantSchema\.set\("autoCreate", false\)/);
  assert.match(connectionManager, /dormantSchema\.set\("autoIndex", false\)/);
});

test("platform and shared scheduler models stay in the master database", () => {
  for (const modelName of [
    "Tenant",
    "SubscriptionPlan",
    "PlatformBillingRecord",
    "PublicCheckout",
    "CheckoutAgreement",
    "TenantPaymentAttempt",
    "TenantPaymentWebhookEvent",
    "SchedulerLease",
    "ImplementationProject",
    "SupportTicket",
  ]) {
    assert.match(connectionManager, new RegExp(`"${modelName}"`));
  }
});
