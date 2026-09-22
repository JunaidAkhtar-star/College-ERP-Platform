const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('student success exposes explainable indicators and human intervention', () => {
  const source = read(
    'src/features/role-wise-features/student-success/components/StudentSuccessPage.tsx',
  );
  assert.match(source, /Scores guide human review; they never make automatic decisions/);
  assert.match(source, /student-success\/caseload/);
  assert.match(source, /student-success\/cases/);
  assert.match(source, /Record intervention/);
  assert.match(source, /Resolve student success case/);
});

test('advisor assignment is dynamic and department scoped', () => {
  const source = read(
    'src/features/role-wise-features/student-success/components/StudentSuccessPage.tsx',
  );
  assert.match(source, /type="faculty"/);
  assert.match(source, /params=\{\{ departmentId: selected\.departmentId \}\}/);
  assert.doesNotMatch(source, /Advisor ID|Student ID|ObjectId/);
});

test('student success is part of the connected student workspace', () => {
  assert.match(read('src/shared/components/StudentWorkflowBar.tsx'), /route: 'student-success'/);
  assert.match(read('src/app/[tenant]/[role]/student-success/page.tsx'), /StudentSuccessPage/);
});
