const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const profile = read(
  'src/features/role-wise-features/faculty-profile/components/FacultyProfilePage.tsx',
);
const workload = read(
  'src/features/role-wise-features/faculty-workload/components/FacultyWorkloadPage.tsx',
);

test('faculty directory follows active role and separates HR lifecycle capabilities', () => {
  assert.match(profile, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(profile, /const canBrowseDirectory = directoryRoles\.includes/);
  assert.match(profile, /const canManageFaculty = hrManagerRoles\.includes/);
  assert.match(profile, /const canOnboardFaculty = hrManagerRoles\.includes/);
  assert.doesNotMatch(profile, /useHasRole|useHasAnyRole/);
});

test('faculty profile handles self loading, missing records, and governed non-deletion', () => {
  assert.match(profile, /isLoading: isLoadingMe/);
  assert.match(profile, /Faculty profile unavailable/);
  assert.match(profile, /Faculty directory access unavailable/);
  assert.doesNotMatch(profile, /handleDelete|method: 'DELETE'/);
});

test('workload preparation and approval are independent active-role capabilities', () => {
  assert.match(workload, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(workload, /const canEdit = \['super_admin', 'hod'\]/);
  assert.match(
    workload,
    /const canApprove =\s*\['super_admin', 'principal', 'dean_academic'\]\.includes/,
  );
  assert.match(workload, /Faculty workload access unavailable/);
});

test('workload academic years are configured backend options without generated fallbacks', () => {
  assert.match(workload, /type="academicYears"/);
  assert.match(workload, /No configured academic years are available/);
  assert.doesNotMatch(workload, /getCurrentAcademicYear|getAcademicYearOptions/);
  assert.match(workload, /type="programs"/);
  assert.match(workload, /type="sections"/);
  assert.doesNotMatch(workload, /section: 'A'|totalHours: 45/);
});
