const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("compliance findings require owned remediation evidence and independent closure", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../server/services/compliance-workspace.service.ts"),
    "utf8",
  );
  assert.match(source, /Remediation plan and evidence are required/);
  assert.match(source, /Finding owner cannot verify their own remediation/);
  assert.match(source, /closure verification note is required/);
});
