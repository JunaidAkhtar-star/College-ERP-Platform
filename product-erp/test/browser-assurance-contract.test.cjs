const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('browser assurance covers every visible page per active-role session plus denied routes', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../e2e/enterprise-critical.spec.ts'),
    'utf8',
  );
  for (const route of [
    'dashboard',
    'admission',
    'accounts',
    'procurement',
    'report-center',
    'data-portability',
  ])
    assert.match(source, new RegExp(`'${route}'`));
  assert.match(source, /AxeBuilder/);
  assert.match(source, /UAT_ROLE_MATRIX/);
  assert.match(source, /UAT_ROLE_MATRIX_FILE/);
  assert.match(source, /every visible navigation page/);
  assert.match(source, /deniedRoutes/);
  assert.match(source, /a\[href\^=/);
  assert.match(source, /scrollWidth/);
  assert.match(source, /keyboard\.press\('Tab'\)/);
  assert.match(source, /assertVisibleTabStates/);
  assert.match(source, /\[role="tab"\]:visible/);
  assert.match(source, /input:visible, select:visible, textarea:visible/);
  assert.match(source, /Unlabelled form controls/);
});

test('browser assurance runs mobile, tablet, desktop and wide viewports', () => {
  const source = fs.readFileSync(path.join(__dirname, '../playwright.config.ts'), 'utf8');
  assert.match(source, /mobile-chromium/);
  assert.match(source, /tablet-chromium/);
  assert.match(source, /desktop-chromium/);
  assert.match(source, /wide-chromium/);
  assert.match(source, /width: 1920, height: 1080/);
});
