const assert = require("node:assert/strict");
const test = require("node:test");
const { validateQuestionContent } = require("../build/services/question-bank.service.js");

test("normalizes governed question-bank content and derives a stable fingerprint", () => {
  const first = validateQuestionContent({
    questionText: "  What   is polymorphism? ",
    questionType: "short_answer",
    difficultyLevel: "medium",
    marks: 5,
    unitNo: 2,
    coCode: "co3",
    correctAnswer: "One interface, multiple implementations",
    tags: [" OOP ", "oop", "Java"],
  });
  const second = validateQuestionContent({
    questionText: "what is POLYMORPHISM?",
    questionType: "short_answer",
    difficultyLevel: "medium",
    marks: 5,
    unitNo: 2,
    correctAnswer: "answer",
  });
  assert.equal(first.coCode, "CO3");
  assert.deepEqual(first.tags, ["oop", "java"]);
  assert.equal(first.fingerprint, second.fingerprint);
});

test("rejects ambiguous MCQs and incomplete model answers", () => {
  assert.throws(
    () =>
      validateQuestionContent({
        questionText: "Choose an answer",
        questionType: "mcq",
        difficultyLevel: "easy",
        marks: 1,
        unitNo: 1,
        options: [
          { optionText: "A", isCorrect: true },
          { optionText: "B", isCorrect: true },
        ],
      }),
    /exactly one correct option/,
  );
  assert.throws(
    () =>
      validateQuestionContent({
        questionText: "Explain a transaction",
        questionType: "long_answer",
        difficultyLevel: "hard",
        marks: 10,
        unitNo: 3,
      }),
    /model or correct answer/,
  );
});
