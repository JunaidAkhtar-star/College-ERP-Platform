const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { shouldAuditBusinessMutation } = require("../build/middlewares/business-audit.middleware");

test("central audit covers every successful authenticated business mutation", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(
      shouldAuditBusinessMutation({
        method,
        statusCode: 200,
        authenticated: true,
        baseUrl: "/v1/procurement",
      }),
      true,
    );
  }
  assert.equal(
    shouldAuditBusinessMutation({
      method: "GET",
      statusCode: 200,
      authenticated: true,
      baseUrl: "/v1/procurement",
    }),
    false,
  );
  assert.equal(
    shouldAuditBusinessMutation({
      method: "POST",
      statusCode: 403,
      authenticated: true,
      baseUrl: "/v1/procurement",
    }),
    false,
  );
});

test("central audit middleware is mounted before dynamic business routes", () => {
  const server = fs.readFileSync(path.join(__dirname, "../server/server.ts"), "utf8");
  assert.ok(server.indexOf(".use(businessAuditMiddleware)") > 0);
  assert.ok(
    server.indexOf(".use(businessAuditMiddleware)") < server.indexOf("RouterPlugin.setup(app)"),
  );
});
