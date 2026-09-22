const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const controller = read('server/controllers/event.controller.ts');
const service = read('server/services/event.service.ts');
const repository = read('server/repositories/event.repository.ts');
const routes = read('server/routes/event.routes.ts');

test('event list and direct reads use active-role audience and department scope', () => {
  assert.match(controller, /const role = req\.activeRole as SystemRole/);
  assert.match(controller, /targetAudience: \{ \$in: audience/);
  assert.match(controller, /organizingDepartment: departmentId/);
  assert.match(controller, /Event not found or access denied/);
});

test('event participant data is excluded from lists and redacted for viewers', () => {
  assert.match(repository, /\.select\("-registrations"\)/);
  assert.match(controller, /myRegistration: ownByEvent/);
  assert.match(controller, /registrations: undefined/);
});

test('event mutations enforce ownership, independent publication and target eligibility', () => {
  assert.match(controller, /canManageEvent\(req, current/);
  assert.match(controller, /HODs can publish only their department events/);
  assert.match(service, /This event is not available for the active role/);
  assert.match(service, /This event is limited to another department/);
  assert.match(routes, /"\/:id\/register"[\s\S]*?authenticate,[\s\S]*?eventController\.register/);
});

test('event notifications use the organizing department and authoritative student profiles', () => {
  assert.match(service, /StudentProfileModel\.find\(/);
  assert.match(service, /departmentId \? \{ department: departmentId \}/);
  assert.match(service, /new Set\(userIds\.map\(String\)\)/);
});
