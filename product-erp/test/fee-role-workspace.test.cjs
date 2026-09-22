const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const feePage = fs.readFileSync(
  path.join(__dirname, '..', 'src/features/role-wise-features/fee/components/FeePage.tsx'),
  'utf8',
);
const studentView = fs.readFileSync(
  path.join(__dirname, '..', 'src/features/role-wise-features/fee/components/StudentFeeView.tsx'),
  'utf8',
);

test('fee workspace follows active role and fee permissions', () => {
  assert.match(feePage, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(feePage, /useHasPermission\('fee_management', 'view'\)/);
  assert.match(feePage, /canManage=\{canCreate \|\| canEdit\}/);
  assert.doesNotMatch(feePage, /useHasAnyRole\(\['student', 'parent'\]\)/);
});

test('read-only fee monitors cannot open financial mutation workspaces', () => {
  assert.match(feePage, /canManage\s*\? \[/);
  assert.match(feePage, /const actions: Action<IFeeRecord>\[\] = canManage/);
  assert.match(feePage, /Fee management access unavailable/);
});

test('parents use ward-owned fee and payment submission endpoints', () => {
  assert.match(studentView, /isParent \? 'parent\/fees'/);
  assert.match(studentView, /isParent \? 'parent\/fees\/history'/);
  assert.match(studentView, /\? 'parent\/fees\/pay'/);
  assert.match(studentView, /body\.append\(isParent \? 'amountPaid' : 'amountSubmitted'/);
});

test('payment modes submit backend codes while displaying friendly labels', () => {
  assert.match(studentView, /const DEFAULT_PAYMENT_MODES = \['upi', 'neft'/);
  assert.match(studentView, /value=\{m\}/);
  assert.match(studentView, /PAYMENT_MODE_LABELS\[m\] \?\? m/);
});
