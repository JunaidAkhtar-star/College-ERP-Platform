import createError from "http-errors";
import {
  curriculumRepository,
  quizRepository,
  sectionRepository,
  subjectRepository,
} from "../repositories";
import {
  QuizStatus,
  type IQuiz,
  type IQuizQuestion,
  type ProctoringEventType,
} from "../models/quiz.model";
import { QuizModel, QuizAttemptModel, ProctoringLogModel, QuestionModel } from "../models";
import { TimetableModel } from "../models/timetable.model";
import { Types } from "mongoose";
import { randomInt } from "node:crypto";
import { QuestionStatus } from "../models/question-bank.model";

type SubmittedAnswer = {
  questionId: string;
  selectedOption?: number;
  textAnswer?: string;
};

function asSubmittedAnswers(
  answers: Array<{
    questionId: Types.ObjectId | string;
    selectedOption?: number;
    textAnswer?: string;
  }>,
): SubmittedAnswer[] {
  return answers.map((answer) => ({
    questionId: String(answer.questionId),
    selectedOption: answer.selectedOption,
    textAnswer: answer.textAnswer,
  }));
}

function shuffled(values: number[]): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");
}

export function gradeQuizAnswers(
  questions: Array<IQuizQuestion & { _id?: Types.ObjectId }>,
  presentation: Array<{ questionId: Types.ObjectId; optionOrder: number[] }>,
  submitted: SubmittedAnswer[],
) {
  const submittedByQuestion = new Map<string, SubmittedAnswer>();
  for (const answer of submitted) {
    if (!Types.ObjectId.isValid(answer.questionId) || submittedByQuestion.has(answer.questionId)) {
      throw createError(400, "Each quiz question may be answered only once");
    }
    submittedByQuestion.set(answer.questionId, answer);
  }
  const presentationByQuestion = new Map(
    presentation.map((item) => [String(item.questionId), item.optionOrder]),
  );
  const answers = questions.map((question) => {
    const questionId = String(question._id);
    const answer = submittedByQuestion.get(questionId);
    let isCorrect = false;
    let selectedOption: number | undefined;
    const textAnswer = answer?.textAnswer?.trim();
    if (question.questionType === "mcq" && answer?.selectedOption !== undefined) {
      const presentedIndex = Number(answer.selectedOption);
      const optionOrder = presentationByQuestion.get(questionId) ?? [];
      if (
        !Number.isInteger(presentedIndex) ||
        presentedIndex < 0 ||
        presentedIndex >= optionOrder.length
      )
        throw createError(400, "Selected option is invalid for this quiz presentation");
      selectedOption = optionOrder[presentedIndex];
      isCorrect = Boolean(question.options?.[selectedOption]?.isCorrect);
    } else if (question.questionType !== "mcq" && textAnswer) {
      isCorrect = normalizeText(textAnswer) === normalizeText(question.correctAnswer);
    }
    return {
      questionId: question._id,
      selectedOption,
      textAnswer,
      isCorrect,
      marksAwarded: isCorrect ? question.marks : 0,
    };
  });
  if ([...submittedByQuestion.keys()].some((id) => !questions.some((q) => String(q._id) === id)))
    throw createError(400, "Submission contains a question outside this quiz");
  const score = Number(answers.reduce((sum, answer) => sum + answer.marksAwarded, 0).toFixed(2));
  const maxScore = Number(questions.reduce((sum, question) => sum + question.marks, 0).toFixed(2));
  return { answers, score, maxScore, percentage: maxScore ? (score / maxScore) * 100 : 0 };
}

function validateQuestions(value: unknown): IQuizQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200)
    throw createError(400, "Quiz must contain between 1 and 200 questions");
  return value.map((raw, index) => {
    const question = raw as IQuizQuestion;
    if (!question.questionText?.trim()) throw createError(400, `Question ${index + 1} is blank`);
    if (!Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0)
      throw createError(400, `Question ${index + 1} must have positive marks`);
    if (!["mcq", "true_false", "short_answer"].includes(question.questionType))
      throw createError(400, `Question ${index + 1} has an unsupported quiz question type`);
    if (question.questionType === "mcq") {
      if (
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.length > 10
      )
        throw createError(400, `Question ${index + 1} must have 2 to 10 options`);
      if (question.options.some((option) => !option.optionText?.trim()))
        throw createError(400, `Question ${index + 1} has a blank option`);
      if (question.options.filter((option) => option.isCorrect).length !== 1)
        throw createError(400, `Question ${index + 1} must have exactly one correct option`);
    } else if (!question.correctAnswer?.trim()) {
      throw createError(400, `Question ${index + 1} requires a correct answer`);
    }
    return question;
  });
}

async function resolveQuizQuestions(value: unknown, subjectId: string) {
  if (!Array.isArray(value)) return validateQuestions(value);
  const references = [
    ...new Set(
      value
        .map((item) => String((item as { questionId?: unknown }).questionId ?? ""))
        .filter(Boolean),
    ),
  ];
  if (!references.length) return validateQuestions(value);
  if (references.some((id) => !Types.ObjectId.isValid(id)))
    throw createError(400, "Referenced question ID is invalid");
  const bankQuestions = await QuestionModel.find({
    _id: { $in: references },
    subjectId,
    status: QuestionStatus.APPROVED,
    isActive: true,
  }).lean();
  if (bankQuestions.length !== references.length)
    throw createError(400, "Every referenced question must be approved for the quiz subject");
  const byId = new Map(bankQuestions.map((question) => [String(question._id), question]));
  return validateQuestions(
    value.map((raw) => {
      const referenceId = String((raw as { questionId?: unknown }).questionId ?? "");
      if (!referenceId) return raw;
      const question = byId.get(referenceId)!;
      if (!["mcq", "true_false", "short_answer"].includes(question.questionType))
        throw createError(400, "Long-answer and coding bank questions require manual assessment");
      return {
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        correctAnswer: question.correctAnswer,
        marks: question.marks,
      };
    }),
  );
}

async function normalizeQuiz(data: Record<string, unknown>, facultyId: string, existing?: IQuiz) {
  const sectionId = String(data.sectionId ?? existing?.sectionId ?? "");
  const subjectId = String(data.subjectId ?? existing?.subjectId ?? "");
  if (!Types.ObjectId.isValid(sectionId) || !Types.ObjectId.isValid(subjectId))
    throw createError(400, "Valid section and subject are required");
  const section = await sectionRepository.findRawById(sectionId);
  if (!section) throw createError(404, "Section not found");
  const [curriculum, subject] = await Promise.all([
    curriculumRepository.findById(section.curriculumId.toString()),
    subjectRepository.findById(subjectId),
  ]);
  const semesterPlan = curriculum?.semesterPlans.find(
    (item) => item.semesterNo === section.semesterNo,
  );
  if (
    !curriculum?.isActive ||
    !semesterPlan?.subjects.some((item) => String(item.subjectId) === subjectId)
  )
    throw createError(400, "Subject is not assigned to the section curriculum");
  if (!subject?.isActive) throw createError(404, "Active subject not found");
  if (
    !(await TimetableModel.exists({
      sectionId: section._id,
      isApproved: true,
      isActive: true,
      slots: { $elemMatch: { subjectId, facultyId } },
    }))
  )
    throw createError(403, "Faculty is not assigned to teach this subject and section");
  const startDateTime = new Date(String(data.startDateTime ?? existing?.startDateTime ?? ""));
  const endDateTime = new Date(String(data.endDateTime ?? existing?.endDateTime ?? ""));
  const durationMinutes = Number(data.durationMinutes ?? existing?.durationMinutes);
  if (!Number.isFinite(startDateTime.getTime()) || !Number.isFinite(endDateTime.getTime()))
    throw createError(400, "Quiz start and end date/time are required");
  if (endDateTime <= startDateTime) throw createError(400, "Quiz end must be after its start");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480)
    throw createError(400, "Quiz duration must be between 1 and 480 minutes");
  if (endDateTime.getTime() - startDateTime.getTime() < durationMinutes * 60_000)
    throw createError(400, "Quiz window must be at least as long as its duration");
  const questions = await resolveQuizQuestions(data.questions ?? existing?.questions, subjectId);
  return {
    ...data,
    questions,
    totalMarks: Number(
      questions.reduce((sum, question) => sum + Number(question.marks), 0).toFixed(2),
    ),
    sectionId: section._id,
    subjectId: subject._id,
    subjectCode: subject.code,
    facultyId,
    departmentId: section.departmentId,
    program: section.program,
    semester: section.semesterNo,
    section: section.sectionName,
    academicYear: section.academicYear,
    durationMinutes,
    startDateTime,
    endDateTime,
  };
}

export const quizService = {
  getAll: (
    filter: Record<string, unknown>,
    page: number,
    limit: number,
    includeAnswerKey = false,
  ) => quizRepository.list(filter, page, limit, includeAnswerKey),

  getById: (id: string) => quizRepository.findById(id),

  create: async (data: Record<string, unknown>) => {
    const normalized = await normalizeQuiz(data, String(data.facultyId ?? ""));
    return quizRepository.create({
      ...normalized,
      status: QuizStatus.DRAFT,
      isActive: false,
      totalAttempts: 0,
    });
  },

  update: async (id: string, data: Record<string, unknown>, facultyId: string) => {
    const existing = (await quizRepository.findById(id)) as unknown as IQuiz | null;
    if (!existing) throw createError(404, "Quiz not found");
    if (existing.status !== QuizStatus.DRAFT)
      throw createError(409, "Only draft quizzes can be edited");
    const normalized = (await normalizeQuiz(data, facultyId, existing)) as Record<string, unknown>;
    for (const field of [
      "_id",
      "status",
      "isActive",
      "publishedAt",
      "closedAt",
      "totalAttempts",
      "createdBy",
      "createdAt",
      "updatedAt",
    ])
      delete normalized[field];
    const updated = await quizRepository.updateDraft(id, normalized);
    if (!updated) throw createError(409, "Quiz was concurrently published");
    return updated;
  },

  deleteDraft: async (id: string, facultyId?: string) => {
    const deleted = await quizRepository.deleteDraft(id, facultyId);
    if (!deleted) throw createError(409, "Only an authorized draft quiz can be deleted");
    return deleted;
  },

  publish: async (id: string, facultyId?: string) => {
    const quiz = await quizRepository.findById(id);
    if (!quiz) throw createError(404, "Quiz not found");
    if (quiz.status !== QuizStatus.DRAFT)
      throw createError(409, "Only draft quizzes can be published");
    if (!quiz.startDateTime || !quiz.endDateTime || quiz.endDateTime.getTime() <= Date.now())
      throw createError(400, "Quiz window must end in the future");
    const now = Date.now();
    const questionIds = [
      ...new Set(
        quiz.questions.map((question) => String(question.questionId ?? "")).filter(Boolean),
      ),
    ];
    const published = await quizRepository.publish(
      id,
      quiz.startDateTime.getTime() <= now && quiz.endDateTime.getTime() > now,
      questionIds,
      facultyId,
    );
    if (!published) throw createError(409, "Quiz was concurrently changed or published");
    return published;
  },

  close: async (id: string, facultyId?: string) => {
    const closed = await quizRepository.close(id, facultyId);
    if (!closed) throw createError(409, "Only a published quiz can be closed");
    return closed;
  },

  startAttempt: async (quizId: string, studentId: string) => {
    const [quiz, existingAttempt] = await Promise.all([
      quizRepository.findById(quizId),
      quizRepository.getStudentAttempt(quizId, studentId),
    ]);
    if (!quiz) throw createError(404, "Quiz not found");
    const now = new Date();
    if (existingAttempt?.isSubmitted) throw createError(409, "Quiz has already been submitted");
    if (
      !existingAttempt &&
      (quiz.status !== QuizStatus.PUBLISHED ||
        !quiz.isActive ||
        !quiz.startDateTime ||
        !quiz.endDateTime ||
        now < quiz.startDateTime ||
        now > quiz.endDateTime)
    )
      throw createError(409, "Quiz is not open for attempts");
    let attempt = existingAttempt;
    if (!attempt) {
      // The open-window guard above guarantees this for a newly created attempt.
      if (!quiz.endDateTime) throw createError(409, "Quiz end time is not configured");
      const questionOrder = quiz.shuffleQuestions
        ? shuffled(quiz.questions.map((_, index) => index))
        : quiz.questions.map((_, index) => index);
      const presentation = questionOrder.map((index) => {
        const question = quiz.questions[index];
        const optionIndexes = question.options?.map((_, optionIndex) => optionIndex) ?? [];
        return {
          questionId: question._id,
          optionOrder: quiz.shuffleOptions ? shuffled(optionIndexes) : optionIndexes,
        };
      });
      const expiresAt = new Date(
        Math.min(quiz.endDateTime.getTime(), now.getTime() + quiz.durationMinutes * 60_000),
      );
      try {
        attempt = (
          await quizRepository.createAttemptWithCount(quizId, {
            quizId,
            studentId,
            startedAt: now,
            expiresAt,
            presentation,
            draftAnswers: [],
            answerRevision: 0,
            answers: [],
            score: 0,
            maxScore: quiz.totalMarks,
            percentage: 0,
            isSubmitted: false,
            autoSubmitted: false,
          })
        ).toObject();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        attempt = await quizRepository.getStudentAttempt(quizId, studentId);
      }
    }
    if (!attempt) throw createError(409, "Quiz attempt could not be created");
    if (attempt.expiresAt.getTime() < now.getTime()) {
      const result = gradeQuizAnswers(
        quiz.questions,
        attempt.presentation,
        asSubmittedAnswers(attempt.draftAnswers ?? []),
      );
      const submitted = await quizRepository.submitAttempt(quizId, studentId, now, {
        ...result,
        autoSubmitted: true,
        timeTakenSeconds: Math.max(
          0,
          Math.round((attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000),
        ),
      });
      return {
        completed: true,
        result: quiz.showResultImmediately
          ? { ...result, submittedAt: submitted?.submittedAt, resultReleased: true }
          : { submittedAt: submitted?.submittedAt, resultReleased: false },
      };
    }
    const questionById = new Map(
      quiz.questions.map((question) => [String(question._id), question]),
    );
    const questions = attempt.presentation.map((item) => {
      const question = questionById.get(String(item.questionId));
      if (!question) throw createError(409, "Quiz questions changed after attempt creation");
      return {
        _id: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        marks: question.marks,
        options: item.optionOrder.map((index) => ({
          optionText: question.options?.[index]?.optionText ?? "",
        })),
      };
    });
    return {
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        subjectCode: quiz.subjectCode,
        durationMinutes: quiz.durationMinutes,
        showResultImmediately: quiz.showResultImmediately,
        proctoringEnabled: quiz.proctoringEnabled,
        proctoringConfig: quiz.proctoringConfig,
        questions,
      },
      attempt: {
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        answers: attempt.draftAnswers ?? [],
        revision: attempt.answerRevision ?? 0,
        lastSavedAt: attempt.lastSavedAt,
        serverTime: now,
      },
    };
  },

  saveAnswers: async (
    quizId: string,
    studentId: string,
    submitted: SubmittedAnswer[],
    revision: number,
  ) => {
    const attempt = await quizRepository.getStudentAttempt(quizId, studentId);
    if (!attempt || attempt.isSubmitted) throw createError(409, "No active quiz attempt exists");
    if (!Number.isInteger(revision) || revision < 1)
      throw createError(400, "Invalid answer revision");
    // Reuse the presentation validator without exposing or trusting a client-side score.
    const allowed = new Map(
      attempt.presentation.map((item) => [String(item.questionId), item.optionOrder.length]),
    );
    const seen = new Set<string>();
    const answers = submitted.map((answer) => {
      const questionId = String(answer.questionId);
      const optionCount = allowed.get(questionId);
      if (optionCount === undefined || seen.has(questionId))
        throw createError(400, "Answers must reference each presented question at most once");
      seen.add(questionId);
      if (
        answer.selectedOption !== undefined &&
        (!Number.isInteger(answer.selectedOption) ||
          answer.selectedOption < 0 ||
          answer.selectedOption >= optionCount)
      )
        throw createError(400, "Selected option is invalid for this quiz presentation");
      return {
        questionId,
        selectedOption: answer.selectedOption,
        textAnswer: answer.textAnswer?.trim(),
      };
    });
    const now = new Date();
    const updated = await quizRepository.saveDraftAnswers(
      quizId,
      studentId,
      revision,
      answers,
      now,
    );
    if (!updated) {
      const current = await quizRepository.getStudentAttempt(quizId, studentId);
      if (current?.isSubmitted) throw createError(409, "Quiz has already been submitted");
      if (current && current.answerRevision >= revision)
        return { revision: current.answerRevision, lastSavedAt: current.lastSavedAt };
      throw createError(409, "Quiz attempt time has expired");
    }
    return { revision: updated.answerRevision, lastSavedAt: updated.lastSavedAt };
  },

  submitAttempt: async (quizId: string, studentId: string, submitted: SubmittedAnswer[]) => {
    const [quiz, attempt] = await Promise.all([
      quizRepository.findById(quizId),
      quizRepository.getStudentAttempt(quizId, studentId),
    ]);
    if (!quiz) throw createError(404, "Quiz not found");
    if (!attempt) throw createError(409, "No active quiz attempt exists");
    if (attempt.isSubmitted)
      return quiz.showResultImmediately
        ? {
            score: attempt.score,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            answers: attempt.answers,
            submittedAt: attempt.submittedAt,
            resultReleased: true,
          }
        : { submittedAt: attempt.submittedAt, resultReleased: false };
    if (!Array.isArray(submitted)) throw createError(400, "Answers are required");
    const now = new Date();
    const graceDeadline = attempt.expiresAt.getTime() + 10_000;
    const effectiveAnswers =
      now.getTime() <= graceDeadline ? submitted : asSubmittedAnswers(attempt.draftAnswers ?? []);
    const result = gradeQuizAnswers(quiz.questions, attempt.presentation, effectiveAnswers);
    const updated = await quizRepository.submitAttempt(quizId, studentId, now, {
      ...result,
      autoSubmitted: now > attempt.expiresAt,
      timeTakenSeconds: Math.max(
        0,
        Math.min(
          Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000),
          Math.round((attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000),
        ),
      ),
    });
    if (!updated) throw createError(409, "Quiz attempt expired or was already submitted");
    return quiz.showResultImmediately
      ? { ...result, submittedAt: updated.submittedAt, resultReleased: true }
      : { submittedAt: updated.submittedAt, resultReleased: false };
  },

  getStudentAttempt: async (quizId: string, studentId: string) => {
    const [quiz, attempt] = await Promise.all([
      quizRepository.findById(quizId),
      quizRepository.getStudentAttempt(quizId, studentId),
    ]);
    if (!attempt || !quiz) return attempt;
    if (!quiz.showResultImmediately && quiz.status !== QuizStatus.CLOSED) {
      return {
        _id: attempt._id,
        quizId: attempt.quizId,
        studentId: attempt.studentId,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: attempt.submittedAt,
        timeTakenSeconds: attempt.timeTakenSeconds,
        isSubmitted: attempt.isSubmitted,
        resultReleased: false,
      };
    }
    const questions = new Map(quiz.questions.map((question) => [String(question._id), question]));
    return {
      ...attempt,
      answers: attempt.answers.map((answer) => {
        const question = questions.get(String(answer.questionId));
        const selectedOption =
          answer.selectedOption !== undefined
            ? question?.options?.[answer.selectedOption]?.optionText
            : answer.textAnswer;
        const correctOption =
          question?.questionType === "mcq"
            ? question.options?.find((option) => option.isCorrect)?.optionText
            : question?.correctAnswer;
        return {
          questionId: answer.questionId,
          questionText: question?.questionText,
          selectedOption,
          correctOption,
          isCorrect: answer.isCorrect,
          marksObtained: answer.marksAwarded,
          maxMarks: question?.marks ?? 0,
        };
      }),
      resultReleased: true,
    };
  },

  // ── Proctoring ─────────────────────────────────────────────────────────────

  /**
   * Record a proctoring violation event from the student's browser.
   * If tab_switch count exceeds the configured limit, the attempt is
   * auto-submitted.
   */
  async recordProctoringEvent(
    quizId: string,
    studentId: string,
    eventType: ProctoringEventType,
    metadata?: Record<string, unknown>,
  ) {
    const [quiz, attempt] = await Promise.all([
      QuizModel.findById(quizId).select(
        "status isActive startDateTime endDateTime proctoringEnabled proctoringConfig",
      ),
      QuizAttemptModel.findOne({ quizId, studentId }),
    ]);
    if (!quiz) throw createError(404, "Quiz not found");
    if (!quiz.proctoringEnabled) throw createError(400, "Proctoring is not enabled for this quiz");
    if (!attempt || attempt.isSubmitted || attempt.expiresAt.getTime() < Date.now())
      throw createError(409, "No active quiz attempt exists");
    if (metadata && JSON.stringify(metadata).length > 5000)
      throw createError(400, "Proctoring event metadata is too large");

    // Insert the event log
    await ProctoringLogModel.create({
      quizId,
      studentId,
      eventType,
      timestamp: new Date(),
      metadata,
    });

    // Check auto-submit threshold for tab_switch
    let autoSubmitted = false;
    const cfg = quiz.proctoringConfig;
    if (eventType === "tab_switch" && cfg.tabSwitchLimit > 0) {
      const violations = await ProctoringLogModel.countDocuments({
        quizId,
        studentId,
        eventType: "tab_switch",
      });

      if (violations >= cfg.tabSwitchLimit) {
        const freshAttempt = await quizRepository.getStudentAttempt(quizId, studentId);
        if (freshAttempt && !freshAttempt.isSubmitted) {
          const result = gradeQuizAnswers(
            (await quizRepository.findById(quizId))!.questions,
            freshAttempt.presentation,
            asSubmittedAnswers(freshAttempt.draftAnswers ?? []),
          );
          const updatedAttempt = await quizRepository.submitAttempt(quizId, studentId, new Date(), {
            ...result,
            autoSubmitted: true,
            timeTakenSeconds: Math.max(
              0,
              Math.round((Date.now() - freshAttempt.startedAt.getTime()) / 1000),
            ),
          });
          if (!updatedAttempt) return { recorded: true, autoSubmitted: false };
          autoSubmitted = true;

          await ProctoringLogModel.create({
            quizId,
            studentId,
            eventType: "auto_submitted",
            timestamp: new Date(),
            metadata: { reason: "tab_switch_limit_exceeded", limit: cfg.tabSwitchLimit },
          });
        }
      }
    }

    return { recorded: true, autoSubmitted };
  },

  /**
   * Get all proctoring events for a quiz — for faculty / admin review.
   */
  async getProctoringLog(quizId: string) {
    const quiz = await QuizModel.findById(quizId)
      .select("title proctoringEnabled proctoringConfig")
      .lean();
    if (!quiz) throw createError(404, "Quiz not found");

    const events = await ProctoringLogModel.find({ quizId })
      .populate("studentId", "name rollNumber")
      .sort({ timestamp: -1 })
      .lean();

    return {
      ...quiz,
      proctoringEvents: events,
    };
  },
};
