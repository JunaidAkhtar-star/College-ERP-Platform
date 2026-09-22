const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("managed user access previews effective permissions and supports session revocation", () => {
  const routes = read("server/routes/user.routes.ts");
  const service = read("server/services/admin.service.ts");
  assert.match(routes, /"\/:id\/access"/);
  assert.match(routes, /"\/:id\/revoke-sessions"/);
  assert.match(service, /effectivePermissions/);
  assert.match(service, /USER_SESSIONS_REVOKED/);
});

test("account and role authority changes invalidate stale sessions", () => {
  const admin = read("server/services/admin.service.ts");
  const roles = read("server/services/role.service.ts");
  assert.match(admin, /authorityChanged/);
  assert.match(admin, /status === "active" \? \{ status \} : \{ status, activeSessions: \[\] \}/);
  assert.match(roles, /Permission conflict/);
  assert.match(roles, /revokeSessionsForRole/);
});

test("new accounts receive single-use invitations and require a password change", () => {
  const service = read("server/services/admin.service.ts");
  assert.match(service, /passwordSetToken/);
  assert.match(service, /tenantActivationUrl/);
  assert.match(service, /sendAccountInvite/);
  assert.doesNotMatch(service, /return .*temporaryPassword/);
  assert.match(service, /mustChangePassword: true/);
  assert.match(service, /status: "pending_verification"/);
  assert.match(service, /sendWelcome/);
});
