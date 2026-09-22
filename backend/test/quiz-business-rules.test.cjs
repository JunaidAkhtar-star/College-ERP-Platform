const assert = require("node:assert/strict");
const test = require("node:test");
const { Types } = require("mongoose");
const { gradeQuizAnswers } = require("../build/services/quiz.service.js");

test("grades quiz answers from the authoritative answer key and shuffled option mapping", () => {
  const mcqId = new Types.ObjectId();
  const booleanId = new Types.ObjectId();
  const result = gradeQuizAnswers(
    [
      {
        _id: mcqId,
        questionText: "Pick B",
        questionType: "mcq",
        options: [
          { optionText: "A", isCorrect: false },
          { optionText: "B", isCorrect: true },
        ],
        marks: 4,
      },
      {
        _id: booleanId,
        questionText: "True?",
        questionType: "true_false",
        correctAnswer: "True",
        marks: 2,
      },
    ],
    [
      { questionId: mcqId, optionOrder: [1, 0] },
      { questionId: booleanId, optionOrder: [] },
    ],
    [
      { questionId: mcqId.toString(), selectedOption: 0 },
      { questionId: booleanId.toString(), textAnswer: " true " },
    ],
  );
  assert.equal(result.score, 6);
  assert.equal(result.maxScore, 6);
  assert.equal(result.percentage, 100);
  assert.equal(result.answers[0].selectedOption, 1);
});

test("rejects duplicate, foreign, and invalid presented quiz answers", () => {
  const questionId = new Types.ObjectId();
  const questions = [
    {
      _id: questionId,
      questionText: "Pick one",
      questionType: "mcq",
      options: [
        { optionText: "A", isCorrect: true },
        { optionText: "B", isCorrect: false },
      ],
      marks: 1,
    },
  ];
  const presentation = [{ questionId, optionOrder: [0, 1] }];
  assert.throws(
    () =>
      gradeQuizAnswers(questions, presentation, [
        { questionId: questionId.toString(), selectedOption: 0 },
        { questionId: questionId.toString(), selectedOption: 0 },
      ]),
    /only once/,
  );
  assert.throws(
    () =>
      gradeQuizAnswers(questions, presentation, [
        { questionId: new Types.ObjectId().toString(), selectedOption: 0 },
      ]),
    /outside this quiz/,
  );
  assert.throws(
    () =>
      gradeQuizAnswers(questions, presentation, [
        { questionId: questionId.toString(), selectedOption: 8 },
      ]),
    /invalid for this quiz presentation/,
  );
});
