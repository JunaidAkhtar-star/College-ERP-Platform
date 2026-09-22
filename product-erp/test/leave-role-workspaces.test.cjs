const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/leave/components/LeavePage.tsx',
  ),
  'utf8',
);

test('leave workspace capabilities follow only the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(source, /const isHod = \['super_admin', 'hod'\]\.includes\(activeRole/);
  assert.match(source, /const isAdminApprover = \['super_admin', 'principal'\]\.includes\(activeRole/);
  assert.match(source, /const canUseLeave = Boolean\(activeRole/);
  assert.doesNotMatch(source, /useHasRole|useHasAnyRole|state\.user\?\.roles/);
});

test('leave balance consumes the ledger contract for a selected dynamic academic year', () => {
  assert.match(source, /type="academicYears"/);
  assert.match(source, /leave\/balance\?academicYear=/);
  assert.match(source, /ledger\.casual - ledger\.casualUsed/);
  assert.match(source, /ledger\.onDuty - ledger\.onDutyUsed/);
  assert.match(source, /Select an academic year to load your recorded leave balance/);
  assert.match(source, /No leave balance ledger has been configured/);
});

test('leave workspace exposes permission and request error recovery states', () => {
  assert.match(source, /Employee leave access unavailable/);
  assert.match(source, /Leave requests could not be loaded/);
  assert.match(source, /Leave balance could not be loaded/);
  assert.match(source, />\s*Retry\s*</);
});
