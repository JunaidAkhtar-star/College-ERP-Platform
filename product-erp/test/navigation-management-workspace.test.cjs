const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/nav-admin/components/NavAdminPage.tsx',
  ),
  'utf8',
);

test('navigation management is a guided searchable visual workspace', () => {
  assert.match(source, /Navigation Management/);
  assert.match(source, /Search menu names, pages or roles/);
  assert.match(source, /Sidebar preview/);
  assert.match(source, /Choose where this page appears/);
  assert.match(source, /Choose a familiar visual cue; no icon code is required/);
  assert.match(source, /Use the arrow controls after saving/);
});

test('navigation visibility uses active tenant roles and prevents client-side duplicates', () => {
  assert.match(source, /role\?includeInactive=true/);
  assert.match(source, /\.filter\(\(role\) => role\.isActive\)/);
  assert.match(source, /This page is already present in the navigation/);
  assert.match(source, /A group with this name already exists/);
  assert.doesNotMatch(source, /const KNOWN_ROLES/);
  assert.doesNotMatch(source, /Lucide icon name \(case-sensitive\)/);
});
