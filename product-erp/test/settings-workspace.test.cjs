const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('settings provides a guided role-aware administration workspace', () => {
  const settings = read('src/features/role-wise-features/settings/components/SettingsPage.tsx');

  assert.match(settings, /Institution setup overview/);
  assert.match(settings, /Your account/);
  assert.match(settings, /Institution administration/);
  assert.match(settings, /activeRoleName === 'super_admin'/);
  assert.match(settings, /activeRoleName === 'admin'/);
  assert.match(settings, /Configuration controls are shown only when your active role can/);
  assert.match(settings, /Profile complete/);
  assert.match(settings, /Action required/);
});

test('settings uses tenant data and shared storage helpers for notification consent', () => {
  const settings = read('src/features/role-wise-features/settings/components/SettingsPage.tsx');

  assert.match(settings, /useSwr<IApiResponse<IInstitutionSetting>>\('institution-setting'\)/);
  assert.match(settings, /saveToLocalStorage\(PUSH_MANUAL_OPTOUT_KEY/);
  assert.match(settings, /removeFromLocalStorage\(PUSH_MANUAL_OPTOUT_KEY/);
  assert.doesNotMatch(settings, /window\.localStorage/);
  assert.doesNotMatch(settings, /name: settings\?\.name \|\| 'Institution'/);
});

test('every administrator settings tab has guided loading, failure and safety behavior', () => {
  const integrations = read(
    'src/features/role-wise-features/settings/components/TenantIntegrationsTab.tsx',
  );
  const backup = read('src/features/role-wise-features/settings/components/TenantBackupTab.tsx');
  const domain = read('src/features/role-wise-features/settings/components/TenantDomainTab.tsx');
  const subscription = read(
    'src/features/role-wise-features/settings/components/TenantSubscriptionTab.tsx',
  );
  const connectors = read(
    'src/features/role-wise-features/settings/components/AvailableConnectorsSection.tsx',
  );

  assert.match(integrations, /Institution integrations could not be loaded/);
  assert.match(integrations, /Saved — run readiness test/);
  assert.match(integrations, /await query\.mutate\(\)/);
  assert.match(integrations, /await ssoQuery\.mutate\(\)/);
  assert.match(backup, /Backup controls could not be loaded/);
  assert.match(backup, /Google Drive connected/);
  assert.match(domain, /Save your domain/);
  assert.match(domain, /Add both DNS records/);
  assert.match(domain, /Remove the custom domain/);
  assert.match(domain, /Domain settings could not be loaded/);
  assert.match(subscription, /Subscription information could not be loaded/);
  assert.match(connectors, /Available connectors could not be loaded/);
});

test('personal settings remain understandable without exposing backend session identifiers', () => {
  const settings = read('src/features/role-wise-features/settings/components/SettingsPage.tsx');

  assert.match(settings, /Sign out other devices/);
  assert.match(settings, /browser settings/);
  assert.doesNotMatch(settings, />Session ID</);
  assert.doesNotMatch(settings, />User agent</);
});

test('backup settings expose tenant data, local scheduling and persistent progress', () => {
  const backup = read('src/features/role-wise-features/settings/components/TenantBackupTab.tsx');
  const header = read('src/shared/layouts/Header.tsx');

  assert.match(backup, /Current tenant data/);
  assert.match(backup, /Protected data collections/);
  assert.match(backup, /Run time \(\{timezone\}\)/);
  assert.match(backup, /Secure backup in progress/);
  assert.match(backup, /progressMessage/);
  assert.match(backup, /Backup did not complete/);
  assert.match(header, /Secure backup/);
  assert.match(header, /tenant-backup/);
  assert.match(header, /activeJob \? 4000 : 60000/);
  assert.match(header, /refreshWhenHidden: false/);
});
