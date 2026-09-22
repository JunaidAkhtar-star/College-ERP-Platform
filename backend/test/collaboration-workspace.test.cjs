const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("collaboration supports governed pinning, closing and reply evidence", () => {
  const routes = read("server/routes/collaboration.routes.ts");
  const service = read("server/services/collaboration.service.ts");
  const controller = read("server/controllers/collaboration.controller.ts");

  assert.match(routes, /router\.patch\(/);
  assert.match(routes, /isPinned/);
  assert.match(routes, /isLocked/);
  assert.match(routes, /body\("attachments"\)\.optional\(\)\.isArray/);
  assert.match(service, /Only the author or an institution moderator/);
  assert.match(service, /Only an institution moderator can pin/);
  assert.match(controller, /roles: \[String\(req\.activeRole\)\]/);
  assert.doesNotMatch(controller, /req\.user\?\.roles/);
  assert.match(service, /Only the album owner or an institution moderator can add media/);
  assert.match(routes, /body\("targetDepartments\.\*"\)\.optional\(\)\.isMongoId\(\)/);
});
