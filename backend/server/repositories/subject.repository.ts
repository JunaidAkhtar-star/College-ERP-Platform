import type { ISubject } from "../models";
import { SubjectModel } from "../models";

export const subjectRepository = {
  findById: (id: string) => SubjectModel.findById(id).lean(),

  findByIds: (ids: string[]) => SubjectModel.find({ _id: { $in: ids } }).lean(),

  findByCode: (code: string) => SubjectModel.findOne({ code: code.toUpperCase() }).lean(),

  findByDeptSemester: (departmentId: string, semester: number) =>
    SubjectModel.find({ departmentId, semester, isActive: true }).sort({ code: 1 }).lean(),

  findByProgramSemester: (program: string, semester: number) =>
    SubjectModel.find({ program, semester, isActive: true }).sort({ code: 1 }).lean(),

  paginate: async (query: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.semester) filter.semester = Number(query.semester);
    if (query.program) filter.program = query.program;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    const [data, total] = await Promise.all([
      SubjectModel.find(filter).sort({ createdAt: -1, code: 1 }).skip(skip).limit(limit).lean(),
      SubjectModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  create: (data: Partial<ISubject>) => SubjectModel.create(data),

  updateById: (id: string, data: Partial<ISubject>) =>
    SubjectModel.findByIdAndUpdate(id, { $set: data }, { runValidators: true }).lean(),
};
