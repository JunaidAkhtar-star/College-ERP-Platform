const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('academic workflows never fall back to raw student database identifiers', () => {
  const assignment = read(
    'src/features/role-wise-features/assignment/components/AssignmentPage.tsx',
  );
  const examination = read(
    'src/features/role-wise-features/examination/components/ExaminationPage.tsx',
  );
  const gradebook = read(
    'src/features/role-wise-features/assessment-policy/components/GradebookPanel.tsx',
  );

  assert.doesNotMatch(assignment, /studentName \?\? (?:submission|s)\.studentId/);
  assert.doesNotMatch(examination, /studentName \?\? row\.studentId/);
  assert.doesNotMatch(gradebook, /\?\? row\.studentId/);
  assert.match(gradebook, /Student record unavailable/);
});

test('quiz, meeting and library views render populated relationship labels', () => {
  const quiz = read('src/features/role-wise-features/quiz/components/QuizPage.tsx');
  const meeting = read('src/features/role-wise-features/meeting/components/MeetingPage.tsx');
  const dashboards = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/LibraryStaffDashboard.tsx',
  );

  assert.doesNotMatch(quiz, /String\(ev\.studentId[^\n]*\.slice/);
  assert.doesNotMatch(meeting, /a\.userId\.slice/);
  assert.doesNotMatch(dashboards, /String\(issue\.bookId/);
  assert.match(quiz, /studentLabel/);
  assert.match(meeting, /User record unavailable/);
  assert.match(dashboards, /Unknown book/);
});

test('async selectors stop indefinite loading when a saved relationship is unavailable', () => {
  const asyncSelect = read('src/shared/core/AsyncSelect.tsx');
  assert.match(asyncSelect, /Record unavailable/);
  assert.match(asyncSelect, /isHydrating/);
});

test('chat and parent messaging use searchable people instead of ObjectId inputs', () => {
  const chatHeader = read('src/features/role-wise-features/chat/components/ChatHeader.tsx');
  const parent = read('src/features/role-wise-features/parent/components/ParentPage.tsx');

  assert.doesNotMatch(chatHeader, /placeholder="User ID"/);
  assert.match(chatHeader, /type="users"/);
  assert.doesNotMatch(parent, /Recipient User ID|ObjectId/);
  assert.match(parent, /type="faculty"/);
});

test('web calling and push registration use real channel and per-device contracts', () => {
  const chat = read('src/features/role-wise-features/chat/components/ChatPage.tsx');
  const push = read('src/shared/hooks/useFcm.ts');

  assert.doesNotMatch(chat, /mockSdp/);
  assert.match(push, /getPushDeviceId/);
  assert.match(push, /deviceId: getPushDeviceId\(\)/);
});
