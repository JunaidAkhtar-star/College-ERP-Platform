const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const progress = read('src/features/role-wise-features/course-progress/components/CourseProgressPage.tsx');
const lesson = read('src/features/role-wise-features/lesson-plan/components/LessonPlanPage.tsx');
const assignment = read('src/features/role-wise-features/assignment/components/AssignmentPage.tsx');

test('course delivery recording follows the active faculty role', () => {
  assert.match(progress, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(progress, /hasEditPermission && activeRole === 'faculty'/);
  assert.doesNotMatch(progress, /useHasRole|useHasAnyRole/);
  assert.match(progress, /Course progress access unavailable/);
  assert.match(progress, /Course progress could not be loaded/);
});

test('lesson plan authoring and review are separate active-role capabilities', () => {
  assert.match(lesson, /const canEdit = useHasPermission\('lesson_plan', 'edit'\) && activeRole === 'faculty'/);
  assert.match(lesson, /\['super_admin', 'dean_academic', 'hod'\]\.includes\(activeRole/);
  assert.doesNotMatch(lesson, /useHasRole|useHasAnyRole/);
  assert.match(lesson, /Lesson plan access unavailable/);
  assert.match(lesson, /Lesson plans could not be loaded/);
});

test('assignment authoring cannot leak from an assigned faculty identity into another active role', () => {
  assert.match(assignment, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(assignment, /const canManage = activeRole === 'faculty' && canEdit/);
  assert.doesNotMatch(assignment, /useHasRole|useHasAnyRole/);
  assert.match(assignment, /Assignment access unavailable/);
  assert.match(assignment, /Assignments could not be loaded/);
});
