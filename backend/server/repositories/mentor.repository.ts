import { MentorModel } from "../models";

export const mentorRepository = {
  findById: (id: string) =>
    MentorModel.findById(id)
      .populate("facultyId", "name email phone")
      .populate("departmentId", "name code")
      .populate("menteeIds", "name email studentId")
      .populate("meetings.studentId", "name email studentId")
      .lean(),

  findByFacultyYear: (facultyId: string, academicYear: string) =>
    MentorModel.findOne({ facultyId, academicYear }).lean(),

  create: (data: Record<string, unknown>) => MentorModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    MentorModel.findByIdAndUpdate(id, { $set: data }).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      MentorModel.find(filter)
        .populate("facultyId", "name email")
        .populate("departmentId", "name code")
        .populate("menteeIds", "name email rollNumber")
        .populate("meetings.studentId", "name email studentId")
        .sort({ academicYear: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MentorModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  addMentee: (mentorId: string, studentId: string) =>
    MentorModel.findByIdAndUpdate(mentorId, { $addToSet: { menteeIds: studentId } }, {}).lean(),

  addMeeting: (mentorId: string, meeting: Record<string, unknown>) =>
    MentorModel.findByIdAndUpdate(
      mentorId,
      { $push: { meetings: meeting }, $inc: { totalMeetings: 1 } },
      {},
    ).lean(),

  findMentorForStudent: (studentId: string, academicYear: string) =>
    MentorModel.findOne({
      menteeIds: studentId,
      ...(academicYear ? { academicYear } : {}),
      isActive: true,
    })
      .sort({ academicYear: -1, createdAt: -1 })
      .populate("facultyId", "name email phone")
      .populate("departmentId", "name code")
      .populate("meetings.studentId", "name email studentId")
      .lean(),
};
