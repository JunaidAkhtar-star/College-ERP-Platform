const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'server');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('sensitive workflow controllers scope authorization to the active role', () => {
  const discipline = read('controllers/discipline.controller.ts');
  const gatePass = read('controllers/gatepass.controller.ts');
  const notifications = read('controllers/notification.controller.ts');
  const assistant = read('controllers/erp-assistant.controller.ts');
  const auditLog = read('controllers/audit-log.controller.ts');

  assert.match(discipline, /roles: req\.activeRole \? \[String\(req\.activeRole\)\] : \[\]/);
  assert.doesNotMatch(discipline, /req\.user\?\.roles/);
  assert.match(gatePass, /req\.permissions\?\.some/);
  assert.match(gatePass, /permission\.module === Module\.GATE_PASS/);
  assert.doesNotMatch(gatePass, /const userRoles = req\.user/);
  assert.doesNotMatch(gatePass, /req\.activeRole as SystemRole/);
  assert.match(notifications, /req\.activeRole \? \[String\(req\.activeRole\)\] : \[\]/);
  assert.doesNotMatch(notifications, /req\.user\?\.roles/);
  assert.match(assistant, /userRoles: req\.activeRole \? \[String\(req\.activeRole\)\] : \[\]/);
  assert.match(auditLog, /String\(req\.activeRole\)/);
  assert.doesNotMatch(auditLog, /req\.user\?\.roles/);
});

test('alumni accounting does not grant accounts roles access to the alumni directory', () => {
  const routes = read('routes/alumni.routes.ts');
  assert.match(routes, /const alumniView = requirePermission\(Module\.ALUMNI, PermissionAction\.VIEW\)/);
  assert.match(routes, /const alumniApprove = requirePermission\(Module\.ALUMNI, PermissionAction\.APPROVE\)/);
});
