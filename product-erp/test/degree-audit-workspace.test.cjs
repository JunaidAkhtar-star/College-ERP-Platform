const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('degree audit provides a connected student and advisor planning journey', () => {
  const source = read(
    'src/features/role-wise-features/degree-audit/components/DegreeAuditPage.tsx',
  );
  assert.match(source, /degree-audit\/mine/);
  assert.match(source, /type="studentProfiles"/);
  assert.match(source, /Degree Audit & Planner/);
  assert.match(source, /savePlan\(true\)/);
  assert.match(source, /reviewPlan\('approved'\)/);
  assert.match(source, /degree-audit\/transfer-credits/);
});

test('degree audit never asks users for technical student or subject identifiers', () => {
  const source = read(
    'src/features/role-wise-features/degree-audit/components/DegreeAuditPage.tsx',
  );
  assert.doesNotMatch(source, /placeholder="[^"]*(Mongo|ObjectId|Student ID|Subject ID)/i);
  assert.match(source, /audit\.requirements\.map/);
  assert.match(source, /Search by name, roll or registration number/);
});

test('degree planning is available in the shared academic journey', () => {
  const workflow = read('src/shared/components/AcademicWorkflowBar.tsx');
  const page = read('src/app/[tenant]/[role]/degree-audit/page.tsx');
  assert.match(workflow, /route: 'degree-audit'/);
  assert.match(page, /DegreeAuditPage/);
});

test('faculty degree planning exposes assigned advisees instead of institution-wide filters', () => {
  const source = read(
    'src/features/role-wise-features/degree-audit/components/DegreeAuditPage.tsx',
  );
  assert.match(source, /const facultyMode = role === 'faculty'/);
  assert.match(source, /facultyMode \? \{ assignedOnly: true \}/);
  assert.match(source, /label="Assigned advisee"/);
  assert.match(source, /No active students are assigned to you for degree advising/);
});
