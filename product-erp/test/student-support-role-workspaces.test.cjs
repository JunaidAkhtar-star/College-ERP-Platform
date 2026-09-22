const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const placement = read('src/features/role-wise-features/placement/components/PlacementPage.tsx');
const scholarship = read('src/features/role-wise-features/scholarship/components/ScholarshipPage.tsx');
const mentor = read('src/features/role-wise-features/mentor/components/MentorPage.tsx');

test('placement coordinator and student modes follow active role', () => {
  assert.match(placement, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(placement, /READER_ROLES\.includes\(activeRole/);
  assert.match(placement, /MANAGER_ROLES\.includes\(activeRole/);
  assert.doesNotMatch(placement, /useHasRole|useHasAnyRole/);
  assert.match(placement, /Placement access unavailable/);
});

test('scholarship student, reviewer, approver, and disburser modes are distinct', () => {
  assert.match(scholarship, /const isStudent = activeRole === 'student'/);
  assert.match(scholarship, /const canReview = activeRole === 'scholarship_cell'/);
  assert.match(scholarship, /const canDisburse = activeRole === 'accounts_department'/);
  assert.doesNotMatch(scholarship, /useHasRole|useHasAnyRole/);
  assert.match(scholarship, /type="academicYears"/);
  assert.doesNotMatch(scholarship, /new Date\(\)[\s\S]*?getFullYear/);
});

test('mentor workspace uses active role and explicit denied/error states', () => {
  assert.match(mentor, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(mentor, /const isFaculty = activeRole === 'faculty'/);
  assert.match(mentor, /const isStudent = activeRole === 'student'/);
  assert.doesNotMatch(mentor, /useHasRole|useHasAnyRole/);
  assert.match(mentor, /Mentoring access unavailable/);
  assert.match(mentor, /Mentoring records could not be loaded/);
});
