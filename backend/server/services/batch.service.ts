import createError from "http-errors";
import { Types } from "mongoose";
import { batchRepository, curriculumRepository, departmentRepository } from "../repositories";
import {
  BatchStatus,
  SectionModel,
  SectionStatus,
  StudentProfileModel,
  StudentStatus,
  type IBatch,
} from "../models";

const statusTransitions: Record<BatchStatus, BatchStatus[]> = {
  [BatchStatus.PLANNED]: [BatchStatus.ACTIVE],
  [BatchStatus.ACTIVE]: [BatchStatus.PASSED_OUT],
  [BatchStatus.PASSED_OUT]: [BatchStatus.ARCHIVED],
  [BatchStatus.ARCHIVED]: [],
};

const formatAcademicYear = (startYear: number) => `${startYear}-${String(startYear + 1).slice(-2)}`;

export function assertBatchStatusTransition(current: BatchStatus, next: BatchStatus) {
  if (current === next) return;
  if (!statusTransitions[current]?.includes(next)) {
    throw createError(409, `Batch status cannot change from ${current} to ${next}`);
  }
}

export function curriculumReferenceId(curriculumRef: unknown): string {
  if (curriculumRef && typeof curriculumRef === "object" && "_id" in curriculumRef) {
    return String((curriculumRef as { _id: unknown })._id);
  }
  return String(curriculumRef);
}

async function normalizeBatchPayload(data: Partial<IBatch>) {
  const curriculumId = data.curriculumId?.toString();
  const departmentId = data.departmentId?.toString();
  if (!curriculumId || !Types.ObjectId.isValid(curriculumId))
    throw createError(400, "Valid curriculum is required");
  if (!departmentId || !Types.ObjectId.isValid(departmentId))
    throw createError(400, "Valid department is required");

  const [curriculum, department] = await Promise.all([
    curriculumRepository.findById(curriculumId),
    departmentRepository.findById(departmentId),
  ]);
  if (!curriculum) throw createError(404, "Curriculum not found");
  if (!department) throw createError(404, "Department not found");

  const deptCurricula = (department.curriculumIds ?? []).map(curriculumReferenceId);
  if (!deptCurricula.includes(curriculumId)) {
    throw createError(400, "Selected curriculum is not offered by this department");
  }

  const admissionYear = Number(data.admissionYear);
  if (!admissionYear) throw createError(400, "Admission year is required");

  const durationYears = Math.ceil(curriculum.totalSemesters / 2);
  const expectedGraduationYear =
    Number(data.expectedGraduationYear) || admissionYear + durationYears;

  return {
    ...data,
    curriculumId: new Types.ObjectId(curriculumId),
    departmentId: new Types.ObjectId(departmentId),
    program: curriculum.program,
    departmentCode: department.code,
    regulationYear: curriculum.regulationYear,
    admissionYear,
    expectedGraduationYear,
    name:
      data.name || `${curriculum.program} ${department.code} ${formatAcademicYear(admissionYear)}`,
    intake: Number(data.intake) || department.intake || 60,
  };
}

export const batchService = {
  list: (filter: Record<string, unknown>, page: number, limit: number) =>
    batchRepository.list(filter, page, limit),

  getById: async (id: string) => {
    const batch = await batchRepository.findById(id);
    if (!batch) throw createError(404, "Batch not found");
    return batch;
  },

  create: async (data: Partial<IBatch>, createdBy: string, scopedDepartmentId?: string) => {
    const normalized = await normalizeBatchPayload(data);
    if (scopedDepartmentId && normalized.departmentId.toString() !== scopedDepartmentId) {
      throw createError(403, "You can manage only your department batches");
    }
    const existing = await batchRepository.findExisting(
      normalized.curriculumId.toString(),
      normalized.departmentId.toString(),
      normalized.admissionYear,
    );
    if (existing)
      throw createError(409, "Batch already exists for this department/curriculum/year");
    return batchRepository.create({
      ...normalized,
      status: BatchStatus.PLANNED,
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  update: async (
    id: string,
    data: Partial<IBatch>,
    updatedBy: string,
    scopedDepartmentId?: string,
  ) => {
    const current = await batchRepository.findActiveById(id);
    if (!current) throw createError(404, "Batch not found");
    if (scopedDepartmentId && current.departmentId.toString() !== scopedDepartmentId) {
      throw createError(403, "You can manage only your department batches");
    }
    const coreChanged =
      (data.curriculumId && data.curriculumId.toString() !== current.curriculumId.toString()) ||
      (data.departmentId && data.departmentId.toString() !== current.departmentId.toString()) ||
      (data.admissionYear !== undefined && Number(data.admissionYear) !== current.admissionYear);
    const sectionCount = await SectionModel.countDocuments({ batchId: id });
    if (coreChanged && sectionCount > 0) {
      throw createError(
        409,
        "Batch curriculum, department, and admission year are immutable after sections exist",
      );
    }

    if (data.status) {
      assertBatchStatusTransition(current.status, data.status);
      if (data.status === BatchStatus.PASSED_OUT) {
        const activeSections = await SectionModel.countDocuments({
          batchId: id,
          status: { $ne: SectionStatus.ARCHIVED },
        });
        if (activeSections > 0)
          throw createError(409, "Archive all batch sections before passing out the batch");
      }
    }

    if (data.intake !== undefined) {
      const enrolledCount = await StudentProfileModel.countDocuments({
        department: current.departmentId,
        program: current.program,
        batch: String(current.admissionYear),
        status: {
          $nin: [StudentStatus.DROPPED, StudentStatus.TRANSFERRED, StudentStatus.RUSTICATED],
        },
      });
      if (Number(data.intake) < enrolledCount) {
        throw createError(409, `Intake cannot be below ${enrolledCount} enrolled students`);
      }
    }
    const normalized =
      data.curriculumId || data.departmentId || data.admissionYear
        ? await normalizeBatchPayload({ ...current, ...data })
        : data;
    if (
      scopedDepartmentId &&
      normalized.departmentId &&
      normalized.departmentId.toString() !== scopedDepartmentId
    ) {
      throw createError(403, "You can manage only your department batches");
    }
    const allowed = {
      name: normalized.name,
      curriculumId: normalized.curriculumId,
      departmentId: normalized.departmentId,
      program: normalized.program,
      departmentCode: normalized.departmentCode,
      regulationYear: normalized.regulationYear,
      admissionYear: normalized.admissionYear,
      expectedGraduationYear: normalized.expectedGraduationYear,
      lateralEntryAllowed: normalized.lateralEntryAllowed,
      intake: normalized.intake,
      status: normalized.status,
    };
    const updated = await batchRepository.updateById(id, {
      ...Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined)),
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Batch not found");
    return updated;
  },
};
