const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('student support pages expose one request-to-resolution journey', () => {
  const pages = [
    'features/role-wise-features/grievance/components/GrievancePage.tsx',
    'features/role-wise-features/counseling/components/CounselingPage.tsx',
    'features/role-wise-features/discipline/components/DisciplinePage.tsx',
    'features/role-wise-features/gate-pass/components/GatePassPage.tsx',
  ];
  for (const page of pages) assert.match(read(page), /StudentSupportWorkflowBar/);
});

test('counselling uses live students and academic years without database IDs', () => {
  const modal = read(
    'features/role-wise-features/counseling/components/ScheduleSessionModal.tsx',
  );
  const page = read('features/role-wise-features/counseling/components/CounselingPage.tsx');
  assert.match(modal, /type="students"/);
  assert.match(modal, /type="academicYears"/);
  assert.match(page, /type="students"/);
  assert.doesNotMatch(`${modal}\n${page}`, /MongoDB ID|Mongo ID|Student ID is required/);
});

test('gate registration selects a real host in one searchable control', () => {
  const page = read('features/role-wise-features/gate-pass/components/GatePassPage.tsx');
  assert.match(page, /type="users"/);
  assert.match(page, /Person being visited/);
  assert.doesNotMatch(page, /24-char ObjectId|Type search first|Select Host Person/);
});

test('grievance and discipline expose governed resolution and appeal actions', () => {
  const grievance = read('features/role-wise-features/grievance/components/GrievancePage.tsx');
  const discipline = read('features/role-wise-features/discipline/components/DisciplinePage.tsx');
  assert.match(grievance, /acknowledge/);
  assert.match(grievance, /escalate/);
  assert.match(grievance, /satisfaction/);
  assert.match(discipline, /transition/);
  assert.match(discipline, /Appeal decision/);
  assert.match(discipline, /InlineFileUpload/);
  assert.doesNotMatch(discipline, /email or ID/);
});
