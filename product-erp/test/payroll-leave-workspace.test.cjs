const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const payroll = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/payroll/components/PayrollPage.tsx'),
  'utf8',
);
const leave = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/leave/components/LeavePage.tsx'),
  'utf8',
);

test('payroll exposes the governed prepare-review-approve-pay sequence', () => {
  assert.match(payroll, /1\. Salary & policy/);
  assert.match(payroll, /2\. Prepare/);
  assert.match(payroll, /3\. Review & approve/);
  assert.match(payroll, /4\. Pay & publish/);
  assert.match(payroll, /payroll\/\$\{row\._id\}\/\$\{action\}/);
  assert.match(payroll, /row\.status !== 'approved' \|\| !canMarkPaid/);
});

test('payroll preparation uses the selected period and supports governed policy inputs', () => {
  assert.match(payroll, /if \(!filterMonth \|\| !filterYear\)/);
  assert.match(payroll, /const currentMonth = Number\(filterMonth\)/);
  assert.match(payroll, /const currentYear = Number\(filterYear\)/);
  assert.match(payroll, /taxSlabs: slabs\.map/);
  assert.match(payroll, /employeePfPercent/);
  assert.match(payroll, /standardDeduction/);
});

test('leave routing follows HOD review before final approval', () => {
  assert.match(leave, /const atHodStage = leave\.hodApproval/);
  assert.match(leave, /atHodStage && isHod/);
  assert.match(leave, /!atHodStage && isAdminApprover/);
  assert.match(leave, /r\.hodApproval === 'approved'/);
});

test('leave UI does not ask users for technical attachment URLs', () => {
  assert.doesNotMatch(leave, /Attachment URL/);
  assert.match(leave, /<progress/);
});

test('leave analytics never invent a duration when the API omits total days', () => {
  assert.doesNotMatch(leave, /totalDays \?\? 1/);
  assert.match(leave, /totalDays \?\? 0/);
});
