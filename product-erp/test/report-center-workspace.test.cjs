const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Report Center uses live role and dataset metadata without technical user inputs', () => {
  const page = read(
    'src/features/role-wise-features/report-center/components/ReportCenterPage.tsx',
  );

  assert.match(page, /AsyncSelect/);
  assert.match(page, /type="roles"/);
  assert.match(page, /multiple/);
  assert.match(page, /report-center\/metadata/);
  assert.match(page, /No active institution roles are available for sharing/);
  assert.doesNotMatch(page, /const ROLE_OPTIONS/);
  assert.doesNotMatch(page, /Mongo ID|database ID/i);
});

test('Report Center provides guided loading, failure, empty and retry states', () => {
  const page = read(
    'src/features/role-wise-features/report-center/components/ReportCenterPage.tsx',
  );

  assert.match(page, /Report Center could not load institution data/);
  assert.match(page, /refreshWorkspace/);
  assert.match(page, /animate-pulse/);
  assert.match(page, /No scheduled deliveries/);
  assert.match(page, /No evidence snapshots yet/);
  assert.match(page, /No eligible people match this search/);
});

test('Report exports resolve labels from the active report dataset', () => {
  const page = read(
    'src/features/role-wise-features/report-center/components/ReportCenterPage.tsx',
  );

  assert.match(page, /fields: IField\[\]/);
  assert.match(page, /datasets\.find\(\(item\) => item\.key === activeReport\.dataset\)\?\.fields/);
  assert.match(page, /Excel-compatible CSV/);
});

test('scheduled reports expose understandable access and delivery health', () => {
  const page = read(
    'src/features/role-wise-features/report-center/components/ReportCenterPage.tsx',
  );

  assert.match(page, /Recipients are checked against this report&apos;s visibility/);
  assert.match(page, /Delivery failed/);
  assert.match(page, /Check report access and recipients, then resume delivery/);
  assert.match(page, /Delivering/);
});

test('Report Center actions follow the active role permission grid', () => {
  const page = read(
    'src/features/role-wise-features/report-center/components/ReportCenterPage.tsx',
  );

  assert.match(page, /useHasPermission\('report_center', 'create'\)/);
  assert.match(page, /useHasPermission\('report_center', 'edit'\)/);
  assert.match(page, /useHasPermission\('report_center', 'approve'\)/);
  assert.match(page, /useHasPermission\('report_center', 'export'\)/);
  assert.doesNotMatch(page, /useHasAnyRole/);
});
