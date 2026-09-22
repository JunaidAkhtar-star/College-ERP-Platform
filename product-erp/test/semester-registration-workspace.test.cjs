const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/semester-registration/components/SemesterRegistrationPage.tsx',
  ),
  'utf8',
);

test('registration workspace follows active role and explicit permissions', () => {
  assert.match(source, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(source, /const canView = useHasPermission\('semester_registration', 'view'\)/);
  assert.match(source, /const canCreate = useHasPermission\('semester_registration', 'create'\)/);
  assert.match(source, /const isAdmin = isStaffRole && canReview/);
  assert.match(source, /isStudent && canCreate/);
  assert.doesNotMatch(source, /useHasRole\('student'\)/);
});

test('academic years are backend options without generated fallback years', () => {
  assert.match(source, /type="academicYears"/);
  assert.match(source, /No configured academic years are available/);
  assert.doesNotMatch(source, /getAcademicYearOptions|currentAcademicYear/);
});

test('students select only authoritative electives and outstanding backlogs', () => {
  assert.match(source, /subject\.isElective \|\| subject\.isBacklogEligible/);
  assert.match(source, /isBacklog: sub\.isBacklogEligible \?\? false/);
  assert.doesNotMatch(source, /updateSubject\(idx/);
});

test('students can withdraw only backend-supported editable workflow states', () => {
  assert.match(source, /semester-registration\/mine\/\$\{reg\._id\}\/withdraw/);
  assert.match(source, /\['draft', 'submitted', 'rejected'\]/);
  assert.match(source, /Registration withdrawn/);
});
