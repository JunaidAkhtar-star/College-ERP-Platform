const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Students pages expose the shared role-aware workspace', () => {
  for (const file of [
    'src/features/role-wise-features/student-profile/components/StudentProfilePage.tsx',
    'src/features/role-wise-features/mentor/components/MentorPage.tsx',
  ]) {
    assert.match(read(file), /StudentWorkflowBar/);
  }
});

test('mentor workflows use guided selectors and never request database IDs', () => {
  const mentor = read('src/features/role-wise-features/mentor/components/MentorPage.tsx');
  assert.match(mentor, /type="faculty"/);
  assert.match(mentor, /type="departments"/);
  assert.match(mentor, /type="students"/);
  assert.match(mentor, /body: \{ studentId \}/);
  assert.doesNotMatch(mentor, /MongoDB ObjectId|Faculty ID|Department ID|Mentee \(Student\) ID/);
});

test('Students pages use one search control per data view', () => {
  const students = read(
    'src/features/role-wise-features/student-profile/components/StudentProfilePage.tsx',
  );
  const mentor = read('src/features/role-wise-features/mentor/components/MentorPage.tsx');
  assert.match(students, /showSearch=\{false\}/);
  assert.doesNotMatch(mentor, /options=\{\{ search: true/);
});
