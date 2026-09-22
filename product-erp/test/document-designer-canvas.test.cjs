const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Document Designer provides direct canvas manipulation and productivity controls', () => {
  const designer = read(
    'src/features/role-wise-features/document-designer/components/DocumentDesignerPage.tsx',
  );

  assert.match(designer, /beginPointerEdit/);
  assert.match(designer, /Resize element/);
  assert.match(designer, /moveLayer/);
  assert.match(designer, /duplicateSelected/);
  assert.match(designer, /Local autosave active/);
  assert.match(designer, /Canvas zoom/);
  assert.match(designer, /Undo/);
  assert.match(designer, /Redo/);
});

test('issuance uses searchable people and a governed lifecycle without record IDs', () => {
  const designer = read(
    'src/features/role-wise-features/document-designer/components/DocumentDesignerPage.tsx',
  );

  assert.match(designer, /issueSelectorType/);
  assert.match(designer, /type=\{issueSelectorType\}/);
  assert.match(designer, /Select \$\{issueTemplate\.audience\}/);
  assert.match(designer, /Revoke/);
  assert.match(designer, /Reissue/);
  assert.match(designer, /Retire/);
  assert.doesNotMatch(designer, /record ID/);
  assert.doesNotMatch(designer, /Subject record ID is required/);
});

test('dynamic fields are presented with friendly labels instead of template syntax', () => {
  const designer = read(
    'src/features/role-wise-features/document-designer/components/DocumentDesignerPage.tsx',
  );

  assert.match(designer, /friendlyField\(token\)/);
  assert.match(designer, /Insert data field/);
  assert.match(designer, /No institution templates yet/);
  assert.match(designer, /Design Studio could not load institution templates/);
});

test('QR verification has a privacy-safe public destination', () => {
  const verification = read(
    'src/features/public/document-verification/components/DocumentVerificationPage.tsx',
  );
  const route = read('src/app/verify/document/[code]/page.tsx');

  assert.match(verification, /This document is valid/);
  assert.match(verification, /This document is not valid/);
  assert.match(verification, /Personal information is intentionally not\s+displayed/);
  assert.match(verification, /document-template\/verify/);
  assert.match(route, /DocumentVerificationPage/);
});
