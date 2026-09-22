import {
  StudentPlacementProfileModel,
  PlacementEligibilityStatus,
} from "../models/student-placement-profile.model";

export const studentPlacementProfileRepository = {
  findById: (id: string) => StudentPlacementProfileModel.findById(id).lean(),

  findByStudentId: (studentId: string) =>
    StudentPlacementProfileModel.findOne({ studentId }).lean(),

  create: (data: Record<string, unknown>) => StudentPlacementProfileModel.create(data),

  updateByStudentId: (studentId: string, data: Record<string, unknown>) =>
    StudentPlacementProfileModel.findOneAndUpdate(
      { studentId },
      { $set: data },
      { upsert: false },
    ).lean(),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      StudentPlacementProfileModel.find(filter).sort({ cgpa: -1 }).skip(skip).limit(limit).lean(),
      StudentPlacementProfileModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  /** For eligibility batch processing. */
  findEligibleByDriveCriteria: (
    programs: string[],
    branches: string[],
    batches: string[],
    minCgpa: number,
    maxBacklogs: number,
  ) =>
    StudentPlacementProfileModel.find({
      program: { $in: programs },
      branch: { $in: branches },
      batch: { $in: batches },
      cgpa: { $gte: minCgpa },
      activeBacklogs: { $lte: maxBacklogs },
      isEligibleForPlacement: true,
      eligibilityStatus: { $nin: [PlacementEligibilityStatus.OPTED_OUT] },
    })
      .select(
        "studentId rollNumber name program branch batch cgpa activeBacklogs linkedinUrl resumeUrl",
      )
      .lean(),

  /** Placement statistics for dashboard. */
  getStats: (batch?: string) => {
    const match: Record<string, unknown> = {};
    if (batch) match.batch = batch;
    return StudentPlacementProfileModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          eligible: { $sum: { $cond: ["$isEligibleForPlacement", 1, 0] } },
          placed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eligibilityStatus", "placed"] },
                    { $eq: ["$placementOutcomeVerified", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          optedOut: { $sum: { $cond: [{ $eq: ["$eligibilityStatus", "opted_out"] }, 1, 0] } },
          avgCgpa: { $avg: "$cgpa" },
          avgPackage: {
            $avg: { $cond: ["$placementOutcomeVerified", "$placedPackage", null] },
          },
          maxPackage: {
            $max: { $cond: ["$placementOutcomeVerified", "$placedPackage", null] },
          },
          minPackage: {
            $min: { $cond: ["$placementOutcomeVerified", "$placedPackage", null] },
          },
        },
      },
    ]);
  },

  /** Companies visited (distinct placed companies for a batch). */
  getPlacedCompanies: (batch: string) =>
    StudentPlacementProfileModel.distinct("placedCompany", {
      batch,
      eligibilityStatus: PlacementEligibilityStatus.PLACED,
      placementOutcomeVerified: true,
    }),
};
