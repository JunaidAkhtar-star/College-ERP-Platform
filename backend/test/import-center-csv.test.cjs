const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv } = require("../build/services/import-center.service.js");

test("CSV parser preserves quoted commas, escaped quotes and multiline values", () => {
  const rows = parseCsv(
    'name,notes,amount\r\n"Doe, Jane","Said ""hello""\non arrival",1200\r\n',
  );
  assert.deepEqual(rows, [
    ["name", "notes", "amount"],
    ["Doe, Jane", 'Said "hello"\non arrival', "1200"],
  ]);
});

test("CSV parser rejects an unclosed quoted value", () => {
  assert.throws(() => parseCsv('name,notes\nJane,"unclosed'), /unclosed quoted value/);
});
