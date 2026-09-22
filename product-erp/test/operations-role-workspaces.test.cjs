const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const payroll = read('src/features/role-wise-features/payroll/components/PayrollPage.tsx');
const grievance = read('src/features/role-wise-features/grievance/components/GrievancePage.tsx');
const notice = read('src/features/role-wise-features/notice/components/NoticePage.tsx');

test('payroll preparation review approval and payment follow active role', () => {
  assert.match(payroll, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(payroll, /\['super_admin', 'hr_department'\]\.includes\(activeRole/);
  assert.match(payroll, /\['super_admin', 'accounts_department'\]\.includes\(activeRole/);
  assert.doesNotMatch(payroll, /state\.user\?\.roles/);
  assert.doesNotMatch(payroll, /new Date\(\)\.get(?:Month|FullYear)/);
  assert.match(payroll, /Select a payroll month and year first/);
});

test('grievance staff and student workspaces follow active role', () => {
  assert.match(grievance, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(grievance, /STAFF_ROLES\.includes\(activeRole/);
  assert.doesNotMatch(grievance, /useHasRole|useHasAnyRole/);
  assert.match(grievance, /Grievance access unavailable/);
  assert.match(grievance, /Grievances could not be loaded/);
});

test('notice management requires active manager identity and create permission', () => {
  assert.match(notice, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(notice, /\['super_admin', 'principal', 'dean_academic', 'hod'\]\.includes/);
  assert.match(notice, /hasCreatePermission/);
  assert.match(notice, /Notice access unavailable/);
});
