import { ScholarshipModel, ScholarshipSchemeModel } from "../models";

export const scholarshipRepository = {
  findById: (id: string) => ScholarshipModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => ScholarshipModel.create(data),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ScholarshipModel.find(filter)
        .populate("studentId", "name email rollNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ScholarshipModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  markReviewed: (
    id: string,
    verifiedBy: string,
    snapshot: Record<string, unknown>,
    remarks?: string,
  ) =>
    ScholarshipModel.findOneAndUpdate(
      { _id: id, status: { $in: ["applied", "document_pending"] } },
      {
        $set: {
          status: "under_review",
          verifiedBy,
          verifiedAt: new Date(),
          eligibilitySnapshot: snapshot,
          remarks,
        },
      },
      { returnDocument: "after" },
    ).lean(),

  reject: (id: string, rejectedBy: string, remarks: string) =>
    ScholarshipModel.findOneAndUpdate(
      { _id: id, status: { $in: ["applied", "document_pending", "under_review"] } },
      {
        $set: {
          status: "rejected",
          rejectionReason: remarks,
          remarks,
          updatedBy: rejectedBy,
        },
      },
      { returnDocument: "after" },
    ).lean(),

  countByStatus: (academicYear: string) =>
    ScholarshipModel.aggregate([
      { $match: { academicYear } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "disbursed"] }, then: "$disbursedAmount" },
                  { case: { $eq: ["$status", "approved"] }, then: "$approvedAmount" },
                ],
                default: "$amount",
              },
            },
          },
        },
      },
    ]),

  listSchemes: (filter: Record<string, unknown>) =>
    ScholarshipSchemeModel.find(filter).sort({ academicYear: -1, name: 1 }).lean(),

  findSchemeById: (id: string) => ScholarshipSchemeModel.findById(id).lean(),

  createScheme: (data: Record<string, unknown>) => ScholarshipSchemeModel.create(data),
};
