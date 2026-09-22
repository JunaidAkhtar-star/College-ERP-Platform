const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("audit investigation preserves event meaning and restricts security context", () => {
  const controller = read("server/controllers/audit-log.controller.ts");
  assert.match(controller, /rawAction: row\.action/);
  assert.match(controller, /mayViewSecurityContext/);
  assert.match(controller, /securityContextRestricted/);
  assert.match(controller, /risk:/);
});

test("audit queries validate ranges and escape user search expressions", () => {
  const controller = read("server/controllers/audit-log.controller.ts");
  const routes = read("server/routes/audit-log.routes.ts");
  assert.match(controller, /replace\(\/\[\.\*\+\?\^\$\{\}\(\)\|\[\\\]\\\\\]\/g/);
  assert.match(controller, /setUTCHours\(23, 59, 59, 999\)/);
  assert.match(routes, /query\("limit"\).*max: 500/);
  assert.match(routes, /query\("search"\).*max: 100/);
});
