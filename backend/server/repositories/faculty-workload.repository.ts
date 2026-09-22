import type { MongoFilter } from "../types/mongoose.types";
import { FacultyWorkloadModel, type IFacultyWorkload } from "../models/faculty-workload.model";

export const facultyWorkloadRepository = {
  findById: (id: string) => FacultyWorkloadModel.findById(id).lean(),

  findOne: (facultyId: string, academicYear: string, semesterType: string) =>
    FacultyWorkloadModel.findOne({
      facultyId,
      academicYear,
      semesterType,
    } as unknown as MongoFilter<IFacultyWorkload>).lean(),

  create: (data: Record<string, unknown>) => FacultyWorkloadModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    FacultyWorkloadModel.findOneAndUpdate(
      { _id: id, isApproved: false },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  approve: (id: string, approverId: string) => {
    return FacultyWorkloadModel.findOneAndUpdate(
      { _id: id, isApproved: false },
      { $set: { isApproved: true, approvedBy: approverId, approvedAt: new Date() } },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      FacultyWorkloadModel.find(filter)
        .populate({
          path: "facultyId",
          select: "name email employeeId firstName lastName",
        })
        .populate("departmentId", "name code")
        .sort({ academicYear: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FacultyWorkloadModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getDepartmentWorkloadSummary: (
    departmentId: string,
    academicYear: string,
    semesterType: string,
  ) =>
    FacultyWorkloadModel.aggregate([
      { $match: { departmentId, academicYear, semesterType } },
      {
        $group: {
          _id: null,
          totalFaculty: { $sum: 1 },
          avgTeachingHours: { $avg: "$totalWeeklyTeachingHours" },
          avgTotalHours: { $avg: "$totalWeeklyHours" },
          maxHours: { $max: "$totalWeeklyHours" },
          minHours: { $min: "$totalWeeklyHours" },
        },
      },
    ]),
};
