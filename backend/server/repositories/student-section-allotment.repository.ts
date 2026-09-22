import type { IStudentSectionAllotment } from "../models";
import { StudentSectionAllotmentModel, StudentSectionAllotmentStatus } from "../models";

export const studentSectionAllotmentRepository = {
  findCurrentActiveForStudent: (studentId: string) =>
    StudentSectionAllotmentModel.findOne({
      studentId,
      status: StudentSectionAllotmentStatus.ACTIVE,
    })
      .sort({ academicYear: -1, semesterNo: -1, updatedAt: -1 })
      .lean(),

  findById: (id: string) =>
    StudentSectionAllotmentModel.findById(id)
      .populate("studentId", "name email")
      .populate("studentProfileId", "rollNumber firstName lastName")
      .populate("sectionId", "sectionName semesterNo academicYear")
      .populate("batchId", "name admissionYear")
      .lean(),

  findActiveForStudentSemester: (studentId: string, academicYear: string, semesterNo: number) =>
    StudentSectionAllotmentModel.findOne({
      studentId,
      academicYear,
      semesterNo,
      status: StudentSectionAllotmentStatus.ACTIVE,
    }).lean(),

  countActiveInSection: (sectionId: string) =>
    StudentSectionAllotmentModel.countDocuments({
      sectionId,
      status: StudentSectionAllotmentStatus.ACTIVE,
    }),

  findActiveBySection: (sectionId: string) =>
    StudentSectionAllotmentModel.find({
      sectionId,
      status: StudentSectionAllotmentStatus.ACTIVE,
    })
      .sort({ rollNo: 1 })
      .lean(),

  create: (data: Partial<IStudentSectionAllotment>) => StudentSectionAllotmentModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    StudentSectionAllotmentModel.findByIdAndUpdate(
      id,
      data["$set"] || data["$push"] ? data : { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      StudentSectionAllotmentModel.find(filter)
        .populate("studentId", "name email")
        .populate("studentProfileId", "rollNumber firstName lastName")
        .populate("sectionId", "sectionName semesterNo academicYear")
        .populate("batchId", "name admissionYear")
        .sort({ academicYear: -1, semesterNo: 1, rollNo: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentSectionAllotmentModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
