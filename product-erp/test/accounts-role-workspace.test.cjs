const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const page = read('src/features/role-wise-features/accounts/components/AccountsPage.tsx');
const controls = read(
  'src/features/role-wise-features/accounts/components/FinanceControlsTab.tsx',
);
const submissions = read(
  'src/features/role-wise-features/accounts/components/PaymentSubmissionsTab.tsx',
);

test('accounts workspace follows active role and granular permissions', () => {
  assert.match(page, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(page, /useHasPermission\('accounts', 'view'\)/);
  assert.match(page, /const canManage = isPreparerRole && \(canCreate \|\| canEdit\)/);
  assert.match(page, /const canApprove = isApproverRole && canApprovePermission/);
  assert.doesNotMatch(page, /useHasAnyRole/);
});

test('financial years are configured backend options, not generated dates', () => {
  assert.match(page, /type="academicYears"/);
  assert.match(page, /No configured financial years are available/);
  assert.doesNotMatch(page, /currentFinancialYear|fyBase|fyOptions/);
});

test('payment verification and finance controls receive role-safe capabilities', () => {
  assert.match(page, /PaymentSubmissionsTab canManage=\{canManage\}/);
  assert.match(page, /canPrepare=\{canManage\}/);
  assert.match(page, /canApprove=\{canApprove\}/);
  assert.match(submissions, /\.\.\.\(canManage/);
  assert.match(submissions, /canManage && viewing\.status/);
  assert.doesNotMatch(controls, /useHasAnyRole/);
});
