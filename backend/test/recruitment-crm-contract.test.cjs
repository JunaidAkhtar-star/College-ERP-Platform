const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("recruitment CRM records are audited, duplicate-safe and indexed for owned work", () => {
  const model = read("server/models/recruitment-crm.model.ts");
  assert.match(model, /LeadSchema\.plugin\(auditPlugin\)/);
  assert.match(model, /ActivitySchema\.plugin\(auditPlugin\)/);
  assert.match(model, /phone: 1.*unique: true/);
  assert.match(model, /ownerId: 1, stage: 1, nextFollowUpAt: 1/);
});

test("pipeline uses bounded pagination and rejects duplicate identities", () => {
  const service = read("server/services/recruitment-crm.service.ts");
  assert.match(service, /Math\.min\(100, Math\.max\(1, limit\)\)/);
  assert.match(service, /phone or email already exists/);
  assert.match(service, /status: "planned", dueAt: \{ \$lt: now \}/);
});

test("recruitment routes require admissions roles and validate all identifiers", () => {
  const routes = read("server/routes/recruitment-crm.routes.ts");
  assert.match(routes, /requireRoles\(ADMISSION_ROLES\)/);
  assert.match(routes, /body\("programInterest"\)\.optional\(\)\.isMongoId\(\)/);
  assert.match(routes, /body\("ownerId"\)\.optional\(\)\.isMongoId\(\)/);
});

test("counselor ownership is enforced for direct lead and activity operations", () => {
  const controller = read("server/controllers/recruitment-crm.controller.ts");
  const service = read("server/services/recruitment-crm.service.ts");
  assert.match(controller, /isCounselor\(req\.activeRole\)[\s\S]*?req\.user!\._id\.toString\(\)/);
  assert.match(
    service,
    /const selector = \{ _id: id, \.\.\.\(scopedOwnerId \? \{ ownerId: scopedOwnerId \} : \{\}\) \}/,
  );
  assert.match(
    service,
    /RecruitmentLeadModel\.exists\(\{ _id: leadId, ownerId: scopedOwnerId \}\)/,
  );
  assert.match(service, /ownerId: scopedOwnerId \?\? String\(input\.ownerId \?\? actorId\)/);
});
