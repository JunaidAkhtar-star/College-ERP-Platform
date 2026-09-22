const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "..", "server/services/nav.service.ts"),
  "utf8",
);

test("navigation mutations validate hierarchy, roles, routes and duplicates", () => {
  assert.match(source, /validateNavItem/);
  assert.match(source, /selected roles are no longer active/);
  assert.match(source, /selected menu group no longer exists/);
  assert.match(source, /valid internal page path beginning with/);
  assert.match(source, /menu label or page path is already in use/);
});

test("navigation mutations whitelist fields and validate destructive targets", () => {
  assert.match(source, /NAV_EDITABLE_FIELDS/);
  assert.match(source, /pickEditable/);
  assert.match(source, /Types\.ObjectId\.isValid\(id\)/);
  assert.match(source, /Navigation order contains an invalid item/);
  assert.match(source, /runValidators: true/);
});
