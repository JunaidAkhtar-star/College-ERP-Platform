import { AlumniModel } from "../models";

export const alumniRepository = {
  findById: (id: string) => AlumniModel.findById(id).lean(),

  findByEmail: (email: string) => AlumniModel.findOne({ email }).lean(),

  create: (data: Record<string, unknown>) => AlumniModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    AlumniModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  updateCareer: (id: string, data: Record<string, unknown>) =>
    AlumniModel.findByIdAndUpdate(
      id,
      {
        $set: { ...data, careerOutcomeVerified: false },
        $unset: { careerOutcomeVerifiedBy: "", careerOutcomeVerifiedAt: "" },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AlumniModel.find(filter).sort({ passoutYear: -1 }).skip(skip).limit(limit).lean(),
      AlumniModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getStatsByYear: async () => {
    const [result] = await AlumniModel.aggregate([
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                identityVerified: { $sum: { $cond: ["$isVerified", 1, 0] } },
                careerVerified: { $sum: { $cond: ["$careerOutcomeVerified", 1, 0] } },
                employed: { $sum: { $cond: ["$isPlaced", 1, 0] } },
                higherStudies: {
                  $sum: { $cond: [{ $eq: [{ $type: "$higherStudies" }, "object"] }, 1, 0] },
                },
                avgPackage: { $avg: { $cond: ["$careerOutcomeVerified", "$package", null] } },
              },
            },
            { $project: { _id: 0 } },
          ],
          graduationTrend: [
            {
              $group: {
                _id: "$passoutYear",
                total: { $sum: 1 },
                placed: { $sum: { $cond: ["$isPlaced", 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
          programs: [
            { $group: { _id: "$program", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 },
          ],
          employers: [
            { $match: { currentEmployer: { $exists: true, $nin: [null, ""] } } },
            { $group: { _id: "$currentEmployer", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 },
          ],
          locations: [
            { $match: { currentLocation: { $exists: true, $nin: [null, ""] } } },
            { $group: { _id: "$currentLocation", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 },
          ],
        },
      },
    ]);
    return {
      summary: result?.summary?.[0] ?? {
        total: 0,
        identityVerified: 0,
        careerVerified: 0,
        employed: 0,
        higherStudies: 0,
        avgPackage: 0,
      },
      graduationTrend: result?.graduationTrend ?? [],
      programs: result?.programs ?? [],
      employers: result?.employers ?? [],
      locations: result?.locations ?? [],
    };
  },

  verify: (id: string, verifiedBy: string) =>
    AlumniModel.findOneAndUpdate(
      { _id: id, isVerified: false },
      {
        $set: {
          isVerified: true,
          verifiedBy,
          verifiedAt: new Date(),
          verificationSource: "legacy_review",
        },
      },
      { returnDocument: "after" },
    ).lean(),
};
