import { CourseProgressModel, LessonPlanModel } from "../models";

export const lessonPlanRepository = {
  findById: (id: string) => LessonPlanModel.findById(id).lean(),

  findOne: (filter: Record<string, unknown>) => LessonPlanModel.findOne(filter).lean(),

  create: (data: Record<string, unknown>) => LessonPlanModel.create(data),

  updateEditable: (id: string, data: Record<string, unknown>, facultyId?: string) =>
    LessonPlanModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["draft", "rejected"] },
        ...(facultyId ? { facultyId } : {}),
      },
      {
        $set: data,
        $unset: { rejectionReason: 1, approvedBy: 1, approvedAt: 1 },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      LessonPlanModel.find(filter)
        .populate("subjectId", "name code")
        .populate("sectionId", "sectionName semesterNo academicYear")
        .populate("facultyId", "name email")
        .sort({ academicYear: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LessonPlanModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  submit: (id: string, facultyId: string, now: Date) =>
    LessonPlanModel.findOneAndUpdate(
      { _id: id, facultyId, status: { $in: ["draft", "rejected"] } },
      {
        $set: { status: "submitted", submittedAt: now },
        $unset: { rejectionReason: 1, approvedBy: 1, approvedAt: 1 },
        $push: { reviewHistory: { action: "submitted", actorId: facultyId, at: now } },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  approve: async (id: string, approvedBy: string, now: Date) => {
    const session = await LessonPlanModel.db.startSession();
    try {
      let approved;
      await session.withTransaction(async () => {
        approved = await LessonPlanModel.findOneAndUpdate(
          { _id: id, status: "submitted", facultyId: { $ne: approvedBy } },
          {
            $set: { status: "approved", approvedBy, approvedAt: now },
            $push: { reviewHistory: { action: "approved", actorId: approvedBy, at: now } },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!approved) return;
        await CourseProgressModel.create(
          [
            {
              lessonPlanId: approved._id,
              sectionId: approved.sectionId,
              curriculumId: approved.curriculumId,
              academicYear: approved.academicYear,
              semesterType: approved.semesterType,
              subjectId: approved.subjectId,
              subjectCode: approved.subjectCode,
              subjectName: approved.subjectName,
              facultyId: approved.facultyId,
              departmentId: approved.departmentId,
              program: approved.program,
              semester: approved.semester,
              section: approved.section,
              totalPlanedClasses: approved.totalPlannedClasses,
              totalConductedClasses: 0,
              completionPercentage: 0,
              topicEntries: [],
              isComplete: false,
            },
          ],
          { session },
        );
      });
      return approved as Awaited<ReturnType<typeof LessonPlanModel.findById>> | null;
    } finally {
      await session.endSession();
    }
  },

  reject: (id: string, rejectedBy: string, now: Date, remark: string) =>
    LessonPlanModel.findOneAndUpdate(
      { _id: id, status: "submitted", facultyId: { $ne: rejectedBy } },
      {
        $set: { status: "rejected", rejectionReason: remark },
        $unset: { approvedBy: 1, approvedAt: 1 },
        $push: {
          reviewHistory: { action: "rejected", actorId: rejectedBy, at: now, remark },
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),
};
