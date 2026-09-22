const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const procurement = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/procurement/components/ProcurementPage.tsx',
  ),
  'utf8',
);
const store = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/store/components/StorePage.tsx'),
  'utf8',
);

test('procurement presents the governed requisition-to-payment sequence', () => {
  for (const label of [
    '1. Requisitions',
    '2. Vendors',
    '3. Quotations',
    '4. Purchase orders',
    '5. Receive & inspect',
    '6. Invoices & payment',
  ]) {
    assert.match(procurement, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(procurement, />Final approve</);
});

test('procurement uses guided decisions and handles rejected supplier goods', () => {
  assert.doesNotMatch(procurement, /window\.prompt/);
  assert.match(procurement, /goods-receipts\/\$\{row\._id\}\/return/);
  assert.match(procurement, /Return rejected/);
  assert.match(procurement, /title="Goods receipt and inspection register"/);
  assert.match(procurement, /onRefresh=\{\(\) => void grnQuery\.mutate\(\)\}/);
});

test('store actions are role safe and vendor data is dynamic', () => {
  assert.match(store, /!canManage \|\| !row\.isActive/);
  assert.match(store, /!canManage \|\| r\.status !== 'pending'/);
  assert.match(store, /procurement\/vendors/);
  assert.match(store, /Approved vendor/);
  assert.doesNotMatch(store, /Delete item\?/);
});
