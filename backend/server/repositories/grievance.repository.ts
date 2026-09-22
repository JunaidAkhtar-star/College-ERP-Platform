import { GrievanceModel, GrievanceStatus } from "../models/grievance.model";

export const grievanceRepository = {
  // ─── Create ───────────────────────────────────────────────────────────────

  create: (data: Record<string, unknown>) => GrievanceModel.create(data),

  // ─── Read ─────────────────────────────────────────────────────────────────

  findById: (id: string) => GrievanceModel.findById(id).lean(),

  findByRef: (referenceNumber: string) => GrievanceModel.findOne({ referenceNumber }).lean(),

  findByStudent: (studentId: string, filter: Record<string, unknown> = {}, page = 1, limit = 20) =>
    grievanceRepository.paginate({ ...filter, studentId }, page, limit),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      GrievanceModel.find(filter)
        .populate("studentId", "name email")
        .populate("respondedBy", "name")
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GrievanceModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // ─── Status update with timeline append ───────────────────────────────────

  updateStatus: (
    id: string,
    allowedFrom: GrievanceStatus[],
    status: GrievanceStatus,
    note: string,
    updatedBy: string,
    updatedByName: string,
    extra: Record<string, unknown> = {},
  ) =>
    GrievanceModel.findOneAndUpdate(
      { _id: id, status: { $in: allowedFrom } },
      {
        $set: { status, ...extra },
        $push: {
          timeline: {
            status,
            note,
            updatedBy,
            updatedByName,
            updatedAt: new Date(),
          },
        },
      },
      { runValidators: true, returnDocument: "after" },
    ).lean(),

  // ─── Respond ──────────────────────────────────────────────────────────────

  respond: (
    id: string,
    allowedFrom: GrievanceStatus[],
    response: string,
    respondedBy: string,
    respondedByName: string,
    newStatus: GrievanceStatus,
  ) =>
    GrievanceModel.findOneAndUpdate(
      { _id: id, status: { $in: allowedFrom } },
      {
        $set: {
          response,
          respondedBy,
          respondedAt: new Date(),
          status: newStatus,
          ...(newStatus === "resolved" ? { resolvedAt: new Date() } : {}),
        },
        $push: {
          timeline: {
            status: newStatus,
            note: `Response recorded: ${response.slice(0, 100)}…`,
            updatedBy: respondedBy,
            updatedByName: respondedByName,
            updatedAt: new Date(),
          },
        },
      },
      { returnDocument: "after" },
    ).lean(),

  // ─── Satisfaction rating ──────────────────────────────────────────────────

  rateSatisfaction: (id: string, studentId: string, rating: number, feedback?: string) =>
    GrievanceModel.findOneAndUpdate(
      {
        _id: id,
        studentId,
        status: GrievanceStatus.RESOLVED,
        satisfactionRating: { $exists: false },
      },
      { $set: { satisfactionRating: rating, satisfactionFeedback: feedback } },
      { returnDocument: "after" },
    ).lean(),

  // ─── Analytics ────────────────────────────────────────────────────────────

  getStats: (filter: Record<string, unknown> = {}) =>
    GrievanceModel.aggregate([
      { $match: filter },
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
          avgResolutionDays: [
            { $match: { resolvedAt: { $exists: true } } },
            {
              $group: {
                _id: null,
                avg: {
                  $avg: {
                    $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60 * 24],
                  },
                },
              },
            },
          ],
        },
      },
    ]),
};
