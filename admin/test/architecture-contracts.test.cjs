const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('coupon assignment uses live workspaces instead of a typed tenant identifier', () => {
  const source = read('src/features/super-admin/components/BillingTab.tsx');

  assert.match(source, /const tenants = useSwr<[^\n]+>\('super-admin\/tenants'\)/);
  assert.match(source, /<select\s+name="assignedTenantId"/s);
  assert.doesNotMatch(source, /placeholder="Assigned workspace ID"/);
  assert.match(source, /<option key=\{tenant\._id\} value=\{tenant\.tenantId\}>/);
});

test('feature code uses shared storage utilities', () => {
  const featureFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(ts|tsx)$/.test(entry.name)) featureFiles.push(target);
    }
  };
  visit(path.join(root, 'src/features'));

  const violations = featureFiles
    .filter((file) =>
      /\b(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    )
    .map((file) => path.relative(root, file));
  assert.deepEqual(violations, []);
});
