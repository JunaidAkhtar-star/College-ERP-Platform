const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('financial-aid workspace covers packaging, acceptance and reconciliation', () => {
  const page = read('src/features/role-wise-features/financial-aid/components/FinancialAidPage.tsx');
  assert.match(page, /Build package/);
  assert.match(page, /Accept all awards/);
  assert.match(page, /Reconcile disbursement/);
  assert.match(page, /type="studentProfiles"/);
  assert.match(page, /<FieldArray/);
  assert.match(page, /validationSchema=\{packageSchema\}/);
  assert.doesNotMatch(page, /Enter student ID|MongoDB|ObjectId/i);
});

test('financial aid is connected to the finance journey and app route', () => {
  assert.match(read('src/shared/components/FinanceWorkflowBar.tsx'), /route: 'financial-aid'/);
  assert.match(read('src/app/[tenant]/[role]/financial-aid/page.tsx'), /FinancialAidPage/);
});
