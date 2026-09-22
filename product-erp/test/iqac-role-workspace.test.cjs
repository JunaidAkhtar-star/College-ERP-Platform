const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/iqac/components/IqacPage.tsx'),
  'utf8',
);

test('IQAC UI combines active-role workflow scope with granular permissions', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.doesNotMatch(source, /state\.user\?\.roles \?\? \[\]/);
  assert.match(source, /const canEditAudits =\s*auditEditors\.includes\(activeRole\)/);
  assert.match(source, /useHasPermission\('iqac', 'create'\)/);
  assert.match(source, /useHasPermission\('iqac', 'edit'\)/);
  assert.match(source, /useHasPermission\('iqac', 'approve'\)/);
});

test('IQAC lists and analysis require a selected academic year', () => {
  assert.match(source, /academicYear \? `iqac\/audits/);
  assert.match(source, /feedback\/analysis\?academicYear=/);
  assert.match(source, /type="academicYears"/);
});

test('IQAC maps backend aggregate fields and exposes request failures', () => {
  assert.match(source, /criterion: row\._id, averageScore: row\.avg/);
  assert.match(source, /poCode: row\._id/);
  assert.match(source, /attainmentError/);
  assert.match(source, /feedbackError/);
});

test('attainment approval is independent from calculation and submission', () => {
  assert.match(source, /isIndependentApprover/);
  assert.match(source, /idOf\(record\.calculatedBy\) !== userId/);
  assert.match(source, /idOf\(record\.submittedBy\) !== userId/);
});
