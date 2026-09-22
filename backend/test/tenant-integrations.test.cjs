const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("tenant payment callbacks retain raw bytes and never log complete payloads", () => {
  const server = read("server/server.ts");
  const routes = read("server/routes/tenant-integrations.routes.ts");
  assert.match(server, /tenant-integrations\\\/\[\^\/\]\+\\\/webhook/);
  assert.match(routes, /req\.rawBody/);
  assert.doesNotMatch(routes, /body:\s*req\.body/);
});

test("tenant payment gateways use ERP-owned attempts, signatures, and exact reconciliation", () => {
  const source = read("server/services/tenant-integration.service.ts");
  assert.match(source, /PaytmChecksum\.verifySignature/);
  assert.match(source, /stripe-signature/);
  assert.match(source, /x-razorpay-signature/);
  assert.match(source, /x-webhook-signature/);
  assert.match(source, /PhonePe webhook authorization is invalid/);
  assert.match(source, /TenantPaymentAttemptModel\.findOne/);
  assert.match(source, /Payment attempt was not created by this ERP/);
  assert.match(source, /Provider amount does not match the ERP payment attempt/);
  assert.match(source, /TenantPaymentWebhookEventModel/);
  assert.doesNotMatch(source, /connection verification check\s*\n\s*succeeded = true/);
});

test("connector health and execution paths call provider-native APIs", () => {
  const source = read("server/services/external-connector.service.ts");
  assert.match(source, /sandbox-quickbooks\.api\.intuit\.com/);
  assert.match(source, /admin\.googleapis\.com\/admin\/directory\/v1\/users/);
  assert.match(source, /meet\.googleapis\.com\/v2\/spaces/);
  assert.match(source, /graph\.microsoft\.com\/v1\.0\/organization/);
  assert.match(source, /onlineMeetings/);
  assert.match(source, /upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.match(source, /bigBlueButtonUrl/);
  assert.match(source, /x-devvelocity-signature/);
});
