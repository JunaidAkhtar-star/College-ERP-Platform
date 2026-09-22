const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/meeting/components/MeetingPage.tsx'),
  'utf8',
);

test('meeting page selects role-specific endpoints from the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.match(source, /activeRole === 'student'/);
  assert.match(source, /activeRole === 'faculty'/);
  assert.doesNotMatch(source, /useHasAnyRole|useHasRole|useHasPermission/);
});

test('meeting mutation buttons enforce owner or global-manager capability', () => {
  assert.match(source, /const canManage = \(meeting: IMeeting\)/);
  assert.match(source, /hidden: \(row: IMeeting\) => !canManage\(row\)/);
  assert.match(source, /canManage\(detailMeeting\) && detailMeeting\.status/);
  assert.match(source, /canManage\(m\) &&/);
});

test('attendance is self-service and minutes approval is independent', () => {
  assert.match(source, /idOf\(a\.userId\) === currentUser\?\._id/);
  assert.match(source, /Mark mine/);
  assert.match(source, /idOf\(detailMeeting\.minutesSubmittedBy\) !== currentUser\?\._id/);
  assert.match(source, /Conclude & Submit Minutes/);
});

test('meeting load failure is visible and retryable', () => {
  assert.match(source, /meetingError/);
  assert.match(source, /Unable to load meetings/);
  assert.match(source, /Retry/);
});
