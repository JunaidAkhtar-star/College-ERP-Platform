const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const routes = fs.readFileSync(path.join(__dirname, "..", "server/routes/fee.routes.ts"), "utf8");
const controller = fs.readFileSync(
  path.join(__dirname, "..", "server/controllers/fee.controller.ts"),
  "utf8",
);
const accountRoutes = fs.readFileSync(
  path.join(__dirname, "..", "server/routes/accounts.routes.ts"),
  "utf8",
);

test("student fee records enforce authenticated ownership", () => {
  assert.match(
    controller,
    /getRecord:[\s\S]*?assertFeeStudentAccess\(req, data\.studentId\.toString\(\)\)/,
  );
  assert.match(controller, /getByStudent:[\s\S]*?assertFeeStudentAccess\(req, studentId\)/);
});

test("accounts read roles align with the protected customer workspace", () => {
  const guard = accountRoutes.match(/const accountsGuard = requireRoles\([\s\S]*?\);/)?.[0] ?? "";
  assert.match(guard, /SystemRole\.ADMIN/);
  assert.match(guard, /SystemRole\.ADMINISTRATION_OFFICE/);
  const strictGuard =
    accountRoutes.match(/const strictAccountsGuard = requireRoles\([\s\S]*?\);/)?.[0] ?? "";
  assert.doesNotMatch(strictGuard, /SystemRole\.ADMINISTRATION_OFFICE|SystemRole\.ADMIN\b/);
});

test("fee monitoring roles align with customer-facing finance roles", () => {
  const monitors = routes.match(/const feeMonitors = requireRoles\([\s\S]*?\);/)?.[0] ?? "";
  assert.match(monitors, /SystemRole\.ADMIN/);
  assert.match(monitors, /SystemRole\.ADMINISTRATION_OFFICE/);
  assert.match(monitors, /SystemRole\.SCHOLARSHIP_CELL/);
  assert.match(routes, /router\.get\("\/structures", auth, feeMonitors/);
});

test("submission detail endpoints reject unrelated authenticated roles", () => {
  assert.match(routes, /const submissionViewers = requireRoles/);
  assert.match(routes, /"\/submissions\/record\/:feeRecordId"[\s\S]*?auth,\s*submissionViewers/);
  assert.match(routes, /"\/submissions\/:id"[\s\S]*?auth,\s*submissionViewers/);
});
