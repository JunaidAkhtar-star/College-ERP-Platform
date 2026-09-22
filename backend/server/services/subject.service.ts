import { Types } from "mongoose";
import createError from "http-errors";
import { subjectRepository, departmentRepository } from "../repositories";
import type { ISubject } from "../models";
import { CurriculumModel } from "../models/curriculum.model";

async function normalizeSubjectPayload(data: Partial<ISubject>, existing?: Partial<ISubject>) {
  const next = { ...data };
  const departmentId = next.departmentId ?? existing?.departmentId;

  if (!departmentId) return next;

  const departmentIdStr = departmentId.toString();
  if (!Types.ObjectId.isValid(departmentIdStr)) throw createError(400, "Invalid department");

  const dept = await departmentRepository.findById(departmentIdStr);
  if (!dept) throw createError(404, "Department not found");

  next.departmentId = new Types.ObjectId(departmentIdStr);
  next.departmentCode = dept.code;

  const merged = { ...existing, ...next };
  const lectureHours = Number(merged.lectureHours ?? 0);
  const tutorialHours = Number(merged.tutorialHours ?? 0);
  const practicalHours = Number(merged.practicalHours ?? 0);
  const internalMarks = Number(merged.internalMarks ?? 0);
  const externalMarks = Number(merged.externalMarks ?? 0);
  const passMarksInternal = Number(merged.passMarksInternal ?? 0);
  const passMarksExternal = Number(merged.passMarksExternal ?? 0);
  if (
    [lectureHours, tutorialHours, practicalHours, internalMarks, externalMarks].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    throw createError(400, "Subject hours and marks must be non-negative");
  if (passMarksInternal < 0 || passMarksInternal > internalMarks)
    throw createError(400, "Internal pass marks cannot exceed internal maximum marks");
  if (passMarksExternal < 0 || passMarksExternal > externalMarks)
    throw createError(400, "External pass marks cannot exceed external maximum marks");
  next.totalHours = lectureHours + tutorialHours + practicalHours;
  next.totalMarks = internalMarks + externalMarks;

  return next;
}

export const subjectService = {
  create: async (data: Partial<ISubject>, createdBy: string) => {
    const code = data.code?.trim();
    if (!code) throw createError(400, "Subject code is required");
    const existing = await subjectRepository.findByCode(code);
    if (existing) throw createError(409, `Subject with code ${data.code} already exists`);

    const normalized = await normalizeSubjectPayload(data);
    return subjectRepository.create({ ...normalized, createdBy: new Types.ObjectId(createdBy) });
  },

  getAll: (query: Record<string, unknown>, page = 1, limit = 20) =>
    subjectRepository.paginate(query, page, limit),

  getById: async (id: string) => {
    const sub = await subjectRepository.findById(id);
    if (!sub) throw createError(404, "Subject not found");
    return sub;
  },

  getByProgramSemester: (program: string, semester: number) =>
    subjectRepository.findByProgramSemester(program, semester),

  update: async (id: string, data: Partial<ISubject>, updatedBy: string) => {
    const existing = await subjectRepository.findById(id);
    if (!existing) throw createError(404, "Subject not found");
    const immutableFields = [
      "code",
      "departmentId",
      "credits",
      "lectureHours",
      "tutorialHours",
      "practicalHours",
      "internalMarks",
      "externalMarks",
      "passMarksInternal",
      "passMarksExternal",
    ];
    const sameProtectedValue = (field: string, incoming: unknown, current: unknown) => {
      if (field === "departmentId") return String(incoming) === String(current);
      if (field === "code")
        return String(incoming).trim().toUpperCase() === String(current).trim().toUpperCase();
      if (
        [
          "credits",
          "lectureHours",
          "tutorialHours",
          "practicalHours",
          "internalMarks",
          "externalMarks",
          "passMarksInternal",
          "passMarksExternal",
        ].includes(field)
      )
        return Number(incoming) === Number(current);
      return incoming === current;
    };
    const protectedFieldChanged = immutableFields.some(
      (field) =>
        field in data &&
        !sameProtectedValue(
          field,
          (data as unknown as Record<string, unknown>)[field],
          (existing as unknown as Record<string, unknown>)[field],
        ),
    );
    if (
      protectedFieldChanged &&
      (await CurriculumModel.exists({ "semesterPlans.subjects.subjectId": id }))
    )
      throw createError(409, "Core subject fields are immutable after curriculum assignment");
    const normalized = await normalizeSubjectPayload(data, existing);
    const updated = await subjectRepository.updateById(id, {
      ...normalized,
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Subject not found");
    return updated;
  },

  deactivate: async (id: string, updatedBy: string) => {
    if (await CurriculumModel.exists({ "semesterPlans.subjects.subjectId": id, isActive: true }))
      throw createError(409, "Subject cannot be deactivated while used by an active curriculum");
    const updated = await subjectRepository.updateById(id, {
      isActive: false,
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Subject not found");
    return updated;
  },

  activate: async (id: string, updatedBy: string) => {
    const existing = await subjectRepository.findById(id);
    if (!existing) throw createError(404, "Subject not found");
    const updated = await subjectRepository.updateById(id, {
      isActive: true,
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Subject not found");
    return updated;
  },
};
