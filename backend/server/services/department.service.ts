import createError from "http-errors";
import { Types } from "mongoose";
import { curriculumRepository, departmentRepository } from "../repositories";
import type { IDepartment } from "../models";
import { BatchStatus, DepartmentStatus, SectionStatus, StudentStatus } from "../models";
import { BatchModel } from "../models/batch.model";
import { SectionModel } from "../models/section.model";
import { StudentProfileModel } from "../models/student-profile.model";

async function normalizeDepartmentPayload(data: Partial<IDepartment>) {
  const next = { ...data };
  const curriculumIds = (next.curriculumIds ?? []) as unknown[];

  if ("curriculumIds" in next && curriculumIds.length === 0) {
    throw createError(400, "Select at least one curriculum offered by this department");
  }

  if (curriculumIds.length > 0) {
    const ids = curriculumIds.map(String);
    const invalid = ids.find((id) => !Types.ObjectId.isValid(id));
    if (invalid) throw createError(400, "Invalid curriculum");

    const curricula = await curriculumRepository.findByIds(ids);
    if (curricula.length !== ids.length) throw createError(404, "Curriculum not found");

    next.curriculumIds = ids.map((id) => new Types.ObjectId(id)) as unknown as Types.ObjectId[];
    next.programs = [...new Set(curricula.map((c) => c.program).filter(Boolean))];
  }

  return next;
}

export const departmentService = {
  create: async (data: Partial<IDepartment>, createdBy: string) => {
    const existing = await departmentRepository.findByCode(data.code!);
    if (existing) throw createError(409, `Department with code ${data.code} already exists`);
    if (!data.curriculumIds?.length) {
      throw createError(400, "Select at least one curriculum offered by this department");
    }
    const normalized = await normalizeDepartmentPayload(data);
    return departmentRepository.create({
      ...normalized,
      status: DepartmentStatus.ACTIVE,
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  getAll: (activeOnly = true) => departmentRepository.findAll(activeOnly),

  getById: async (id: string) => {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw createError(404, "Department not found");
    return dept;
  },

  getByCode: async (code: string) => {
    const dept = await departmentRepository.findByCode(code);
    if (!dept) throw createError(404, "Department not found");
    return dept;
  },

  update: async (id: string, data: Partial<IDepartment>, updatedBy: string) => {
    const updated = await departmentRepository.updateById(id, {
      ...(await normalizeDepartmentPayload(data)),
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Department not found");
    return updated;
  },

  deactivate: async (id: string, updatedBy: string) => {
    const [batches, sections, students] = await Promise.all([
      BatchModel.exists({ departmentId: id, status: BatchStatus.ACTIVE }),
      SectionModel.exists({
        departmentId: id,
        status: { $in: [SectionStatus.PLANNED, SectionStatus.ACTIVE, SectionStatus.LOCKED] },
      }),
      StudentProfileModel.exists({
        department: id,
        status: { $in: [StudentStatus.ACTIVE, StudentStatus.DETAINED] },
      }),
    ]);
    if (batches || sections || students)
      throw createError(
        409,
        "Department cannot be deactivated while active academic records depend on it",
      );
    const updated = await departmentRepository.updateById(id, {
      status: DepartmentStatus.INACTIVE,
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Department not found");
    return updated;
  },
};
