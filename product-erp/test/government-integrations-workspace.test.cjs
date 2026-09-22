const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('government integrations workspace exposes governed provider onboarding', () => {
  const page = read(
    'src/features/role-wise-features/government-integrations/components/GovernmentIntegrationsPage.tsx',
  );
  assert.match(page, /DigiLocker|digilocker/);
  assert.match(page, /Nodal officer/);
  assert.match(page, /Institutional authorization confirmed/);
  assert.match(page, /Enable production/);
  assert.match(page, /useHasPermission\('regulatory_integration', 'edit'\)/);
  assert.match(page, /officialUrl/);
  assert.doesNotMatch(page, /summary\.total \?\? 5/);
  assert.match(page, /summary\.total \?\? 0/);
});

test('government integrations has an ERP route and responsive modal', () => {
  assert.match(
    read('src/app/[tenant]/[role]/government-integrations/page.tsx'),
    /GovernmentIntegrationsPage/,
  );
  const page = read(
    'src/features/role-wise-features/government-integrations/components/GovernmentIntegrationsPage.tsx',
  );
  assert.match(page, /sm:items-center/);
  assert.match(page, /max-h-\[94vh\]/);
});

test('government integrations exposes live data operations and governed submissions', () => {
  const operations = read(
    'src/features/role-wise-features/government-integrations/components/GovernmentIntegrationOperations.tsx',
  );
  assert.match(operations, /Live ERP data/);
  assert.match(operations, /Issues to resolve/);
  assert.match(operations, /Create validated batch/);
  assert.match(operations, /Request review/);
  assert.match(operations, /Approve/);
  assert.match(operations, /Record submission/);
  assert.match(operations, /Reconcile/);
  assert.match(operations, /Governed portal export/);
  assert.match(operations, /Official API connector/);
  assert.match(operations, /Saved securely/);
  assert.match(operations, /approved provider adapter/);
});

test('connection credentials are visible only to authorized connection administrators', () => {
  const operations = read(
    'src/features/role-wise-features/government-integrations/components/GovernmentIntegrationOperations.tsx',
  );
  assert.match(operations, /const canManageConnection =/);
  assert.match(operations, /\['super_admin', 'admin'\]\.includes/);
  assert.match(operations, /disabled=\{!canManageConnection\}/);
  assert.match(operations, /\{canManageConnection && \(/);
});

test('data operations uses a guided workflow instead of simultaneous tables', () => {
  const operations = read(
    'src/features/role-wise-features/government-integrations/components/GovernmentIntegrationOperations.tsx',
  );
  assert.match(
    operations,
    /type TOperationView = 'readiness' \| 'records' \| 'submissions' \| 'connection'/,
  );
  assert.match(operations, /aria-label="Data operations workflow"/);
  assert.match(operations, /Check readiness/);
  assert.match(operations, /Resolve records/);
  assert.match(operations, /Submit & track/);
  assert.match(operations, /view === 'records'/);
  assert.match(operations, /data=\{visibleRecords\}/);
  assert.match(operations, /view === 'submissions'/);
  assert.match(operations, /data=\{visibleBatches\}/);
  assert.match(operations, /showBatchHistory/);
  assert.match(operations, /Your responsibility in this step/);
});
