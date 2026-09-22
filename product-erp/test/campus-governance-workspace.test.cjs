const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('campus workspace makes hierarchy, access, calendars, services and outcomes understandable', () => {
  const page = read('src/features/role-wise-features/campus-governance/components/CampusGovernancePage.tsx');
  const insights = read('src/features/role-wise-features/campus-governance/components/CampusGovernanceInsights.tsx');
  for (const label of ['Multi-campus Governance', 'Hierarchy', 'Access scope', 'Calendars', 'Shared services']) {
    assert.match(page, new RegExp(label));
  }
  for (const label of ['outstanding', 'Calendar readiness', 'Leadership coverage', 'Fee position', 'Governance readiness']) assert.match(insights, new RegExp(label));
  assert.match(insights, /<svg/);
  assert.match(page, /CustomTable/);
  assert.match(page, /responsive:\s*true/);
});

test('campus forms are validated and use searchable domain selectors', () => {
  const page = read('src/features/role-wise-features/campus-governance/components/CampusGovernancePage.tsx');
  assert.match(page, /Formik/);
  assert.match(page, /Yup\.object/);
  assert.match(page, /type="users"/);
  assert.match(page, /type="departments"/);
  assert.doesNotMatch(page, /Enter (user|department|campus) ID|MongoDB|ObjectId/i);
});

test('campus governance is routable and present in seeded navigation', () => {
  assert.match(read('src/app/[tenant]/[role]/campus-governance/page.tsx'), /CampusGovernancePage/);
});

test('campus workspace uses dynamic capabilities aligned to backend operations', () => {
  const page = read('src/features/role-wise-features/campus-governance/components/CampusGovernancePage.tsx');
  assert.match(page, /useHasPermission\('user_management', 'create'\)/);
  assert.match(page, /useHasPermission\('user_management', 'edit'\)/);
  assert.match(page, /useHasPermission\('user_management', 'approve'\)/);
  assert.match(page, /useHasPermission\('user_management', 'delete'\)/);
  assert.match(page, /const canManageInstitution/);
  assert.match(page, /const canEditCalendars/);
  assert.match(page, /const canPublishCalendars/);
  assert.match(page, /const canManageServices/);
  assert.match(page, /actions=\{canDelete \? revoke : \[\]\}/);
});

test('calendar publication is independent and load failures are visible', () => {
  const page = read('src/features/role-wise-features/campus-governance/components/CampusGovernancePage.tsx');
  assert.match(page, /creator === userId/);
  assert.match(page, /campusesError/);
  assert.match(page, /Unable to load campus governance data/);
});

test('protected route uses the user-management view permission', () => {
  const page = read('src/features/role-wise-features/campus-governance/components/CampusGovernancePage.tsx');
  assert.match(page, /UseProtectedRoutes\(CampusGovernancePage, undefined, \[\['user_management', 'view'\]\]\)/);
});
