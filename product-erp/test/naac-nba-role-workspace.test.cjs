const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/naac-nba/components/NaacNbaPage.tsx',
  ),
  'utf8',
);

test('NAAC and NBA capabilities follow only the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(source, /const canView =/);
  assert.match(source, /const canReview =/);
  assert.match(source, /const canGenerateReport =/);
  assert.doesNotMatch(source, /useHasRole|useHasAnyRole|state\.user\?\.roles/);
});

test('NAAC evidence owner and independent-review actions are guarded', () => {
  assert.match(source, /evidenceOwnerId\(r\) !== userId/);
  assert.match(source, /evidenceOwnerId\(r\) === userId/);
  assert.match(source, /evidenceOwnerId\(e\) === userId/);
  assert.match(source, /evidenceOwnerId\(e\) !== userId/);
});

test('NBA generation editing and independent approval are separate', () => {
  assert.match(source, /!canGenerateReport \|\| r\.status === 'approved'/);
  assert.match(source, /reportGeneratorId\(r\) === userId/);
  assert.match(source, /canReview && reportGeneratorId\(r\) !== userId/);
  assert.match(source, /reportDepartment\(r\)/);
});

test('NAAC and NBA lists require a dynamic academic year and expose recovery states', () => {
  assert.match(source, /const \[academicYear, setAcademicYear\] = useState\(''\)/);
  assert.match(source, /type="academicYears"/);
  assert.match(source, /tab === 'naac' && academicYear/);
  assert.match(source, /tab === 'nba' && academicYear/);
  assert.match(source, /Accreditation access unavailable/);
  assert.match(source, /Accreditation records could not be loaded/);
  assert.match(source, /Select an academic year to load NAAC evidence and NBA reports/);
});
