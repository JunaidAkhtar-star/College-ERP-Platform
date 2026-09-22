const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const naac = read('src/features/role-wise-features/naac-nba/components/NaacNbaPage.tsx');
const iqac = read('src/features/role-wise-features/iqac/components/IqacPage.tsx');
const accreditation = read(
  'src/features/role-wise-features/accreditation/components/AccreditationPage.tsx',
);
const accreditationSetup = read(
  'src/features/role-wise-features/accreditation/components/AccreditationSetupPanel.tsx',
);

test('quality pages expose one connected evidence-to-improvement workflow', () => {
  for (const source of [naac, iqac, accreditation]) {
    assert.match(source, /QualityWorkflowBar/);
  }
});

test('NAAC evidence uses dynamic years, owned uploads and governed review', () => {
  assert.match(naac, /type="academicYears"/);
  assert.match(naac, /InlineFileUpload/);
  assert.match(naac, /evidenceFiles:/);
  assert.match(naac, /reviewNotes:/);
  assert.match(naac, /score,/);
});

test('NBA reports use governed linked entities and real attainment inputs', () => {
  assert.match(naac, /type="curricula"/);
  assert.match(naac, /type="departments"/);
  assert.match(naac, /coAttainments/);
  assert.match(naac, /poAttainments/);
  assert.doesNotMatch(naac, /placeholder="e\.g\. B\.Tech CSE"/);
});

test('IQAC feedback, audits and CO-PO avoid hardcoded scores, IDs and JSON forms', () => {
  assert.match(iqac, /Quality ratings/);
  assert.match(iqac, /type="faculty"/);
  assert.match(iqac, /type="subjects"/);
  assert.match(iqac, /Audit findings/);
  assert.doesNotMatch(iqac, /ratings: \[\{ criterion: 'Overall', score: 3 \}\]/);
  assert.doesNotMatch(iqac, /placeholder="Subject ID"/);
  assert.doesNotMatch(iqac, /CO Mappings \(JSON array\)/);
});

test('accreditation readiness is guided, year-scoped and permission-aware', () => {
  assert.match(accreditation, /naac-nba\/naac\/evidence\/summary\?academicYear=/);
  assert.match(accreditation, /naac-nba\/nba\/reports\?academicYear=/);
  assert.match(accreditation, /compliance\/export\/\$\{item\.endpoint\}\?academicYear=/);
  assert.match(accreditation, /useHasPermission\('naac', 'export'\)/);
  assert.match(accreditation, /useHasPermission\('nba', 'export'\)/);
  assert.match(accreditation, /NAAC criterion coverage/);
  assert.match(accreditation, /These are governed ERP extracts—not direct portal submissions/);
  assert.match(accreditation, /Manage evidence/);
  assert.doesNotMatch(accreditation, /Government-compliant CSV Template/);
  assert.doesNotMatch(accreditation, /transition-"/);
});

test('tenant accreditation setup guides classification, scope, review and snapshots', () => {
  assert.match(accreditation, /<AccreditationSetupPanel academicYear=\{academicYear\} \/>/);
  assert.match(accreditationSetup, /Institution profile/);
  assert.match(accreditationSetup, /Framework scopes/);
  assert.match(accreditationSetup, /Readiness tasks/);
  assert.match(accreditationSetup, /Frozen snapshots/);
  assert.match(accreditationSetup, /type="campuses"/);
  assert.match(accreditationSetup, /type="curricula"/);
  assert.match(accreditationSetup, /type="users"[\s\S]*?multiple[\s\S]*?label="Evidence owners"/);
  assert.match(accreditationSetup, /Independent reviewers/);
  assert.match(accreditationSetup, /request-activation/);
  assert.match(accreditationSetup, /Independent review note/);
  assert.match(accreditationSetup, /Record next verification/);
  assert.match(accreditationSetup, /verified_portal_evidence/);
  assert.match(accreditationSetup, /not provider acknowledgement/);
});
