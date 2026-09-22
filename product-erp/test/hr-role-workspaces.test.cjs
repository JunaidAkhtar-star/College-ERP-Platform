const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/features/role-wise-features/hr/components/HrPage.tsx'),
  'utf8',
);

test('HR viewing editing and termination follow separate active-role capabilities', () => {
  assert.match(source, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(source, /const canViewAll =/);
  assert.match(source, /const canEdit =/);
  assert.match(source, /const canTerminate = \['super_admin', 'admin', 'principal'\]/);
  assert.match(source, /\.\.\.\(canEdit/);
  assert.match(source, /\.\.\.\(canTerminate/);
  assert.doesNotMatch(source, /const isAdmin =/);
});

test('HR employment types match the backend enum exactly', () => {
  for (const value of ['permanent', 'contractual', 'visiting', 'adhoc', 'guest_faculty']) {
    assert.match(source, new RegExp(`value="${value}"`));
  }
  assert.doesNotMatch(source, /value="(?:full_time|part_time|contract)"/);
  assert.match(source, /summary\?: \{ total\?: number; active\?: number; permanent\?: number \}/);
});

test('HR self profile list and detail expose complete recovery states', () => {
  assert.match(source, /HR access unavailable/);
  assert.match(source, /Your HR profile could not be loaded/);
  assert.match(source, /Employee records could not be loaded/);
  assert.match(source, /Employee details could not be loaded/);
  assert.match(source, /No HR record found/);
});
