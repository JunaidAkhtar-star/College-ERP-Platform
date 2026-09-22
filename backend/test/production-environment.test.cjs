const assert = require("node:assert/strict");
const test = require("node:test");
const { validateProductionEnvironment } = require("../build/utils/environment.util.js");

const valid = {
  NODE_ENV: "production",
  JWT_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "b".repeat(64),
  AUDIT_HMAC_SECRET: "d".repeat(64),
  REDIS_URL: "rediss://cache.example.edu:6380",
  RABBITMQ_URL: "amqps://erp:secret@mq.example.edu/erp",
  ENCRYPTION_KEY: "c".repeat(64),
  ALLOWED_ORIGINS: "https://erp.example.com,https://admin.example.com",
  FRONTEND_URL: "https://erp.example.com",
  TENANT_ROOT_DOMAIN: "erp.example.com",
  DASHBOARD_USERNAME: "",
  DASHBOARD_PASSWORD: "",
  CONNECTOR_EGRESS_HOSTS: "api.twilio.com,api.example.com",
  CONNECTOR_WEBHOOK_BASE_URL: "https://api.example.com",
};

test("accepts a hardened production environment", () => {
  assert.deepEqual(validateProductionEnvironment(valid), []);
});

test("rejects weak, shared, and incomplete production secrets", () => {
  const errors = validateProductionEnvironment({
    ...valid,
    JWT_SECRET: "shared",
    JWT_REFRESH_SECRET: "shared",
    ENCRYPTION_KEY: "not-hex",
  });
  assert.ok(errors.some((error) => error.includes("JWT_SECRET")));
  assert.ok(errors.some((error) => error.includes("must be different")));
  assert.ok(errors.some((error) => error.includes("ENCRYPTION_KEY")));
});

test("rejects insecure production origins and tenant domains", () => {
  const errors = validateProductionEnvironment({
    ...valid,
    ALLOWED_ORIGINS: "http://erp.example.com",
    FRONTEND_URL: "http://erp.example.com",
    TENANT_ROOT_DOMAIN: "localhost",
  });
  assert.equal(errors.length, 3);
});

test("requires a valid RabbitMQ URL in production", () => {
  const errors = validateProductionEnvironment({ ...valid, RABBITMQ_URL: "" });
  assert.ok(errors.some((error) => error.includes("RABBITMQ_URL")));
});

test("does not impose production-only requirements during development", () => {
  assert.deepEqual(
    validateProductionEnvironment({
      ...valid,
      NODE_ENV: "development",
      JWT_SECRET: "",
      JWT_REFRESH_SECRET: "",
      ENCRYPTION_KEY: "",
    }),
    [],
  );
});
