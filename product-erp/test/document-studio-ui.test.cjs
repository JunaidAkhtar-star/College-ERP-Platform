const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/features/role-wise-features/document-designer/components/DocumentDesignerPage.tsx',
  ),
  'utf8',
);

test('document studio exposes governed publishing and issuance actions', () => {
  assert.match(source, /Institution Design Studio/);
  assert.match(source, /lifecycle\/\$\{action\}/);
  assert.match(source, /pending_approval/);
  assert.match(source, /New revision/);
  assert.match(source, /template\.status === 'published'/);
});

test('document studio protects editing work and provides productivity controls', () => {
  assert.match(source, /document-designer-draft/);
  assert.match(source, /Recovered your local design draft/);
  assert.match(source, /const undo =/);
  assert.match(source, /const redo =/);
  assert.match(source, /Canvas zoom/);
  assert.match(source, /rotation/);
  assert.match(source, /opacity/);
});
