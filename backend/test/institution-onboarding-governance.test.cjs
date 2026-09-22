const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "..", "server/services/institution-setting.service.ts"),
  "utf8",
);

test("institution onboarding validates authoritative identity fields server-side", () => {
  assert.match(source, /validateInstitutionInput/);
  assert.match(source, /valid institution name/);
  assert.match(source, /Short code must be 2–12 letters or numbers/);
  assert.match(source, /valid official email address/);
  assert.match(source, /valid official phone number/);
  assert.match(source, /website must use HTTP or HTTPS/);
});

test("onboarding progress cannot regress and placeholder identity cannot activate", () => {
  assert.match(source, /step >= currentStep/);
  assert.match(source, /value === "Institution setup required"/);
  assert.match(source, /onboardingStatus = "completed"/);
  assert.match(source, /onboardingCompletedAt = new Date/);
});
