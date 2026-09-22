const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('audit log is a guided investigation workspace without duplicate search', () => {
  const page = read(
    'features/role-wise-features/audit-log/components/AuditLogPage.tsx',
  );
  assert.match(page, /Tamper-resistant history/);
  assert.match(page, /What changed/);
  assert.match(page, /Requested/);
  assert.match(page, /Saved result/);
  assert.match(page, /Security and integrity/);
  assert.match(page, /options=\{\{ search: false/);
  assert.match(page, /No matching audit activity/);
});

test('audit exports understandable context instead of only technical identifiers', () => {
  const page = read(
    'features/role-wise-features/audit-log/components/AuditLogPage.tsx',
  );
  assert.match(page, /Description/);
  assert.match(page, /Risk/);
  assert.match(page, /Decision reason/);
  assert.match(page, /humanize/);
});
