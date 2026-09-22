const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/features/role-wise-features/collaboration/components/CollaborationPage.tsx',
  ),
  'utf8',
);

test('collaboration publishing and moderation use only the active role', () => {
  assert.match(source, /state\.activeRole\?\.baseRole/);
  assert.doesNotMatch(source, /useHasAnyRole/);
  assert.match(source, /\]\.includes\(activeRole\)/);
});

test('album uploads and post controls follow ownership and moderator rules', () => {
  assert.match(source, /const canAddAlbumMedia = moderator/);
  assert.match(source, /const canManageDetail = moderator/);
  assert.match(source, /\{moderator && \(\s*<button/);
});

test('collaboration surfaces loading failures instead of empty success states', () => {
  assert.match(source, /metadataError/);
  assert.match(source, /postsError/);
  assert.match(source, /albumsError/);
  assert.match(source, /Unable to load the collaboration workspace/);
});
