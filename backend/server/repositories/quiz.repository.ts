import { QuizModel, QuizAttemptModel, QuestionModel } from "../models";
import { QuizStatus } from "../models/quiz.model";
import { QuestionStatus } from "../models/question-bank.model";
import type { UpdateQuery } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import type { IQuizAttempt } from "../models/quiz-attempt.model";

export const quizRepository = {
  findById: (id: string) => QuizModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => QuizModel.create(data),

  updateDraft: (id: string, data: Record<string, unknown>) =>
    QuizModel.findOneAndUpdate(
      { _id: id, status: QuizStatus.DRAFT },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  deleteDraft: (id: string, facultyId?: string) =>
    QuizModel.findOneAndDelete({
      _id: id,
      status: QuizStatus.DRAFT,
      ...(facultyId ? { facultyId } : {}),
    }).lean(),

  publish: async (id: string, isActive: boolean, questionIds: string[], facultyId?: string) => {
    const session = await QuizModel.db.startSession();
    try {
      let published;
      await session.withTransaction(async () => {
        if (questionIds.length) {
          const approvedCount = await QuestionModel.countDocuments({
            _id: { $in: questionIds },
            status: QuestionStatus.APPROVED,
            isActive: true,
          }).session(session);
          if (approvedCount !== questionIds.length)
            throw new Error("One or more referenced questions are no longer approved");
        }
        published = await QuizModel.findOneAndUpdate(
          { _id: id, status: QuizStatus.DRAFT, ...(facultyId ? { facultyId } : {}) },
          {
            $set: {
              status: QuizStatus.PUBLISHED,
              publishedAt: new Date(),
              isActive,
            },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!published) return;
        if (questionIds.length) {
          await QuestionModel.updateMany(
            { _id: { $in: questionIds } },
            { $inc: { usageCount: 1 } },
            { session },
          );
        }
      });
      return published;
    } finally {
      await session.endSession();
    }
  },

  close: (id: string, facultyId?: string) =>
    QuizModel.findOneAndUpdate(
      { _id: id, status: QuizStatus.PUBLISHED, ...(facultyId ? { facultyId } : {}) },
      {
        $set: { status: QuizStatus.CLOSED, closedAt: new Date(), isActive: false },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20, includeAnswerKey = false) => {
    const skip = (page - 1) * limit;
    const quizQuery = QuizModel.find(filter);
    if (!includeAnswerKey) {
      quizQuery.select("-questions.options.isCorrect -questions.correctAnswer");
    }
    const [data, total] = await Promise.all([
      quizQuery
        .populate("subjectId", "name code")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuizModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  createAttemptWithCount: async (quizId: string, data: Record<string, unknown>) => {
    const session = await QuizAttemptModel.db.startSession();
    try {
      let attempt: IQuizAttempt | undefined;
      await session.withTransaction(async () => {
        [attempt] = await QuizAttemptModel.create([data], { session });
        const countUpdate = await QuizModel.updateOne(
          { _id: quizId, status: QuizStatus.PUBLISHED },
          { $inc: { totalAttempts: 1 } },
          { session },
        );
        if (countUpdate.modifiedCount !== 1) throw new Error("Quiz is no longer published");
      });
      if (!attempt) throw new Error("Quiz attempt could not be created");
      return attempt;
    } finally {
      await session.endSession();
    }
  },

  submitAttempt: (quizId: string, studentId: string, now: Date, update: Record<string, unknown>) =>
    QuizAttemptModel.findOneAndUpdate(
      {
        quizId,
        studentId,
        isSubmitted: false,
      } as MongoFilter<IQuizAttempt>,
      { $set: { ...update, isSubmitted: true, submittedAt: now } } as UpdateQuery<IQuizAttempt>,
      { returnDocument: "after", runValidators: true },
    ).lean(),

  saveDraftAnswers: (
    quizId: string,
    studentId: string,
    revision: number,
    answers: Record<string, unknown>[],
    now: Date,
  ) =>
    QuizAttemptModel.findOneAndUpdate(
      {
        quizId,
        studentId,
        isSubmitted: false,
        expiresAt: { $gte: now },
        $or: [{ answerRevision: { $exists: false } }, { answerRevision: { $lt: revision } }],
      },
      { $set: { draftAnswers: answers, answerRevision: revision, lastSavedAt: now } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  autoSubmitAttempt: (quizId: string, studentId: string, now: Date) =>
    QuizAttemptModel.findOneAndUpdate(
      { quizId, studentId, isSubmitted: false },
      { $set: { isSubmitted: true, autoSubmitted: true, submittedAt: now } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  getStudentAttempt: (quizId: string, studentId: string) =>
    QuizAttemptModel.findOne({ quizId, studentId }).lean(),

  getStudentAttempts: (quizIds: string[], studentId: string) =>
    QuizAttemptModel.find({ quizId: { $in: quizIds }, studentId })
      .select("quizId startedAt expiresAt submittedAt score maxScore percentage isSubmitted")
      .lean(),
};
