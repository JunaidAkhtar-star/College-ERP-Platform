const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("grievance cases have confidentiality, SLA, conflict and appeal controls", () => {
  const model = fs.readFileSync(
    path.join(__dirname, "../server/models/grievance.model.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/grievance.service.ts"),
    "utf8",
  );
  assert.match(model, /confidentiality/);
  assert.match(model, /responseDueAt/);
  assert.match(model, /resolutionDueAt/);
  assert.match(service, /named in a grievance cannot/);
  assert.match(service, /30-day appeal window/);
  assert.match(service, /Maximum appeal limit/);
});
