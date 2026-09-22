const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/student-profile/components/StudentProfilePage.tsx',
  ),
  'utf8',
);

test('student records follow the active portal role and granular capabilities', () => {
  assert.match(
    source,
    /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/,
  );
  assert.match(source, /const canLifecycleManage = lifecycleRoles\.includes/);
  assert.match(source, /const canCreateStudent = lifecycleRoles\.includes/);
  assert.match(source, /const canSetRegistrationNumber =/);
  assert.doesNotMatch(source, /useHasRole|useHasAnyRole/);
});

test('staff statistics and sensitive tabs are capability scoped', () => {
  assert.match(source, /canViewStats \? 'student-profile\/stats' : null/);
  assert.match(source, /canViewStats && stats/);
  assert.match(source, /canViewSensitive \? \(\['parents', 'documents'\] as const\) : \[\]/);
  assert.match(source, /canSetRegistrationNumber=\{canSetRegistrationNumber\}/);
  assert.match(source, /Student records access unavailable/);
});

test('student self view has loading, error, and edit-permission states', () => {
  assert.match(source, /isLoading: isLoadingMe/);
  assert.match(source, /Student profile unavailable/);
  assert.match(source, /hasEditPerm &&/);
});

test('bonafide generation submits the required purpose and lifecycle mutations parse responses', () => {
  assert.match(source, /body: \{ purpose: String\(request\.value\)\.trim\(\) \}/);
  assert.match(source, /Purpose must contain at least 3 characters/);
  assert.match(source, /results\?: \{ success\?: boolean \}/);
});

test('student self view includes a read-only, API-backed ABC credit ledger', () => {
  const panel = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src/features/role-wise-features/student-profile/components/StudentAbcPanel.tsx',
    ),
    'utf8',
  );

  assert.match(source, /<StudentAbcPanel \/>/);
  assert.match(panel, /useSwr<\{/);
  assert.match(panel, /'student-profile\/me\/abc-ledger'/);
  assert.match(panel, /Student view · read only/);
  assert.match(panel, /Institution-prepared batches/);
  assert.match(panel, /does not mean the government platform has accepted it/);
  assert.doesNotMatch(panel, /student-profile\/[^'\s]*\$\{/);
});
