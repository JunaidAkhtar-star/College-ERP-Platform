import { JobPostingModel, JobPostingStatus } from "../models/job-posting.model";

export const jobPostingRepository = {
  findById: (id: string) => JobPostingModel.findById(id).populate("postedBy", "name email").lean(),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20, studentId?: string) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      JobPostingModel.find(filter)
        .populate("postedBy", "name")
        .sort({ postedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobPostingModel.countDocuments(filter),
    ]);
    return {
      data: data.map((posting) => {
        const { interestedStudents, appliedStudents, ...safePosting } = posting;
        const summary = {
          interestCount: interestedStudents.length,
          appliedCount: appliedStudents.length,
        };
        return studentId
          ? {
              ...safePosting,
              ...summary,
              hasInterest: interestedStudents.some((id) => String(id) === studentId),
              hasApplied: appliedStudents.some((id) => String(id) === studentId),
            }
          : { ...posting, ...summary };
      }),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  create: (data: Record<string, unknown>) => JobPostingModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    JobPostingModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  transition: (id: string, from: JobPostingStatus, data: Record<string, unknown>) =>
    JobPostingModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  markInterest: (id: string, studentId: string, now: Date) =>
    JobPostingModel.findOneAndUpdate(
      {
        _id: id,
        status: JobPostingStatus.ACTIVE,
        applicationDeadline: { $gte: now },
        appliedStudents: { $ne: studentId },
      },
      { $addToSet: { interestedStudents: studentId } },
      { returnDocument: "after" },
    ).lean(),

  removeInterest: (id: string, studentId: string) =>
    JobPostingModel.findByIdAndUpdate(id, { $pull: { interestedStudents: studentId } }, {}).lean(),

  markApplied: (id: string, studentId: string, now: Date) =>
    JobPostingModel.findOneAndUpdate(
      {
        _id: id,
        status: JobPostingStatus.ACTIVE,
        applicationDeadline: { $gte: now },
        appliedStudents: { $ne: studentId },
      },
      {
        $addToSet: { appliedStudents: studentId },
        $pull: { interestedStudents: studentId },
      },
      { returnDocument: "after" },
    ).lean(),

  incrementView: (id: string) =>
    JobPostingModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).lean(),

  getStats: async () => {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);
    const [summary, byStatus, byType, byApplyMode, salaryBands, monthly] = await Promise.all([
      JobPostingModel.aggregate<{
        _id: null;
        total: number;
        views: number;
        interests: number;
        applications: number;
        averageSalary: number;
      }>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            views: { $sum: "$viewCount" },
            interests: { $sum: { $size: "$interestedStudents" } },
            applications: { $sum: { $size: "$appliedStudents" } },
            averageSalary: { $avg: "$salaryMin" },
          },
        },
      ]),
      JobPostingModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      JobPostingModel.aggregate<{ _id: string; count: number; applications: number }>([
        {
          $group: {
            _id: "$jobType",
            count: { $sum: 1 },
            applications: { $sum: { $size: "$appliedStudents" } },
          },
        },
        { $sort: { count: -1 } },
      ]),
      JobPostingModel.aggregate<{ _id: string; count: number; applications: number }>([
        {
          $group: {
            _id: "$applyMode",
            count: { $sum: 1 },
            applications: { $sum: { $size: "$appliedStudents" } },
          },
        },
      ]),
      JobPostingModel.aggregate<{ _id: string; count: number }>([
        { $match: { salaryMin: { $gt: 0 } } },
        {
          $bucket: {
            groupBy: "$salaryMin",
            boundaries: [0, 5, 8, 12, 100000],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      JobPostingModel.aggregate<{ _id: string; postings: number; applications: number }>([
        { $match: { postedAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$postedAt" } },
            postings: { $sum: 1 },
            applications: { $sum: { $size: "$appliedStudents" } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const totals = summary[0] ?? {
      total: 0,
      views: 0,
      interests: 0,
      applications: 0,
      averageSalary: 0,
    };
    const [closingSoon, remote] = await Promise.all([
      JobPostingModel.countDocuments({
        status: JobPostingStatus.ACTIVE,
        applicationDeadline: { $gte: now, $lte: soon },
      }),
      JobPostingModel.countDocuments({ isRemote: true, status: JobPostingStatus.ACTIVE }),
    ]);
    return {
      ...totals,
      ...Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
      closingSoon,
      remote,
      viewToApplicationRate: totals.views ? (totals.applications / totals.views) * 100 : 0,
      interestToApplicationRate: totals.interests
        ? (totals.applications / (totals.interests + totals.applications)) * 100
        : totals.applications
          ? 100
          : 0,
      byType: byType.map((row) => ({
        type: row._id,
        count: row.count,
        applications: row.applications,
      })),
      byApplyMode: byApplyMode.map((row) => ({
        mode: row._id,
        count: row.count,
        applications: row.applications,
      })),
      salaryBands: salaryBands.map((row) => ({ band: String(row._id), count: row.count })),
      monthly: monthly.map((row) => ({
        month: row._id,
        postings: row.postings,
        applications: row.applications,
      })),
    };
  },

  /** Auto-expire past-deadline active postings. */
  expireStalePostings: () =>
    JobPostingModel.updateMany(
      { status: JobPostingStatus.ACTIVE, applicationDeadline: { $lt: new Date() } },
      { $set: { status: JobPostingStatus.EXPIRED } },
    ),
};
