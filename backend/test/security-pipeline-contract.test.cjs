const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("security pipeline blocks high-risk dependencies, leaked secrets and static findings", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/security.yml"),
    "utf8",
  );
  assert.match(workflow, /pnpm audit --prod --audit-level high/);
  assert.match(workflow, /gitleaks/);
  assert.match(workflow, /trivy-action/);
  assert.match(workflow, /codeql-action\/analyze/);
});
