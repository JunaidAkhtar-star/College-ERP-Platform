import { CourseProgressModel } from "../models";

export const courseProgressRepository = {
  findById: (id: string) =>
    CourseProgressModel.findById(id)
      .populate("lessonPlanId", "unitPlans status totalPlannedClasses")
      .lean(),

  findByLessonPlan: (lessonPlanId: string) => CourseProgressModel.findOne({ lessonPlanId }).lean(),

  addTopicEvidence: (
    id: string,
    facultyId: string,
    attendanceRecordIds: string[],
    topic: Record<string, unknown>,
  ) =>
    CourseProgressModel.findOneAndUpdate(
      {
        _id: id,
        facultyId,
        isComplete: false,
        "topicEntries.attendanceRecordIds": { $nin: attendanceRecordIds },
      },
      {
        $push: { topicEntries: topic },
        $inc: { totalConductedClasses: attendanceRecordIds.length },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  setMetrics: (id: string, completionPercentage: number, isComplete: boolean) =>
    CourseProgressModel.findByIdAndUpdate(
      id,
      {
        $set: {
          completionPercentage,
          isComplete,
          ...(isComplete ? { completedAt: new Date() } : {}),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CourseProgressModel.find(filter)
        .populate("subjectId", "name code")
        .populate("sectionId", "sectionName semesterNo academicYear")
        .populate("facultyId", "name email")
        .sort({ academicYear: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CourseProgressModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
