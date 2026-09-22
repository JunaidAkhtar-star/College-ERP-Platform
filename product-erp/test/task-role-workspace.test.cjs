const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/task-management/components/TaskManagementPage.tsx',
  ),
  'utf8',
);

test('task creation follows the active system role', () => {
  assert.match(source, /activeRole\?\.baseRole \?\? activeRole\?\.name/);
  assert.match(source, /\['super_admin', 'admin', 'principal', 'hod'\]\.includes\(activeRoleName\)/);
  assert.doesNotMatch(source, /useHasPermission/);
});

test('staff search is loaded only for task assigners and HOD choices are department filtered', () => {
  assert.match(source, /isAssigner \? `user\?search=/);
  assert.match(source, /activeRoleName === 'hod'/);
  assert.match(source, /return uDeptId === myDeptId/);
});

test('task workspace exposes loading, error and retry states', () => {
  assert.match(source, /taskLoading/);
  assert.match(source, /taskError/);
  assert.match(source, /aria-label="Loading tasks"/);
  assert.match(source, /Retry/);
});
