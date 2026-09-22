const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("document issuance resolves searchable profile options and visitor records", () => {
  const service = read("server/services/document-template.service.ts");
  const search = read("server/routes/search.routes.ts");

  assert.match(service, /\$or: \[\{ _id: id \}, \{ userId: id \}\]/);
  assert.match(search, /optionsVisitors/);
  assert.match(search, /visitors: optionsVisitors/);
});

test("document lifecycle requires independent approval and immutable published versions", () => {
  const service = read("server/services/document-template.service.ts");

  assert.match(service, /Template approval requires an independent reviewer/);
  assert.match(service, /DocumentTemplateVersionModel\.create/);
  assert.match(service, /snapshotHash/);
  assert.match(service, /verificationCode/);
  assert.match(service, /pdfHash/);
});

test("issued documents support verification and governed revocation", () => {
  const routes = read("server/routes/document-template.routes.ts");
  const service = read("server/services/document-template.service.ts");

  assert.match(routes, /\/verify\/:code/);
  assert.match(routes, /\/issued\/:id\/revoke/);
  assert.match(service, /revocationReason/);
  assert.match(service, /valid.*revokedAt|revokedAt/);
});
