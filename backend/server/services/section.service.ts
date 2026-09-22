import createError from "http-errors";
import { Types } from "mongoose";
import { batchRepository, sectionRepository } from "../repositories";
import {
  SectionStatus,
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
  type ISection,
} from "../models";

const ACADEMIC_YEAR_RE = /^\d{4}-\d{2}$/;

async function normalizeSectionPayload(data: Partial<ISection>) {
  const batchId = data.batchId?.toString();
  if (!batchId || !Types.ObjectId.isValid(batchId))
    throw createError(400, "Valid batch is required");

  const batch = await batchRepository.findActiveById(batchId);
  if (!batch) throw createError(404, "Batch not found");

  const semesterNo = Number(data.semesterNo);
  if (!semesterNo) throw createError(400, "Semester is required");

  const curriculum = await import("../models").then(({ CurriculumModel }) =>
    CurriculumModel.findById(batch.curriculumId).lean(),
  );
  if (!curriculum) throw createError(404, "Curriculum not found for batch");
  if (semesterNo < 1 || semesterNo > curriculum.totalSemesters) {
    throw createError(400, `${batch.program} has only ${curriculum.totalSemesters} semesters`);
  }
  const academicYear = String(data.academicYear ?? "").trim();
  if (!ACADEMIC_YEAR_RE.test(academicYear))
    throw createError(400, "Academic year must use YYYY-YY format");

  return {
    ...data,
    batchId: new Types.ObjectId(batchId),
    curriculumId: batch.curriculumId,
    departmentId: batch.departmentId,
    program: batch.program,
    departmentCode: batch.departmentCode,
    semesterNo,
    academicYear,
    sectionName: String(data.sectionName ?? "A")
      .trim()
      .toUpperCase(),
    capacity: Number(data.capacity) || 60,
  };
}

export const sectionService = {
  list: (filter: Record<string, unknown>, page: number, limit: number) =>
    sectionRepository.list(filter, page, limit),

  getById: async (id: string) => {
    const section = await sectionRepository.findById(id);
    if (!section) throw createError(404, "Section not found");
    return section;
  },

  create: async (data: Partial<ISection>, createdBy: string, scopedDepartmentId?: string) => {
    const normalized = await normalizeSectionPayload(data);
    if (scopedDepartmentId && normalized.departmentId.toString() !== scopedDepartmentId) {
      throw createError(403, "You can manage only your department sections");
    }
    const existing = await sectionRepository.findExisting(
      String(normalized.academicYear),
      normalized.batchId.toString(),
      normalized.semesterNo,
      normalized.sectionName,
    );
    if (existing) throw createError(409, "Section already exists for this batch/semester/year");
    return sectionRepository.create({
      ...normalized,
      status: SectionStatus.PLANNED,
      allottedCount: 0,
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  update: async (
    id: string,
    data: Partial<ISection>,
    updatedBy: string,
    scopedDepartmentId?: string,
  ) => {
    const current = await sectionRepository.findRawById(id);
    if (!current) throw createError(404, "Section not found");
    if (scopedDepartmentId && current.departmentId.toString() !== scopedDepartmentId) {
      throw createError(403, "You can manage only your department sections");
    }
    if (current.status === SectionStatus.LOCKED) {
      throw createError(400, "Locked section cannot be edited");
    }
    const allowed: Partial<ISection> = {};
    for (const field of [
      "academicYear",
      "batchId",
      "semesterNo",
      "sectionName",
      "capacity",
      "classTeacherId",
      "classTeacherName",
    ] as const)
      if (data[field] !== undefined) allowed[field] = data[field] as never;
    if (allowed.capacity !== undefined && Number(allowed.capacity) < (current.allottedCount ?? 0))
      throw createError(409, "Section capacity cannot be below its active allotment count");
    const cohortChanged = Boolean(
      allowed.academicYear || allowed.batchId || allowed.semesterNo || allowed.sectionName,
    );
    if (
      cohortChanged &&
      (await StudentSectionAllotmentModel.exists({
        sectionId: id,
        status: StudentSectionAllotmentStatus.ACTIVE,
      }))
    )
      throw createError(409, "Section cohort fields cannot change after student allotment");
    const normalized =
      allowed.batchId || allowed.semesterNo || allowed.sectionName || allowed.academicYear
        ? await normalizeSectionPayload({ ...current, ...allowed })
        : allowed;
    if (
      scopedDepartmentId &&
      normalized.departmentId &&
      normalized.departmentId.toString() !== scopedDepartmentId
    ) {
      throw createError(403, "You can manage only your department sections");
    }
    const updated = await sectionRepository.updateById(id, {
      ...normalized,
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Section not found");
    return updated;
  },

  approve: async (id: string, approvedBy: string, scopedDepartmentId?: string) => {
    const current = await sectionRepository.findRawById(id);
    if (!current) throw createError(404, "Section not found");
    if (scopedDepartmentId && current.departmentId.toString() !== scopedDepartmentId) {
      throw createError(403, "You can approve only your department sections");
    }
    if (current.status !== SectionStatus.PLANNED) {
      throw createError(409, "Only a planned section can be approved");
    }
    const updated = await sectionRepository.updateById(id, {
      status: SectionStatus.ACTIVE,
      updatedBy: new Types.ObjectId(approvedBy),
    });
    if (!updated) throw createError(404, "Section not found");
    return updated;
  },
};
