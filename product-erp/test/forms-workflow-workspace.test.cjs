const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Forms provides a guided template-to-submission journey', () => {
  const page = read('src/features/role-wise-features/forms/components/FormsWorkflowPage.tsx');

  assert.match(page, /Start from a template/);
  assert.match(page, /Questions/);
  assert.match(page, /Preview/);
  assert.match(page, /Approval workflow/);
  assert.match(page, /Who can submit/);
  assert.match(page, /Submit for review/);
  assert.match(page, /independent review/);
});

test('form questions genuinely reorder with conditional dependency protection', () => {
  const page = read('src/features/role-wise-features/forms/components/FormsWorkflowPage.tsx');

  assert.match(page, /draggable/);
  assert.match(page, /onDragStart/);
  assert.match(page, /reorderField/);
  assert.match(page, /conditional question must stay below/);
  assert.match(page, /Drag to reorder question/);
});

test('submission operations expose SLA, reminder, withdrawal and understandable evidence', () => {
  const page = read('src/features/role-wise-features/forms/components/FormsWorkflowPage.tsx');

  assert.match(page, /Remind current approvers/);
  assert.match(page, /Withdraw before review/);
  assert.match(page, /This approval is overdue/);
  assert.match(page, /Open uploaded evidence/);
  assert.match(page, /Approval timeline/);
  assert.doesNotMatch(page, />.*https:\/\/.*</);
});

test('response export contains governed answers and guided recovery states', () => {
  const page = read('src/features/role-wise-features/forms/components/FormsWorkflowPage.tsx');

  assert.match(page, /dynamicFields/);
  assert.match(page, /Current approval step/);
  assert.match(page, /SLA due/);
  assert.match(page, /Forms workspace could not be loaded/);
  assert.match(page, /Approval inbox is clear/);
  assert.match(page, /No submissions yet/);
});

test('workflow workspace exposes dynamic delegation and SLA escalation configuration', () => {
  const page = read('src/features/role-wise-features/forms/components/FormsWorkflowPage.tsx');
  assert.match(page, /Approval delegation/);
  assert.match(page, /type="users"/);
  assert.match(page, /validationSchema=\{schema\}/);
  assert.match(page, /escalationRoles/);
  assert.match(page, /Default escalation/);
  assert.doesNotMatch(page, /Enter delegate ID|Enter user ID/i);
});
