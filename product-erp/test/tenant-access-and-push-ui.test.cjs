const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('tenant auth replaces sign-in with a dedicated inaccessible-workspace experience', () => {
  const layout = read('src/features/auth/layouts/AuthLayout.tsx');
  assert.match(layout, /tenant-domain\/access-status/);
  assert.match(layout, /TenantUnavailable/);
  assert.match(layout, /institution workspace is currently unavailable/);
  assert.match(layout, /Re-check status/);
  assert.match(layout, /Contact support/);
});

test('push preference switches are disabled until Firebase readiness is verified', () => {
  const hook = read('src/shared/hooks/usePushReadiness.ts');
  const settings = read('src/features/role-wise-features/settings/components/SettingsPage.tsx');
  const notifications = read(
    'src/features/role-wise-features/notification/components/NotificationPage.tsx',
  );
  assert.match(hook, /tenant-integrations\/firebase\/readiness/);
  assert.match(settings, /saving \|\| unavailable/);
  assert.match(notifications, /disabled=\{unavailable\}/);
});

test('notification center is a guided actionable inbox with one search and valid delivery contracts', () => {
  const notifications = read(
    'src/features/role-wise-features/notification/components/NotificationPage.tsx',
  );
  assert.match(notifications, /notification\/read-all/);
  assert.match(notifications, /Open related work/);
  assert.match(notifications, /Search notifications/);
  assert.match(notifications, /type="users"/);
  assert.match(notifications, /body: values\.message/);
  assert.match(notifications, /audience: values\.audience/);
  assert.match(notifications, /channels: values\.channels/);
  assert.doesNotMatch(notifications, /targetAudience: \(editing/);
});

test('push notifications request first-start browser consent and respect later manual opt-out', () => {
  const hook = read('src/shared/hooks/useFcm.ts');
  const notifications = read(
    'src/features/role-wise-features/notification/components/NotificationPage.tsx',
  );
  const settings = read('src/features/role-wise-features/settings/components/SettingsPage.tsx');

  assert.match(hook, /Notification\.requestPermission\(\)/);
  assert.match(hook, /preferenceResponse/);
  assert.match(hook, /deleteToken\(messaging\)/);
  assert.match(hook, /PUSH_MANUAL_OPTOUT_KEY/);
  assert.match(hook, /push: true/);
  assert.match(notifications, /Notification\.requestPermission\(\)/);
  assert.match(notifications, /notification\/fcm-token/);
  assert.match(notifications, /Push access removed/);
  assert.match(notifications, /saveToLocalStorage\(PUSH_MANUAL_OPTOUT_KEY/);
  assert.match(settings, /Allow Notifications in site settings/);
});

test('background push uses current institution branding instead of provider branding', () => {
  const hook = read('src/shared/hooks/useFcm.ts');
  const worker = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js'),
    'utf8',
  );
  assert.match(hook, /institutionName/);
  assert.match(hook, /institutionLogoUrl/);
  assert.match(worker, /institutionName/);
  assert.match(worker, /institutionLogoUrl/);
  assert.doesNotMatch(worker, /devvelocitylogo/);
});
