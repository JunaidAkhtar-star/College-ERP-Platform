const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('alumni directory uses the authoritative backend profile fields', () => {
  const page = read('features/role-wise-features/alumni/components/AlumniPage.tsx');
  for (const field of [
    'fullName',
    'passoutYear',
    'currentDesignation',
    'currentLocation',
    'careerOutcomeVerified',
  ]) {
    assert.match(page, new RegExp(field));
  }
  assert.doesNotMatch(page, /row\.name|graduationYear|jobTitle|row\.location/);
});

test('graduation and career outcomes follow governed backend transitions', () => {
  const page = read('features/role-wise-features/alumni/components/AlumniPage.tsx');
  assert.match(page, /graduation-candidates/);
  assert.match(page, /students\/\$\{row\.studentProfileId\}\/graduate/);
  assert.match(page, /career\/verify/);
  assert.match(page, /cannot be manually overridden/);
});

test('contributions select verified alumni and support independent accounting decisions', () => {
  const donations = read('features/role-wise-features/alumni/components/DonationsTab.tsx');
  assert.match(donations, /type="alumni"/);
  assert.match(donations, /accounts_department/);
  assert.match(donations, /\/confirm/);
  assert.match(donations, /\/fail/);
  assert.doesNotMatch(donations, /option value="USD"|limit=500/);
});

test('alumni engagements are planned with real alumni and closed with outcomes', () => {
  const engagement = read('features/role-wise-features/alumni/components/EngagementTab.tsx');
  assert.match(engagement, /type="alumni"/);
  assert.match(engagement, /mentorship/);
  assert.match(engagement, /guest_talk/);
  assert.match(engagement, /engagements\/\$\{row\._id\}\/close/);
});
