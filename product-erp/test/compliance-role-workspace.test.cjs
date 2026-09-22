const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const page = read(
  'src/features/role-wise-features/compliance/components/ComplianceWorkspacePage.tsx',
);
const record = read(
  'src/features/role-wise-features/compliance/components/ComplianceRecordModal.tsx',
);
const tally = read(
  'src/features/role-wise-features/compliance/components/TallyIntegrationPanel.tsx',
);

test('compliance capabilities follow the active role and remain separate', () => {
  assert.match(page, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  for (const capability of ['canView', 'canConfigure', 'canReview', 'canContribute', 'canUseTally']) {
    assert.match(page, new RegExp(`const ${capability} =`));
  }
  assert.doesNotMatch(page, /useHasRole|useHasAnyRole|state\.user\?\.roles/);
  assert.match(page, /submittedById\(row\) === userId/);
});

test('compliance analytics and records require a dynamic academic year', () => {
  assert.match(page, /const \[academicYear, setAcademicYear\] = useState\(''\)/);
  assert.match(page, /type="academicYears"/);
  assert.match(page, /canView && academicYear/);
  assert.match(page, /Select an academic year to load compliance analytics/);
  assert.doesNotMatch(page, /new Date\(\)\.getFullYear/);
});

test('compliance provides denied error empty and immutable record states', () => {
  assert.match(page, /Compliance access unavailable/);
  assert.match(page, /Compliance data could not be loaded/);
  assert.match(page, /No compliance frameworks configured/);
  assert.match(page, /\['submitted', 'approved'\]\.includes\(editing\.status\)/);
  assert.match(record, /readOnly\?: boolean/);
  assert.match(record, /!readOnly && \([\s\S]*?<InlineFileUpload/);
});

test('Tally configuration has no generated year fallback or dark decorative panel', () => {
  assert.match(tally, /financialYear: ''/);
  assert.match(tally, /Tally configuration could not be loaded/);
  assert.doesNotMatch(tally, /new Date\(\)\.getFullYear/);
  assert.doesNotMatch(tally, /from-violet-600|to-indigo-700|text-white/);
});
