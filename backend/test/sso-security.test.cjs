const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeSsoReturnUrl, resolveSsoLoginRole } = require("../build/services/sso.service.js");

test("SSO callback accepts root and tenant-scoped application paths", () => {
  assert.equal(
    normalizeSsoReturnUrl("https://erp.example.edu/auth/sso/callback", "https://erp.example.edu"),
    "https://erp.example.edu/auth/sso/callback",
  );
  assert.equal(
    normalizeSsoReturnUrl(
      "http://localhost:3000/demo-college/auth/sso/callback",
      "http://localhost:3000",
    ),
    "http://localhost:3000/demo-college/auth/sso/callback",
  );
});

test("platform SSO permits only the platform administrator role", () => {
  assert.equal(resolveSsoLoginRole(["super_admin", "admin"], true), "super_admin");
  assert.throws(() => resolveSsoLoginRole(["admin"], true));
  assert.equal(resolveSsoLoginRole(["faculty"], false), "faculty");
});

test("SSO callback rejects cross-origin and arbitrary redirect destinations", () => {
  assert.throws(() =>
    normalizeSsoReturnUrl("https://evil.example/auth/sso/callback", "https://erp.example.edu"),
  );
  assert.throws(() =>
    normalizeSsoReturnUrl("https://erp.example.edu/admin/dashboard", "https://erp.example.edu"),
  );
});

test("SSO enforces account MFA before issuing an authenticated session", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "server", "services", "sso.service.ts"),
    "utf8",
  );
  const completion = source.slice(source.indexOf("async complete("));
  const mfaGate = completion.indexOf("user.mfaEnabled");
  const tokenIssue = completion.indexOf("authService.issueLoginTokens");

  assert.ok(mfaGate > -1, "SSO completion must inspect the authoritative MFA flag");
  assert.ok(tokenIssue > mfaGate, "SSO must evaluate MFA before issuing login tokens");
  assert.match(completion, /createMfaLoginChallenge/);
});
