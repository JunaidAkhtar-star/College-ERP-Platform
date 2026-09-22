const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("club membership requests are unique, auditable and approval governed", () => {
  const model = read("server/models/club.model.ts");
  const service = read("server/services/club.service.ts");
  const routes = read("server/routes/club.routes.ts");
  assert.match(model, /ClubMembershipRequestSchema\.index/);
  assert.match(model, /partialFilterExpression:\s*\{ status: "pending" \}/);
  assert.match(service, /You are already a member of this club/);
  assert.match(service, /status: "pending"/);
  assert.match(service, /members:\s*\{ userId: request\.userId, role: "Member"/);
  assert.match(routes, /canApprove,[\s\S]*clubController\.decideMembership/);
});

test("inactive clubs reject activities and activity records support evidence", () => {
  const model = read("server/models/club.model.ts");
  const service = read("server/services/club.service.ts");
  assert.match(service, /findOne\(\{ _id: clubId, isActive: true \}\)/);
  assert.match(service, /Activities require an active club/);
  for (const field of ["proofUrl", "venue", "outcome", "budget"])
    assert.match(model, new RegExp(`${field}:`));
});
