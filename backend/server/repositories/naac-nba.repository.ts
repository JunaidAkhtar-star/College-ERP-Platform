import { NaacEvidenceModel, NbaReportModel } from "../models/naac-nba.model";

export const naacNbaRepository = {
  // ─── NAAC ─────────────────────────────────────────────────────────────────
  createEvidence: (data: Record<string, unknown>) => NaacEvidenceModel.create(data),

  findEvidenceById: (id: string) => NaacEvidenceModel.findById(id).lean(),

  listEvidence: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NaacEvidenceModel.find(filter)
        .populate("submittedBy", "name email")
        .populate("reviewedBy", "name email")
        .sort({ criterion: 1, metricNo: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NaacEvidenceModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateEvidence: (id: string, data: Record<string, unknown>) =>
    NaacEvidenceModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean(),

  updateEvidenceWhen: (filter: Record<string, unknown>, data: Record<string, unknown>) =>
    NaacEvidenceModel.findOneAndUpdate(filter, { $set: data }, { returnDocument: "after" }).lean(),

  criterionSummary: (academicYear: string) =>
    NaacEvidenceModel.aggregate([
      { $match: { academicYear } },
      {
        $group: {
          _id: "$criterion",
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          averageScore: { $avg: "$score" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

  // ─── NBA ──────────────────────────────────────────────────────────────────
  createReport: (data: Record<string, unknown>) => NbaReportModel.create(data),

  findReportById: (id: string) => NbaReportModel.findById(id).lean(),

  listReports: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NbaReportModel.find(filter)
        .populate("departmentId", "name code")
        .populate("generatedBy", "name email")
        .sort({ academicYear: -1, semester: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NbaReportModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateReport: (id: string, data: Record<string, unknown>) =>
    NbaReportModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean(),

  updateReportWhen: (filter: Record<string, unknown>, data: Record<string, unknown>) =>
    NbaReportModel.findOneAndUpdate(filter, { $set: data }, { returnDocument: "after" }).lean(),

  poDepartmentSummary: (departmentId: string, academicYear: string) =>
    NbaReportModel.aggregate([
      {
        $match: {
          departmentId: new (require("mongoose").Types.ObjectId)(departmentId),
          academicYear,
          status: "approved",
        },
      },
      { $unwind: "$poAttainments" },
      {
        $group: {
          _id: { program: "$program", poCode: "$poAttainments.poCode" },
          averagePercentage: { $avg: "$poAttainments.attainmentLevel" },
        },
      },
      {
        $group: {
          _id: "$_id.program",
          averagePo: { $avg: "$averagePercentage" },
          poBreakdown: {
            $push: { poCode: "$_id.poCode", averagePercentage: "$averagePercentage" },
          },
        },
      },
      { $project: { _id: 0, program: "$_id", averagePo: 1, poBreakdown: 1 } },
      { $sort: { program: 1 } },
    ]),
};
