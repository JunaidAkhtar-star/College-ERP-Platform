const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('tenant workspace applies the shared professional surface and motion system', () => {
  const layout = read('src/shared/layouts/index.tsx');
  const css = read('src/app/globals.css');
  const primitives = read('src/shared/core/EnterprisePage.tsx');
  assert.match(layout, /tenant-workspace/);
  assert.match(layout, /tenant-page-canvas/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(primitives, /export function EnterprisePage/);
  assert.match(primitives, /export function InsightCard/);
  assert.match(primitives, /export function GuidancePanel/);
});

test('ordinary information modules no longer use black dashboard cards', () => {
  const files = [
    'src/features/role-wise-features/dashboard/components/DashboardPage.tsx',
    'src/features/role-wise-features/dashboard/components/role-dashboards/StudentDashboard.tsx',
    'src/features/role-wise-features/accounts/components/FinanceControlsTab.tsx',
    'src/features/role-wise-features/compliance/components/ComplianceWorkspacePage.tsx',
    'src/features/role-wise-features/import-center/components/ImportCenterPage.tsx',
    'src/features/role-wise-features/data-portability/components/DataPortabilityPage.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /rounded-(?:xl|2xl|3xl)[^"\n]*bg-slate-900/, file);
    assert.doesNotMatch(source, /rounded-(?:xl|2xl|3xl)[^"\n]*from-slate-900/, file);
  }
});

test('table detail controls retain separators on either edge', () => {
  const table = read('src/shared/core/CustomTable.tsx');
  assert.match(table, /detailPanelPosition === 'left'/);
  assert.match(table, /border-b border-r border-t border-slate-100/);
  assert.match(table, /border-b border-l border-t border-slate-100/);
  assert.match(table, /w-12 border-b border-r border-slate-100/);
  assert.match(table, /w-12 border-b border-l border-slate-100/);
});
