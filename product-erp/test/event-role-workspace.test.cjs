const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/features/role-wise-features/event/components/EventPage.tsx'),
  'utf8',
);

test('event capabilities derive only from the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.match(source, /ORGANIZER_ROLES\.includes\(activeRole\)/);
  assert.doesNotMatch(source, /useHasAnyRole/);
});

test('event edit, publish and registration actions are record-aware', () => {
  assert.match(source, /const canEditEvent = \(event: IEvent\)/);
  assert.match(source, /const canPublishEvent = \(event: IEvent\)/);
  assert.match(source, /!event\.myRegistration/);
  assert.match(source, /hidden: \(row: IEvent\) => !canEditEvent\(row\)/);
});

test('participant attendance is managed from scoped event detail', () => {
  assert.match(source, /Mark participant attendance/);
  assert.match(source, /canManage\(ev\)/);
  assert.match(source, /onMarkAttendance\(ev\)/);
});

test('event list and detail failures are visible', () => {
  assert.match(source, /Unable to load events/);
  assert.match(source, /\{error && <p/);
  assert.match(source, /Retry/);
});
