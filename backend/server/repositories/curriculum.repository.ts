import type { MongoFilter } from "../types/mongoose.types";
import type { ICurriculum } from "../models/curriculum.model";
import { CurriculumModel } from "../models/curriculum.model";

export const curriculumRepository = {
  findById: (id: string) => CurriculumModel.findById(id).lean(),

  findByProgramYear: (program: string, regulationYear: string) =>
    CurriculumModel.findOne({
      program,
      regulationYear,
    } as unknown as MongoFilter<ICurriculum>).lean(),

  findByIds: (ids: string[]) => CurriculumModel.find({ _id: { $in: ids } }).lean(),

  create: (data: Record<string, unknown>) => CurriculumModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    CurriculumModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CurriculumModel.find(filter)
        .sort({ program: 1, regulationYear: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CurriculumModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
