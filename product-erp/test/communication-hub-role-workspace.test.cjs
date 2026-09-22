const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/communication-hub/components/CommunicationHubPage.tsx',
  ),
  'utf8',
);

test('communication controls use active-role capabilities', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.match(source, /const canManageSuppressions = \['super_admin', 'admin'\]/);
  assert.match(source, /canManageSuppressions \? 'communication-hub\/suppressions' : null/);
});

test('campaign retry and cancellation respect creator ownership', () => {
  assert.match(source, /const canMutateCampaign = \(campaign: ICampaign\)/);
  assert.match(source, /!canMutateCampaign\(row\)/);
  assert.match(source, /idOf\(campaign\.createdBy\) === userId/);
});

test('metadata, template and suppression failures are visible', () => {
  assert.match(source, /metadataError/);
  assert.match(source, /templatesError/);
  assert.match(source, /suppressionsError/);
  assert.match(source, /Unable to load communication settings/);
});
