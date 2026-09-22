import type { IBatch } from "../models";
import { BatchModel } from "../models";

export const batchRepository = {
  findById: (id: string) =>
    BatchModel.findById(id)
      .populate("curriculumId", "program regulationYear totalSemesters totalCreditsRequired")
      .populate("departmentId", "code name shortName curriculumIds intake status")
      .lean(),

  findActiveById: (id: string) => BatchModel.findById(id).lean(),

  findExisting: (curriculumId: string, departmentId: string, admissionYear: number) =>
    BatchModel.findOne({ curriculumId, departmentId, admissionYear }).lean(),

  create: (data: Partial<IBatch>) => BatchModel.create(data),

  updateById: (id: string, data: Partial<IBatch>) =>
    BatchModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      BatchModel.find(filter)
        .populate("curriculumId", "program regulationYear totalSemesters")
        .populate("departmentId", "code name")
        .sort({ admissionYear: -1, departmentCode: 1, program: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BatchModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
