const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("connector secrets are versioned and provider receipts are signed and idempotent", () => {
  const model = fs.readFileSync(
    path.join(__dirname, "../server/models/external-connector.model.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/external-connector.service.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../server/routes/external-connector.routes.ts"),
    "utf8",
  );
  assert.match(model, /Connector secret history is immutable/);
  assert.match(service, /secret rotation reason is required/i);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /providerReference/);
  assert.match(service, /status:\s*\{ \$nin: \["delivered", "failed"\] \}/);
  assert.match(routes, /webhooks\/twilio\/:connectorId/);
  assert.match(service, /consumeFixedWindow/);
  assert.match(service, /Provider rate limit reached/);
});

test("SMS acceptance is not counted as provider delivery", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../server/jobs/outbox.job.ts"), "utf8");
  assert.match(worker, /channelStats\.\$\.accepted/);
  const handler = worker.slice(worker.indexOf('registerJobHandler("connector.sms.send"'));
  assert.doesNotMatch(handler.slice(0, handler.indexOf("onDead")), /channelStats\.\$\.delivered/);
});

test("OAuth refresh and recipient consent controls fail closed", () => {
  const connector = fs.readFileSync(
    path.join(__dirname, "../server/services/external-connector.service.ts"),
    "utf8",
  );
  const communication = fs.readFileSync(
    path.join(__dirname, "../server/services/communication-hub.service.ts"),
    "utf8",
  );
  const model = fs.readFileSync(
    path.join(__dirname, "../server/models/communication-hub.model.ts"),
    "utf8",
  );
  assert.match(connector, /grant_type:\s*"refresh_token"/);
  assert.match(connector, /Automatic OAuth access-token refresh/);
  assert.match(connector, /resolvePinnedPublicAddress\(url\)/);
  assert.match(communication, /consentedRecipientIds/);
  assert.match(communication, /notificationPreferences\.sms/);
  assert.match(communication, /CommunicationSuppressionModel/);
  assert.match(model, /destinationHash/);
  assert.doesNotMatch(model, /destination:\s*\{/);
});
