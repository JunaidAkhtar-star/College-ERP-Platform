const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('finance pages expose one shared guided workspace', () => {
  for (const file of [
    'src/features/role-wise-features/fee/components/FeePage.tsx',
    'src/features/role-wise-features/accounts/components/AccountsPage.tsx',
    'src/features/role-wise-features/scholarship/components/ScholarshipPage.tsx',
    'src/features/role-wise-features/payment-settings/components/PaymentSettingsPage.tsx',
  ]) {
    assert.match(read(file), /FinanceWorkflowBar/);
  }
});

test('fee configuration and reports use dynamic academic master data', () => {
  for (const file of [
    'src/features/role-wise-features/fee/components/FeePage.tsx',
    'src/features/role-wise-features/fee/components/FeeStructuresTab.tsx',
    'src/features/role-wise-features/fee/components/FeeInvoiceTab.tsx',
    'src/features/role-wise-features/fee/components/FeeSummaryTab.tsx',
  ]) {
    assert.match(read(file), /type="academicYears"/);
  }
});

test('invoice generation uses the linked user and governed scholarship credits', () => {
  const source = read('src/features/role-wise-features/fee/components/FeeInvoiceTab.tsx');
  assert.match(source, /typeof profileData\.userId === 'object'/);
  assert.match(source, /Approved scholarship credits are applied automatically/);
  assert.doesNotMatch(source, /Add scholarship/);
});

test('scholarship applications select schemes and owned documents', () => {
  const source = read('src/features/role-wise-features/scholarship/components/ScholarshipPage.tsx');
  assert.match(source, /scholarship\/schemes/);
  assert.match(source, /document\/my/);
  assert.match(source, /schemeId: values\.schemeId/);
  assert.match(source, /referenceNo: remarks/);
  assert.match(source, /if \(isStudent\) return 'scholarship\/my'/);
  assert.doesNotMatch(source, /Document URLs \(comma-separated\)/);
});

test('accounts use governed reversal and selectable reconciliation', () => {
  const accounts = read('src/features/role-wise-features/accounts/components/AccountsPage.tsx');
  const controls = read(
    'src/features/role-wise-features/accounts/components/FinanceControlsTab.tsx',
  );
  assert.match(accounts, /accounts\/\$\{row\._id\}\/reverse/);
  assert.doesNotMatch(accounts, /method: 'DELETE'/);
  assert.match(controls, /Select journal voucher/);
  assert.doesNotMatch(controls, /Journal entry ID to reconcile/);
});

test('fee reconciliation uses a validated file workflow instead of pasted CSV', () => {
  const source = read('src/features/role-wise-features/fee/components/AdvancedFeesTab.tsx');
  assert.match(source, /parseReconciliationCsv/);
  assert.match(source, /fee-reconciliation-template\.csv/);
  assert.match(source, /accept="\.csv,text\/csv"/);
  assert.match(source, /MAX_RECONCILIATION_ROWS/);
  assert.match(source, /repeats transaction reference/);
  assert.doesNotMatch(source, /<textarea[^>]+transactionReference/s);
});
