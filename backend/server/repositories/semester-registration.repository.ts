import {
  SemesterRegistrationModel,
  SemesterRegistrationWindowModel,
  RegistrationStatus,
} from "../models/semester-registration.model";

export const semesterRegistrationRepository = {
  // ─── Write ────────────────────────────────────────────────────────────────

  upsert: async (
    studentId: string,
    targetSemester: number,
    academicYear: string,
    data: Record<string, unknown>,
  ) => {
    return SemesterRegistrationModel.findOneAndUpdate(
      {
        studentId,
        targetSemester,
        academicYear,
        status: {
          $in: [
            RegistrationStatus.DRAFT,
            RegistrationStatus.REJECTED,
            RegistrationStatus.APPROVED,
            RegistrationStatus.WITHDRAWN,
          ],
        },
      },
      { $set: data },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  },

  // ─── Read ─────────────────────────────────────────────────────────────────

  findByStudent: (studentId: string) =>
    SemesterRegistrationModel.find({ studentId })
      .sort({ academicYear: -1, targetSemester: -1 })
      .lean(),

  findByStudentSemester: (studentId: string, targetSemester: number, academicYear: string) =>
    SemesterRegistrationModel.findOne({ studentId, targetSemester, academicYear }).lean(),

  findById: (id: string) => SemesterRegistrationModel.findById(id).lean(),

  withdraw: (id: string, studentId: string) =>
    SemesterRegistrationModel.findOneAndUpdate(
      {
        _id: id,
        studentId,
        status: {
          $in: [
            RegistrationStatus.DRAFT,
            RegistrationStatus.SUBMITTED,
            RegistrationStatus.REJECTED,
          ],
        },
      },
      { $set: { status: RegistrationStatus.WITHDRAWN }, $unset: { submittedAt: 1 } },
      { returnDocument: "after" },
    ).lean(),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 30) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SemesterRegistrationModel.find(filter)
        .populate("studentId", "name email")
        .populate("batchId", "name admissionYear")
        .populate("sectionId", "sectionName semesterNo academicYear")
        .populate("curriculumId", "program regulationYear")
        .populate("reviewedBy", "name")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SemesterRegistrationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // ─── Status transitions ───────────────────────────────────────────────────

  updateStatus: (
    id: string,
    from: RegistrationStatus[],
    status: RegistrationStatus,
    extra: Record<string, unknown> = {},
  ) =>
    SemesterRegistrationModel.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { status, ...extra } },
      { runValidators: true, returnDocument: "after" },
    ).lean(),

  // Bulk approve all submitted registrations for a dept/semester
  bulkApprove: (
    departmentId: string,
    targetSemester: number,
    academicYear: string,
    reviewedById: string,
    reviewedByName: string,
  ) =>
    SemesterRegistrationModel.updateMany(
      { departmentId, targetSemester, academicYear, status: RegistrationStatus.SUBMITTED },
      {
        $set: {
          status: RegistrationStatus.APPROVED,
          reviewedBy: reviewedById,
          reviewedByName,
          reviewedAt: new Date(),
        },
      },
    ),

  // Freeze all approved registrations (called at end of add/drop period)
  freezeApproved: (departmentId: string, targetSemester: number, academicYear: string) =>
    SemesterRegistrationModel.updateMany(
      { departmentId, targetSemester, academicYear, status: RegistrationStatus.APPROVED },
      { $set: { status: RegistrationStatus.FROZEN, frozenAt: new Date() } },
    ),

  // Count by status for HOD dashboard
  countByStatus: (filter: Record<string, unknown>) =>
    SemesterRegistrationModel.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

  findWindow: (departmentId: string, targetSemester: number, academicYear: string) =>
    SemesterRegistrationWindowModel.findOne({
      departmentId,
      targetSemester,
      academicYear,
      isActive: true,
    }).lean(),

  upsertWindow: (
    departmentId: string,
    targetSemester: number,
    academicYear: string,
    data: Record<string, unknown>,
  ) =>
    SemesterRegistrationWindowModel.findOneAndUpdate(
      { departmentId, targetSemester, academicYear },
      { $set: data },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).lean(),

  listWindows: (filter: Record<string, unknown>) =>
    SemesterRegistrationWindowModel.find(filter)
      .populate("departmentId", "name code")
      .sort({ academicYear: -1, targetSemester: 1 })
      .lean(),
};
