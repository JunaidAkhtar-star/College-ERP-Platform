const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('recruitment workspace uses platform data and form primitives', () => {
  const page = read('src/features/role-wise-features/recruitment-crm/components/RecruitmentCrmPage.tsx');
  assert.match(page, /useSwr/);
  assert.match(page, /useMutation/);
  assert.match(page, /<Formik/);
  assert.match(page, /validationSchema=\{schema\}/);
  assert.match(page, /<CustomTable/);
  assert.match(page, /type="programs"/);
  assert.doesNotMatch(page, /MongoDB|ObjectId|Enter (?:programme|owner|student) ID/i);
});

test('recruitment CRM is reachable through admissions navigation', () => {
  const nav = read('src/shared/components/AdmissionWorkflowBar.tsx');
  const route = read('src/app/[tenant]/[role]/recruitment-crm/page.tsx');
  assert.match(nav, /route: 'recruitment-crm'/);
  assert.match(route, /RecruitmentCrmPage/);
});
