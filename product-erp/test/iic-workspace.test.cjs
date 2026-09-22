const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/iic/components/IicPage.tsx',
  ),
  'utf8',
);

test('IIC exposes the governed idea-to-outcome journey', () => {
  for (const route of [
    'iic/projects',
    '/transition',
    '/mentor',
    '/milestones',
    '/funding',
    '/ip',
    '/outcome',
  ]) {
    assert.match(page, new RegExp(route));
  }
});

test('IIC forms use real people, academic years and owned evidence', () => {
  assert.match(page, /type="users"/);
  assert.match(page, /type="faculty"/);
  assert.match(page, /type="students"/);
  assert.match(page, /type="academicYears"/);
  assert.match(page, /InlineFileUpload/);
  assert.doesNotMatch(page, /Mongo|ObjectId|Open form to add new activity/);
});

test('IIC covers evaluation, funding, IP, prototypes, startups and MIC reporting', () => {
  for (const value of [
    'evaluation',
    'fundingAllocated',
    'patent',
    'Prototype evidence',
    'Startup name',
    'reported',
  ]) {
    assert.match(page, new RegExp(value, 'i'));
  }
});
