const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/academic-calendar/components/AcademicCalendarPage.tsx',
  ),
  'utf8',
);

test('calendar capabilities derive from the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.match(source, /\['super_admin', 'admin', 'dean_academic'\]\.includes\(activeRole\)/);
  assert.match(source, /\['super_admin', 'admin', 'principal'\]\.includes\(activeRole\)/);
  assert.doesNotMatch(source, /useHasAnyRole/);
});

test('viewers load only published visible calendars', () => {
  assert.match(source, /canViewDrafts \? 'academic-calendar' : 'academic-calendar\/visible'/);
});

test('published calendars expose no editing operations', () => {
  assert.match(source, /const canEditSelected = canManage && !!selected && !selected\.isPublished/);
  assert.match(source, /onAddClick=\{\s*canEditSelected/);
  assert.match(source, /\{canEditSelected && ev\?\._id && \(/);
});

test('calendar failures are visible and retryable', () => {
  assert.match(source, /Unable to load the academic calendar/);
  assert.match(source, /onClick=\{\(\) => mutate\(\)\}/);
});
