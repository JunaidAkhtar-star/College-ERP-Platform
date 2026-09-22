const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const routes = read('server/routes/academic-calendar.routes.ts');
const controller = read('server/controllers/academic-calendar.controller.ts');
const service = read('server/services/academic-calendar.service.ts');

test('draft calendars are restricted while published calendars have a visible endpoint', () => {
  assert.match(routes, /calendarReaders = \[SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC\]/);
  assert.match(routes, /requireRoles\(calendarReaders\)/);
  assert.match(routes, /router\.get\("\/visible", authenticate/);
  assert.match(service, /\{ isPublished: true \}/);
});

test('student event visibility resolves department from the authoritative profile', () => {
  assert.match(controller, /req\.activeRole === SystemRole\.STUDENT/);
  assert.match(controller, /StudentProfileModel\.findOne\(\{ userId: req\.user!\._id \}\)/);
  assert.match(service, /event\.affectedRoles\.includes\(activeRole\)/);
});

test('calendar editing and publication are separate validated capabilities', () => {
  assert.match(routes, /requireRoles\(\[SUPER_ADMIN, ADMIN, DEAN_ACADEMIC\]\)/);
  assert.match(routes, /requireRoles\(\[SUPER_ADMIN, ADMIN, PRINCIPAL\]\)/);
  assert.match(routes, /body\("category"\)\.isIn/);
  assert.match(service, /Published academic calendars are immutable/);
  assert.match(service, /different approver/);
});
