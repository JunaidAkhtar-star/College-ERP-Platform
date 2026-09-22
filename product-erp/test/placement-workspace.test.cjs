const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/placement/components/PlacementPage.tsx',
  ),
  'utf8',
);

test('placement drives use authoritative backend fields and dynamic academic data', () => {
  for (const field of [
    'academicYear',
    'jobRole',
    'registrationStart',
    'registrationEnd',
    'package',
    'venue',
    'rounds',
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /type="academicYears"/);
  assert.match(source, /type="programs"/);
  assert.match(source, /type="departments"/);
  assert.match(source, /type="batches"/);
});

test('placement candidate journey follows shortlist, rounds, selection and offer contracts', () => {
  assert.match(source, /body: \{ studentIds: \[studentId\] \}/);
  assert.match(source, /results: \[\{ applicationId: app\._id, status: answer\.value \}\]/);
  assert.match(source, /body: \{ applicationIds: \[app\._id\] \}/);
  assert.match(source, /form\.append\('offerLetter'/);
  assert.match(source, /isFormData: true/);
});

test('students can review and respond to governed offers', () => {
  assert.match(source, /placement\/my\/applications/);
  assert.match(source, /response: 'accept' \| 'decline'/);
  assert.match(source, /View offer letter/);
});

test('placement empty views use the shared guided empty state', () => {
  assert.match(source, /import Empty from '@\/shared\/core\/Empty'/);
  assert.match(source, /No placement drives found/);
  assert.match(source, /No placement applications yet/);
});
