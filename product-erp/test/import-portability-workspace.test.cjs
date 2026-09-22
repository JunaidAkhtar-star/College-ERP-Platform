const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Import Center provides the complete guided migration journey', () => {
  const page = read(
    'src/features/role-wise-features/import-center/components/ImportCenterPage.tsx',
  );

  assert.match(page, /Choose template/);
  assert.match(page, /Upload & map/);
  assert.match(page, /Validate import/);
  assert.match(page, /Commit valid rows/);
  assert.match(page, /Download .* template/);
  assert.match(page, /Source preview/);
  assert.match(page, /Each destination field can be mapped once/);
  assert.match(page, /Download errors/);
  assert.match(page, /No import history yet/);
});

test('imports expose persistent understandable progress without technical identifiers', () => {
  const page = read(
    'src/features/role-wise-features/import-center/components/ImportCenterPage.tsx',
  );
  const header = read('src/shared/layouts/Header.tsx');

  assert.match(page, /result\.processedRows/);
  assert.match(page, /aria-label="Import progress"/);
  assert.match(header, /Data import/);
  assert.match(header, /import-center/);
  assert.match(header, /\['queued', 'committing'\]\.includes\(job\.status\)/);
  assert.match(header, /\? 3000\s*: 60000/);
  assert.match(header, /refreshWhenHidden: false/);
  assert.doesNotMatch(page, /import-errors-\$\{job\._id\}/);
});

test('Data Portability uses live selectors and governed, recoverable states', () => {
  const page = read(
    'src/features/role-wise-features/data-portability/components/DataPortabilityPage.tsx',
  );

  assert.match(page, /type="users"/);
  assert.match(page, /type="academicYears"/);
  assert.match(page, /Search by name or email/);
  assert.match(page, /No secure export requests yet/);
  assert.match(page, /Data Portability could not load securely/);
  assert.match(page, /refreshWorkspace/);
  assert.doesNotMatch(page, /placeholder="Subject user ID"/);
  assert.doesNotMatch(page, />\{row\.subjectUserId\}</);
});
