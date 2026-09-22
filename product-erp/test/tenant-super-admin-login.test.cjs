const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('tenant sign-in does not redirect tenant super administrators to the platform portal', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'auth', 'components', 'signin', 'SignIn.tsx'),
    'utf8',
  );

  assert.doesNotMatch(source, /Use the separate Devvelocity administrator portal/);
  assert.doesNotMatch(source, /activeRole === ['"]super_admin['"]/);
  assert.match(source, /`\/\$\{activeRole\}\/dashboard`/);
});
