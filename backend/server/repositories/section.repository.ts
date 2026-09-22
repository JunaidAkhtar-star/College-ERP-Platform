import type { ISection } from "../models";
import { SectionModel } from "../models";

export const sectionRepository = {
  findById: (id: string) =>
    SectionModel.findById(id)
      .populate("batchId", "name admissionYear status")
      .populate("curriculumId", "program regulationYear totalSemesters")
      .populate("departmentId", "code name")
      .lean(),

  findRawById: (id: string) => SectionModel.findById(id).lean(),

  findRawByIds: (ids: string[]) => SectionModel.find({ _id: { $in: ids } }).lean(),

  findExisting: (academicYear: string, batchId: string, semesterNo: number, sectionName: string) =>
    SectionModel.findOne({ academicYear, batchId, semesterNo, sectionName }).lean(),

  create: (data: Partial<ISection>) => SectionModel.create(data),

  updateById: (id: string, data: Partial<ISection>) =>
    SectionModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SectionModel.find(filter)
        .populate("batchId", "name admissionYear")
        .populate("curriculumId", "program regulationYear")
        .populate("departmentId", "code name")
        .sort({ academicYear: -1, departmentCode: 1, semesterNo: 1, sectionName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SectionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
