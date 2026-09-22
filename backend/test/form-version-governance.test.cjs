const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("published form schemas are immutable linked versions", () => {
  const model = fs.readFileSync(
    path.join(__dirname, "../server/models/form-workflow.model.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/form-workflow.service.ts"),
    "utf8",
  );
  assert.match(model, /definitionKey:[\s\S]*immutable:\s*true/);
  assert.match(model, /previousVersionId:[\s\S]*immutable:\s*true/);
  assert.match(model, /definitionHash:[\s\S]*immutable:\s*true/);
  assert.match(service, /FormDefinitionModel\.create\(\{[\s\S]*previousVersionId:\s*current\._id/);
  assert.match(service, /status:\s*"archived"/);
  assert.match(service, /withTransaction/);
});
