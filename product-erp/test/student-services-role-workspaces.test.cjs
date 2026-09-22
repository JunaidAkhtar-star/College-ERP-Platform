const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const hostel = read('src/features/role-wise-features/hostel/components/HostelPage.tsx');
const transport = read('src/features/role-wise-features/transport/components/TransportPage.tsx');
const library = read('src/features/role-wise-features/library/components/LibraryPage.tsx');

test('hostel selects student or staff workspace from active role only', () => {
  assert.match(hostel, /selectedRole\?\.baseRole \?\? selectedRole\?\.name \?\? selectedSystemRole/);
  assert.match(hostel, /const isStudent = activeRole === 'student'/);
  assert.match(hostel, /useSwr\(isAdmin \? 'hostel\/visitors' : null\)/);
  assert.doesNotMatch(hostel, /useHasRole|useHasAnyRole/);
  assert.match(hostel, /Hostel access unavailable/);
  assert.match(hostel, /Hostel services could not be loaded/);
});

test('transport has distinct staff and student tabs and active-role management', () => {
  assert.match(transport, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(transport, /const tabs:[\s\S]*?= canManage\s*\?/);
  assert.match(transport, /label: 'My allocation'/);
  assert.match(transport, /label: 'My fees'/);
  assert.match(transport, /Transport services could not be loaded/);
});

test('library staff controls require active operational identity', () => {
  assert.match(library, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(library, /\['super_admin', 'library_staff'\]\.includes\(activeRole/);
  assert.match(library, /Library access unavailable/);
  assert.match(library, /Books could not be loaded/);
  assert.match(library, /Issues could not be loaded/);
  assert.match(library, /Digital resources could not be loaded/);
});
