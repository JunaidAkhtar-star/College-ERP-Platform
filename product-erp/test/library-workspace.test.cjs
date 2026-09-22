const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/features/role-wise-features/library/components/LibraryPage.tsx'),
  'utf8',
);
const asyncSelect = fs.readFileSync(path.join(root, 'src/shared/core/AsyncSelect.tsx'), 'utf8');

test('library circulation never asks users for database identifiers', () => {
  assert.doesNotMatch(source, /MongoDB ObjectId|Book ID \*|Student ID \*/);
  assert.match(source, /type="books"/);
  assert.match(source, /type=\{formik\.values\.memberType === 'student' \? 'students' : 'faculty'\}/);
});

test('book and digital catalogue payloads match authoritative fields', () => {
  assert.match(source, /authorsRaw/);
  assert.match(source, /publicationYear/);
  assert.match(source, /digitalUrl/);
  assert.doesNotMatch(source, /type: 'ebook'/);
  assert.doesNotMatch(source, /accessLevel/);
});

test('library has one catalogue search and shared empty guidance', () => {
  assert.match(source, /showSearch=\{false\}/);
  assert.match(source, /<Empty/);
  assert.match(source, /No digital resources yet/);
});

test('circulation supports governed return, renewal and fine collection', () => {
  assert.match(source, /\/return/);
  assert.match(source, /\/renew/);
  assert.match(source, /\/fine-payments/);
  assert.match(source, /Available copies are calculated automatically/);
});

test('shared async selectors expose searchable physical books', () => {
  assert.match(asyncSelect, /\| 'books'/);
});
