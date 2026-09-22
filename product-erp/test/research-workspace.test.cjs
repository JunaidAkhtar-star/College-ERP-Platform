const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/research-development/components/ResearchDevelopmentPage.tsx',
  ),
  'utf8',
);

test('research exposes the governed proposal-to-closure journey', () => {
  assert.match(source, /'Proposal'/);
  assert.match(source, /'Ethics & approval'/);
  assert.match(source, /'Grant execution'/);
  assert.match(source, /'Milestones'/);
  assert.match(source, /'Outputs & IP'/);
  assert.match(source, /'Closure'/);
});

test('research uses dynamic people, departments and evidence uploads', () => {
  assert.match(source, /type="faculty"/);
  assert.match(source, /type="departments"/);
  assert.match(source, /InlineFileUpload/);
  assert.doesNotMatch(source, /principal investigator id/i);
  assert.doesNotMatch(source, /department id/i);
});

test('research connects governed project and publication transitions', () => {
  assert.match(source, /ethicsStatus: 'approved'/);
  assert.match(source, /status: 'completed'/);
  assert.match(source, /utilizationCertificates:/);
  assert.match(source, /verificationStatus/);
  assert.match(source, /'submitted'/);
  assert.match(source, /'verified'/);
});
