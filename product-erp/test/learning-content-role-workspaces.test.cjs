const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const materials = read('src/features/role-wise-features/study-material/components/StudyMaterialPage.tsx');
const questions = read('src/features/role-wise-features/question-bank/components/QuestionBankPage.tsx');
const quizzes = read('src/features/role-wise-features/quiz/components/QuizPage.tsx');

test('study-material actions follow active role and permission state', () => {
  assert.match(materials, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(materials, /AUTHOR_ROLES\.includes\(activeRole/);
  assert.doesNotMatch(materials, /useHasRole|useHasAnyRole/);
  assert.match(materials, /q\.set\('subjectId', filterSubject\)/);
  assert.match(materials, /results\?\.data\?\.url/);
  assert.match(materials, /Study materials could not be loaded/);
});

test('question authoring and governance are active-role capabilities', () => {
  assert.match(questions, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(questions, /\['hod', 'faculty', 'examination_cell'\]\.includes\(activeRole/);
  assert.match(questions, /\['super_admin', 'dean_academic', 'hod', 'examination_cell'\]\.includes/);
  assert.match(questions, /Question bank access unavailable/);
  assert.match(questions, /Question bank could not be loaded/);
});

test('quiz workspace selection uses active role and explicit permissions', () => {
  assert.match(quizzes, /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/);
  assert.match(quizzes, /const canAuthor = activeRole === 'faculty' && hasEditPermission/);
  assert.doesNotMatch(quizzes, /useHasRole|useHasAnyRole/);
  assert.match(quizzes, /Quiz access unavailable/);
  assert.match(quizzes, /Quizzes could not be loaded/);
});
