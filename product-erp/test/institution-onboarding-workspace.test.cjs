const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/features/onboarding/components/OnboardingPage.tsx'),
  'utf8',
);

test('institution onboarding is resumable, guided and administrator restricted', () => {
  assert.match(source, /settings\.onboardingStep/);
  assert.match(source, /Saving progress/);
  assert.match(source, /UseProtectedRoutes\(OnboardingPage, \['super_admin', 'admin'\]\)/);
  assert.match(source, /Institution setup could not be loaded/);
  assert.match(source, /Your saved progress is safe/);
});

test('institution onboarding provides a truthful activation readiness review', () => {
  assert.match(source, /Institution identity/);
  assert.match(source, /Official contacts/);
  assert.match(source, /Tenant branding/);
  assert.match(source, /Institution domain/);
  assert.match(source, /Academic structure, people, integrations and/);
  assert.match(source, /respective modules/);
});

test('optional domain onboarding normalizes input and can safely be deferred', () => {
  assert.match(source, /replace\(\/\^https\?:\\\/\\\//);
  assert.match(source, /without a page path/);
  assert.match(source, /configure the domain later under Settings/);
  assert.match(source, /browser could not copy the value/);
  assert.doesNotMatch(source, /Keep the managed Devvelocity address/);
});
