const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('user management provides a guided dynamic access lifecycle', () => {
  const users = read('features/role-wise-features/users/components/UsersPage.tsx');
  assert.match(users, /role\?includeInactive=true/);
  assert.match(users, /Effective access preview/);
  assert.match(users, /user\/\$\{user\._id\}\/revoke-sessions/);
  assert.match(users, /A secure activation link is emailed to the user/);
  assert.match(users, /useHasPermission\('user_management', 'create'\)/);
  assert.match(users, /Select one or more roles/);
  assert.match(users, /type="roles"/);
  assert.match(users, /multiple/);
  assert.match(users, /standaloneOnly: true/);
  assert.match(users, /profile-aware onboarding/);
  assert.match(users, /max-w-4xl/);
  assert.match(users, /min-h-0 flex-1 space-y-6 overflow-y-auto/);
  assert.match(users, /shrink-0 justify-end gap-3 border-t/);
  assert.match(users, /options=\{\{\s*search:\s*false/);
  assert.match(users, /if \(Array\.isArray\(inner\)\) return inner/);
  assert.match(users, /response\?\.data\?\.pagination/);
  assert.match(users, /totalCount=\{pageMeta\?\.total \?\? filtered\.length\}/);
  assert.match(users, /setPageSize\(size\);\s*setPage\(0\)/);
  assert.match(users, /canCreateUser &&/);
  assert.match(users, /onClick=\{\(\) => setShowCreate\(true\)\}/);
  assert.match(users, /Add New User/);
  assert.doesNotMatch(users, /'iqac_team',\s*'placement_cell'/);
});

test('role management warns about unusable permissions and covers current modules', () => {
  const roles = read('features/role-wise-features/roles/components/RolesPage.tsx');
  assert.match(roles, /Review permission conflicts/);
  assert.match(roles, /research-development/);
  assert.match(roles, /'store'/);
  assert.match(roles, /'iic'/);
  assert.match(roles, /options=\{\{\s*search:\s*false/);
});
