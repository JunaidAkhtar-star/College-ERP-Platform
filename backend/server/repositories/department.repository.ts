import type { IDepartment } from "../models";
import { DepartmentModel, DepartmentStatus } from "../models";

export const departmentRepository = {
  findAll: (activeOnly = true) =>
    DepartmentModel.find(activeOnly ? { status: DepartmentStatus.ACTIVE } : {})
      .populate("curriculumIds", "program regulationYear totalSemesters isActive")
      .sort({ code: 1 })
      .lean(),

  findById: (id: string) =>
    DepartmentModel.findById(id)
      .populate("curriculumIds", "program regulationYear totalSemesters isActive")
      .lean(),

  findByCode: (code: string) => DepartmentModel.findOne({ code: code.toUpperCase() }).lean(),

  create: (data: Partial<IDepartment>) => DepartmentModel.create(data),

  updateById: (id: string, data: Partial<IDepartment>) =>
    DepartmentModel.findByIdAndUpdate(id, { $set: data }, { runValidators: true }).lean(),

  deleteById: (id: string) => DepartmentModel.findByIdAndDelete(id),
};
