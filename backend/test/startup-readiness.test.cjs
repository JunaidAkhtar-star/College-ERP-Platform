const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("startup reports required services and configured platform integrations", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "server", "plugins", "listener.plugin.ts"),
    "utf8",
  );

  assert.match(source, /waitForDatabase/);
  assert.match(source, /redisUtil\.healthCheck/);
  assert.match(source, /platformIntegrationService\.list/);
  assert.match(source, /emailService\.verifyConnection/);
  assert.match(source, /Backend server connected successfully/);
  assert.match(source, /configs\.NODE_ENV !== "production" \|\| redisConnected/);
  assert.doesNotMatch(source, /secretCiphertext|secondarySecretCiphertext/);
});

test("Redis readiness tolerates a normal asynchronous startup handshake", () => {
  const redis = fs.readFileSync(
    path.join(__dirname, "..", "server", "utils", "redis.util.ts"),
    "utf8",
  );
  const rateLimit = fs.readFileSync(
    path.join(__dirname, "..", "server", "middlewares", "rate-limit.middleware.ts"),
    "utf8",
  );

  assert.match(redis, /healthCheck\(timeoutMs = 4_000\)/);
  assert.match(redis, /while \(c\.status !== "ready" && Date\.now\(\) < deadline\)/);
  assert.match(redis, /c\.status !== "wait"/);
  assert.match(rateLimit, /let redisConnectionLogged = false/);
  assert.match(rateLimit, /if \(!redisConnectionLogged\)/);
});
