import { IQACFeedbackModel, IQACAuditModel, COPOAttainmentModel } from "../models";

export const iqacRepository = {
  // Feedback
  createFeedback: (data: Record<string, unknown>) => IQACFeedbackModel.create(data),

  listFeedback: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      IQACFeedbackModel.find(filter)
        .select("-respondentId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IQACFeedbackModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getFeedbackAnalysis: (feedbackType: string, academicYear: string, targetId?: string) =>
    IQACFeedbackModel.aggregate([
      { $match: { feedbackType, academicYear, ...(targetId ? { targetId } : {}) } },
      { $unwind: "$ratings" },
      {
        $group: { _id: "$ratings.criterion", avg: { $avg: "$ratings.score" }, count: { $sum: 1 } },
      },
      { $sort: { _id: 1 } },
    ]),

  // Audits
  findAuditById: (id: string) => IQACAuditModel.findById(id).lean(),

  createAudit: (data: Record<string, unknown>) => IQACAuditModel.create(data),

  updateAudit: (id: string, data: Record<string, unknown>) =>
    IQACAuditModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean(),

  updateAuditWhen: (filter: Record<string, unknown>, data: Record<string, unknown>) =>
    IQACAuditModel.findOneAndUpdate(filter, { $set: data }, { returnDocument: "after" }).lean(),

  listAudits: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      IQACAuditModel.find(filter)
        .populate("departmentId", "name code")
        .sort({ auditDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IQACAuditModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // CO-PO Attainment
  findAttainment: (
    academicYear: string,
    subjectId: string,
    section: string,
    departmentId?: string,
  ) =>
    COPOAttainmentModel.findOne({
      academicYear,
      subjectId,
      section,
      ...(departmentId ? { departmentId } : {}),
    }).lean(),

  upsertAttainment: (filter: Record<string, unknown>, data: Record<string, unknown>) =>
    COPOAttainmentModel.findOneAndUpdate(filter, { $set: data }, { upsert: true }).lean(),

  getPOAttainmentSummary: (academicYear: string, program: string, departmentId?: string) =>
    COPOAttainmentModel.aggregate([
      { $match: { academicYear, program, ...(departmentId ? { departmentId } : {}) } },
      { $unwind: "$poAttainments" },
      {
        $group: {
          _id: "$poAttainments.poCode",
          avgAttainment: { $avg: "$poAttainments.attainmentLevel" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
};
