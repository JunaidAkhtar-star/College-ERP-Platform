const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("document templates require independent approval and immutable published versions", () => {
  const model = read("server/models/document-template.model.ts");
  const service = read("server/services/document-template.service.ts");
  assert.match(model, /pending_approval/);
  assert.match(model, /Published document template versions are immutable/);
  assert.match(service, /Template approval requires an independent reviewer/);
  assert.match(service, /status:\s*"published"/);
  assert.match(service, /DocumentTemplateVersionModel\.create/);
  assert.match(service, /Only a draft template can be submitted/);
});

test("issued documents preserve template and PDF integrity evidence", () => {
  const model = read("server/models/document-template.model.ts");
  const service = read("server/services/document-template.service.ts");
  assert.match(model, /templateSnapshot/);
  assert.match(model, /templateHash/);
  assert.match(model, /pdfHash/);
  assert.match(service, /createHash\("sha256"\)\.update\(pdf\)/);
  assert.match(service, /snapshot:\s*data/);
});
