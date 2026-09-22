const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/examination/components/ExaminationPage.tsx',
  ),
  'utf8',
);

test('examination workspace follows the active portal role and permissions', () => {
  assert.match(
    source,
    /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/,
  );
  assert.match(source, /const canView = useHasPermission\('examination', 'view'\)/);
  assert.match(source, /const isAdmin = isAdminRole && canEdit/);
  assert.match(source, /isAdminRole\s*\? isAdmin\s*\? adminTabs\s*: institutionViewerTabs/);
  assert.doesNotMatch(source, /const isStudent = !isFaculty/);
});

test('each examination role receives only backend-supported tabs', () => {
  const facultyTabs = source.match(/const facultyTabs:[\s\S]*?const departmentTabs:/)?.[0] ?? '';
  const studentTabs = source.match(/const studentTabs:[\s\S]*?const tabs =/)?.[0] ?? '';

  assert.match(facultyTabs, /Marks Entry/);
  assert.doesNotMatch(facultyTabs, /label: 'Results'/);
  assert.doesNotMatch(studentTabs, /label: 'Schedules'/);
  assert.match(source, /label: 'Department Results'/);
  assert.match(source, /tabs\.length > 0 &&/);
});

test('role changes cannot leave a hidden examination tab active', () => {
  assert.match(source, /tabs\.some\(\(tab\) => tab\.id === activeTab\)/);
  assert.match(source, /const visibleActiveTab/);
  assert.match(source, /: tabs\[0\]\?\.id/);
});
