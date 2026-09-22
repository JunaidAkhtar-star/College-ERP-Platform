const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const list = read('src/features/role-wise-features/admission/components/AdmissionPage.tsx');
const detail = read(
  'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
);
const initiate = read(
  'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
);

test('admission list actions follow the active role and separate workflow capabilities', () => {
  assert.match(list, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(list, /const canOperate =/);
  assert.match(list, /const canDecide =/);
  assert.match(list, /const canManagePayment =/);
  assert.match(list, /!canOperate \|\| app\.status !== 'submitted'/);
  assert.match(list, /!canDecide \|\| app\.status !== 'under_review'/);
  assert.doesNotMatch(list, /useHasRole|useHasAnyRole/);
});

test('admission analytics and imports require an explicitly selected academic year', () => {
  assert.match(list, /canView && filters\.academicYear/);
  assert.match(list, /admission\/dashboard\?academicYear=/);
  assert.match(list, /const \[academicYear, setAcademicYear\] = useState\(''\)/);
  assert.match(list, /Choose an academic year/);
  assert.match(initiate, /academicYear: ''/);
  assert.doesNotMatch(initiate, /currentAcademicYear/);
});

test('admission detail keeps operations decisions payments and enrollment separate', () => {
  assert.match(detail, /const canOperate =/);
  assert.match(detail, /const canDecide =/);
  assert.match(detail, /const canManagePayment =/);
  assert.match(detail, /const canEnroll =/);
  assert.match(detail, /app\.status === 'under_review' && canDecide/);
  assert.match(detail, /app\.status === 'approved' && canEnroll/);
  assert.match(detail, /Admission access unavailable/);
  assert.match(detail, /Application could not be loaded/);
  assert.doesNotMatch(detail, /useHasRole|useHasAnyRole/);
});
