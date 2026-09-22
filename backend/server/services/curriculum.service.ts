import createError from "http-errors";
import { Types } from "mongoose";
import { curriculumRepository, subjectRepository } from "../repositories";
import type { ISemesterPlan } from "../models";
import { BatchModel } from "../models/batch.model";

export function normalizeCurriculumPayload(data: Record<string, unknown>) {
  const program = String(data.program ?? "").trim();
  const regulationYear = String(data.regulationYear ?? "").trim();
  const totalSemesters = Number(data.totalSemesters);
  const totalCreditsRequired = Number(data.totalCreditsRequired);
  const academicLevel = String(data.academicLevel ?? "").trim();
  if (!program) throw createError(400, "Program is required");
  if (!/^\d{4}$/.test(regulationYear))
    throw createError(400, "Regulation year must contain four digits");
  if (!Number.isInteger(totalSemesters) || totalSemesters < 1 || totalSemesters > 12)
    throw createError(400, "Total semesters must be between 1 and 12");
  if (!Number.isFinite(totalCreditsRequired) || totalCreditsRequired <= 0)
    throw createError(400, "Required credits must be positive");
  if (
    !["certificate", "diploma", "undergraduate", "postgraduate", "doctoral"].includes(academicLevel)
  )
    throw createError(400, "Select a valid academic level");
  const inputPlans = Array.isArray(data.semesterPlans)
    ? (data.semesterPlans as Array<Record<string, unknown>>)
    : [];
  const planNumbers = inputPlans.map((plan) => Number(plan.semesterNo));
  if (new Set(planNumbers).size !== planNumbers.length)
    throw createError(400, "Semester plans must be unique");
  const seenSubjects = new Set<string>();
  const semesterPlans = Array.from({ length: totalSemesters }, (_, index) => {
    const semesterNo = index + 1;
    const source = inputPlans.find((plan) => Number(plan.semesterNo) === semesterNo);
    const subjects = Array.isArray(source?.subjects)
      ? (source.subjects as Array<Record<string, unknown>>).map((subject) => {
          const subjectId = String(subject.subjectId ?? "");
          if (!Types.ObjectId.isValid(subjectId))
            throw createError(400, "Semester subject ID is invalid");
          if (seenSubjects.has(subjectId))
            throw createError(400, "A subject cannot appear in multiple semester plans");
          seenSubjects.add(subjectId);
          return {
            ...subject,
            subjectId: new Types.ObjectId(subjectId),
            credits: Math.max(0, Number(subject.credits ?? 0)),
            theoryHours: Math.max(0, Number(subject.theoryHours ?? 0)),
            labHours: Math.max(0, Number(subject.labHours ?? 0)),
            tutorialHours: Math.max(0, Number(subject.tutorialHours ?? 0)),
          };
        })
      : [];
    return {
      semesterNo,
      subjects,
      totalCredits: subjects.reduce((sum, subject) => sum + subject.credits, 0),
      totalTheoryHours: subjects.reduce((sum, subject) => sum + subject.theoryHours, 0),
      totalLabHours: subjects.reduce((sum, subject) => sum + subject.labHours, 0),
    };
  });
  return {
    program,
    academicLevel,
    openForAdmissions: data.openForAdmissions !== false,
    regulationYear,
    totalSemesters,
    totalCreditsRequired,
    semesterPlans,
    programOutcomes: Array.isArray(data.programOutcomes) ? data.programOutcomes : [],
    isActive: data.isActive !== false,
    version: Math.max(1, Number(data.version ?? 1)),
  };
}

export const curriculumService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    curriculumRepository.list(filter, page, limit),

  getById: (id: string) => curriculumRepository.findById(id),

  getByProgramYear: (program: string, regulationYear: string) =>
    curriculumRepository.findByProgramYear(program, regulationYear),

  create: async (data: Record<string, unknown>, createdBy: string) => {
    const normalized = normalizeCurriculumPayload(data);
    if (await curriculumRepository.findByProgramYear(normalized.program, normalized.regulationYear))
      throw createError(409, "Curriculum already exists for this program and regulation year");
    return curriculumRepository.create({ ...normalized, createdBy: new Types.ObjectId(createdBy) });
  },

  update: async (id: string, data: Record<string, unknown>, updatedBy: string) => {
    const current = await curriculumRepository.findById(id);
    if (!current) throw createError(404, "Curriculum not found");
    const structuralFields = [
      "program",
      "regulationYear",
      "totalSemesters",
      "totalCreditsRequired",
      "semesterPlans",
      "programOutcomes",
      "version",
    ];
    const changesStructure = structuralFields.some(
      (field) =>
        data[field] !== undefined &&
        JSON.stringify(data[field]) !==
          JSON.stringify((current as unknown as Record<string, unknown>)[field]),
    );
    if (changesStructure && (await BatchModel.exists({ curriculumId: id })))
      throw createError(
        409,
        "Programme structure is immutable after a batch begins; admission availability and academic level can still be updated",
      );
    return curriculumRepository.updateById(id, {
      ...normalizeCurriculumPayload({ ...current, ...data }),
      updatedBy: new Types.ObjectId(updatedBy),
    });
  },

  addSubjectToSemester: async (id: string, semesterNo: number, subjectId: string) => {
    if (!Types.ObjectId.isValid(subjectId)) throw createError(400, "Invalid subject");

    const [curriculum, subject] = await Promise.all([
      curriculumRepository.findById(id),
      subjectRepository.findById(subjectId),
    ]);
    if (!curriculum) throw createError(404, "Curriculum not found");
    if (!subject) throw createError(404, "Subject not found");
    if (semesterNo < 1 || semesterNo > curriculum.totalSemesters) {
      throw createError(
        400,
        `${curriculum.program} has only ${curriculum.totalSemesters} semesters`,
      );
    }

    const plans: ISemesterPlan[] = Array.from(
      { length: curriculum.totalSemesters },
      (_, i) =>
        curriculum.semesterPlans?.find((p) => p.semesterNo === i + 1) ?? {
          semesterNo: i + 1,
          subjects: [],
          totalCredits: 0,
          totalTheoryHours: 0,
          totalLabHours: 0,
        },
    );

    const plan = plans.find((p) => p.semesterNo === semesterNo);
    if (!plan) throw createError(400, "Semester plan is invalid");
    if (plan.subjects.some((s) => s.subjectId.toString() === subjectId)) {
      throw createError(409, "Subject already assigned to this semester");
    }

    plan.subjects.push({
      subjectId: subject._id,
      subjectCode: subject.code,
      subjectName: subject.name,
      credits: subject.credits,
      theoryHours: subject.lectureHours,
      labHours: subject.practicalHours,
      tutorialHours: subject.tutorialHours,
      isElective: subject.isElective,
      courseOutcomes: [],
    });
    plan.totalCredits = plan.subjects.reduce((sum, s) => sum + s.credits, 0);
    plan.totalTheoryHours = plan.subjects.reduce((sum, s) => sum + s.theoryHours, 0);
    plan.totalLabHours = plan.subjects.reduce((sum, s) => sum + s.labHours, 0);

    return curriculumRepository.updateById(id, { semesterPlans: plans });
  },

  removeSubjectFromSemester: async (id: string, semesterNo: number, subjectId: string) => {
    const curriculum = await curriculumRepository.findById(id);
    if (!curriculum) throw createError(404, "Curriculum not found");
    if (await BatchModel.exists({ curriculumId: id }))
      throw createError(409, "Curriculum subjects are immutable after a batch begins");

    const plans: ISemesterPlan[] = curriculum.semesterPlans ?? [];
    const plan = plans.find((p) => p.semesterNo === semesterNo);
    if (!plan) throw createError(404, "Semester plan not found");

    plan.subjects = plan.subjects.filter((s) => s.subjectId.toString() !== subjectId);
    plan.totalCredits = plan.subjects.reduce((sum, s) => sum + s.credits, 0);
    plan.totalTheoryHours = plan.subjects.reduce((sum, s) => sum + s.theoryHours, 0);
    plan.totalLabHours = plan.subjects.reduce((sum, s) => sum + s.labHours, 0);

    return curriculumRepository.updateById(id, { semesterPlans: plans });
  },
};
