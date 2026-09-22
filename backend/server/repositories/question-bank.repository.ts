import { QuestionModel } from "../models";
import { QuestionStatus } from "../models/question-bank.model";
import { Types } from "mongoose";

export const questionBankRepository = {
  findById: (id: string) => QuestionModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => QuestionModel.create(data),

  createBulk: (data: Record<string, unknown>[]) => QuestionModel.insertMany(data),

  findDuplicate: (subjectId: string, fingerprint: string, excludeId?: string) =>
    QuestionModel.exists({
      subjectId,
      fingerprint,
      status: { $ne: QuestionStatus.RETIRED },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }),

  findDuplicates: (pairs: Array<{ subjectId: string; fingerprint: string }>) =>
    QuestionModel.find({
      status: { $ne: QuestionStatus.RETIRED },
      $or: pairs,
    })
      .select("subjectId fingerprint")
      .lean(),

  updateDraft: (id: string, data: Record<string, unknown>, createdBy?: string) =>
    QuestionModel.findOneAndUpdate(
      {
        _id: id,
        status: QuestionStatus.DRAFT,
        usageCount: 0,
        ...(createdBy ? { createdBy } : {}),
      },
      { $set: data, $inc: { revision: 1 } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  approve: (id: string, approvedBy: string) =>
    QuestionModel.findOneAndUpdate(
      { _id: id, status: QuestionStatus.DRAFT },
      {
        $set: {
          status: QuestionStatus.APPROVED,
          isActive: true,
          approvedBy,
          approvedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  retire: (id: string, retiredBy: string, retirementReason: string) =>
    QuestionModel.findOneAndUpdate(
      { _id: id, status: { $ne: QuestionStatus.RETIRED } },
      {
        $set: {
          status: QuestionStatus.RETIRED,
          isActive: false,
          retiredBy,
          retiredAt: new Date(),
          retirementReason,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  deleteUnusedDraft: (id: string, createdBy?: string) =>
    QuestionModel.findOneAndDelete({
      _id: id,
      status: QuestionStatus.DRAFT,
      usageCount: 0,
      ...(createdBy ? { createdBy } : {}),
    }).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      QuestionModel.find(filter)
        .populate("subjectId", "name code")
        .sort({ subjectId: 1, unitNo: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuestionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getRandomQuestions: (subjectId: string, unitNo: number, difficulty: string, count: number) =>
    QuestionModel.aggregate([
      {
        $match: {
          subjectId: new Types.ObjectId(subjectId),
          unitNo,
          difficultyLevel: difficulty,
          status: QuestionStatus.APPROVED,
          isActive: true,
        },
      },
      { $sample: { size: count } },
    ]),

  incrementUsage: (id: string) =>
    QuestionModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } }).lean(),
};
