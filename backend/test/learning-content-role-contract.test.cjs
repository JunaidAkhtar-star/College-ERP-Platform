const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("study materials use active allotment and approved registration", () => {
  const controller = read("controllers/study-material.controller.ts");
  assert.match(controller, /findCurrentActiveForStudent/);
  assert.match(controller, /sectionId: allotment\.sectionId/);
  assert.match(controller, /RegistrationStatus\.APPROVED, RegistrationStatus\.FROZEN/);
  assert.doesNotMatch(controller, /StudentProfileModel|SectionModel\.findOne/);
});

test("quizzes use active allotment section identity for list and direct access", () => {
  const controller = read("controllers/quiz.controller.ts");
  assert.match(controller, /findCurrentActiveForStudent/);
  assert.match(controller, /sectionId: allotment\.sectionId/);
  assert.match(controller, /String\(quiz\.sectionId\) !== String\(scope\.sectionId\)/);
  assert.doesNotMatch(controller, /StudentProfileModel\.findOne/);
});

test("quiz creation is limited to an actively assigned faculty author", () => {
  const routes = read("routes/quiz.routes.ts");
  const service = read("services/quiz.service.ts");
  assert.match(routes, /const AUTHOR_ROLES = \[FACULTY\]/);
  assert.match(service, /slots: \{ \$elemMatch: \{ subjectId, facultyId \} \}/);
});

test("question bank faculty visibility and authorship are backend scoped", () => {
  const controller = read("controllers/question-bank.controller.ts");
  const service = read("services/question-bank.service.ts");
  assert.match(controller, /QuestionStatus\.DRAFT, createdBy: req\.user!\._id/);
  assert.match(controller, /Faculty can access only approved questions or their own drafts/);
  assert.match(service, /slots: \{ \$elemMatch: \{ subjectId, facultyId: authorId \} \}/);
});
