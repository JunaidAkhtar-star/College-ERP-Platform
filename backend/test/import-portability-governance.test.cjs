const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("import processing persists progress and returns understandable row failures", () => {
  const model = read("server/models/import-center.model.ts");
  const service = read("server/services/import-center.service.ts");

  assert.match(model, /processedRows: number/);
  assert.match(service, /job\.processedRows = index \+ 1/);
  assert.match(service, /Persist every row[\s\S]*?await job\.save\(\)/);
  assert.match(service, /This row could not be written/);
  assert.doesNotMatch(service, /error instanceof Error \? error\.message : "Commit failed"/);
});

test("import rollback relies on dynamic delete permission and keeps the safe rollback window", () => {
  const service = read("server/services/import-center.service.ts");
  const permissions = read("server/constants/route-permissions.ts");

  assert.match(permissions, /Module\.IMPORT_CENTER, action: PermissionAction\.DELETE/);
  assert.doesNotMatch(service, /createdBy: userId,\s+status: \{ \$in: \["completed"/);
  assert.match(service, /24-hour safe rollback window has closed/);
  assert.match(service, /updated existing records require manual correction/);
});

test("import approval records and executes as the actual approver", () => {
  const service = read("server/services/import-center.service.ts");

  assert.match(service, /import-commit:\$\{queuedJob\._id\}[\s\S]*?userId,/);
  assert.match(service, /job\.committedBy = new Types\.ObjectId\(userId\)/);
  assert.doesNotMatch(service, /userId: String\(job\.createdBy\)/);
  assert.doesNotMatch(service, /SystemRole\.(SUPER_ADMIN|ADMIN|PRINCIPAL)/);
});

test("academic foundation imports enforce the real dependency order", () => {
  const model = read("server/models/import-center.model.ts");
  const service = read("server/services/import-center.service.ts");

  assert.match(model, /"curricula"/);
  assert.match(model, /"departments"/);
  assert.match(model, /"batches"/);
  assert.match(service, /Program and regulation year were not found/);
  assert.match(service, /Department is not linked to this program curriculum/);
  assert.match(service, /committedUserIds/);
  assert.match(service, /roles: \[SystemRole\.STUDENT\]/);
});

test("data portability remains approval, expiry and redaction governed", () => {
  const service = read("server/services/data-portability.service.ts");

  assert.match(service, /requiresApproval = sensitive \|\| total > 10_000/);
  assert.match(service, /Export requester cannot approve or reject the same export/);
  assert.match(service, /mayCancelAny \? \{\} : \{ requestedBy: actorId \}/);
  assert.match(service, /The DSAR requester cannot review or resolve the same request/);
  assert.match(service, /createdBy: \{ \$ne: actorId \}/);
  assert.match(service, /requires an independent releaser/);
  assert.match(service, /redactionProfile/);
  assert.match(service, /expiresAt: \{ \$gt: new Date\(\) \}/);
});
