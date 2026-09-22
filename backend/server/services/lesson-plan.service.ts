import createError from "http-errors";
import { Types } from "mongoose";
import {
  curriculumRepository,
  lessonPlanRepository,
  sectionRepository,
  subjectRepository,
} from "../repositories";
import type { ILessonPlan, IUnitPlan } from "../models/lesson-plan.model";
import { TimetableModel } from "../models/timetable.model";
import { notifyUsers, notifyByPermission } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { Module, PermissionAction } from "../constants/permissions";

export function validateLessonPlanUnits(rawUnits: unknown, validCourseOutcomes: string[]) {
  if (!Array.isArray(rawUnits) || rawUnits.length < 1 || rawUnits.length > 20)
    throw createError(400, "Lesson plan requires between 1 and 20 units");
  const validCos = new Set(validCourseOutcomes.map((code) => code.toUpperCase()));
  const allTopics = new Set<string>();
  let previousEnd = 0;
  const units = rawUnits.map((raw, index) => {
    const unit = raw as IUnitPlan;
    if (Number(unit.unitNo) !== index + 1)
      throw createError(400, "Unit numbers must be contiguous and ordered from 1");
    const unitTitle = String(unit.unitTitle ?? "").trim();
    if (unitTitle.length < 2 || unitTitle.length > 500)
      throw createError(400, `Unit ${index + 1} requires a valid title`);
    const topics = Array.isArray(unit.plannedTopics)
      ? unit.plannedTopics.map((topic) => String(topic).trim()).filter(Boolean)
      : [];
    if (!topics.length || topics.length > 100 || topics.some((topic) => topic.length > 1000))
      throw createError(400, `Unit ${index + 1} requires 1 to 100 valid topics`);
    for (const topic of topics) {
      const normalized = topic.replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
      if (allTopics.has(normalized)) throw createError(400, `Topic "${topic}" is duplicated`);
      allTopics.add(normalized);
    }
    const plannedClasses = Number(unit.plannedClasses);
    if (!Number.isInteger(plannedClasses) || plannedClasses < 1 || plannedClasses > 500)
      throw createError(400, `Unit ${index + 1} has invalid planned classes`);
    const plannedStartDate = new Date(unit.plannedStartDate);
    const plannedEndDate = new Date(unit.plannedEndDate);
    if (!Number.isFinite(plannedStartDate.getTime()) || !Number.isFinite(plannedEndDate.getTime()))
      throw createError(400, `Unit ${index + 1} requires valid dates`);
    if (plannedEndDate < plannedStartDate)
      throw createError(400, `Unit ${index + 1} end date must follow its start date`);
    if (plannedStartDate.getTime() <= previousEnd)
      throw createError(400, "Unit date ranges must be ordered and non-overlapping");
    previousEnd = plannedEndDate.getTime();
    const coMappings = [
      ...new Set(
        (Array.isArray(unit.coMappings) ? unit.coMappings : []).map((code) =>
          String(code).trim().toUpperCase(),
        ),
      ),
    ].filter(Boolean);
    if (!coMappings.length || coMappings.some((code) => !validCos.has(code)))
      throw createError(400, `Unit ${index + 1} must map valid curriculum course outcomes`);
    return {
      unitNo: index + 1,
      unitTitle,
      plannedTopics: topics,
      plannedClasses,
      plannedStartDate,
      plannedEndDate,
      coMappings,
      actualClasses: 0,
      isComplete: false,
    };
  });
  return units;
}

async function normalizeLessonPlan(
  data: Record<string, unknown>,
  facultyId: string,
  existing?: ILessonPlan,
) {
  const sectionId = String(data.sectionId ?? existing?.sectionId ?? "");
  const subjectId = String(data.subjectId ?? existing?.subjectId ?? "");
  if (!Types.ObjectId.isValid(sectionId) || !Types.ObjectId.isValid(subjectId))
    throw createError(400, "Valid section and subject are required");
  const section = await sectionRepository.findRawById(sectionId);
  if (!section) throw createError(404, "Section not found");
  const [curriculum, subject] = await Promise.all([
    curriculumRepository.findById(String(section.curriculumId)),
    subjectRepository.findById(subjectId),
  ]);
  if (!curriculum?.isActive || !subject?.isActive)
    throw createError(404, "Active curriculum and subject are required");
  const semesterPlan = curriculum.semesterPlans.find(
    (plan) => plan.semesterNo === section.semesterNo,
  );
  const curriculumSubject = semesterPlan?.subjects.find(
    (row) => String(row.subjectId) === subjectId,
  );
  if (!curriculumSubject)
    throw createError(400, "Subject is not assigned to the section curriculum");
  if (
    !(await TimetableModel.exists({
      sectionId: section._id,
      isApproved: true,
      isActive: true,
      slots: { $elemMatch: { subjectId, facultyId } },
    }))
  )
    throw createError(403, "Faculty is not assigned to teach this subject and section");
  const unitPlans = validateLessonPlanUnits(
    data.unitPlans ?? existing?.unitPlans,
    curriculumSubject.courseOutcomes.map((outcome) => outcome.coCode),
  );
  return {
    ...data,
    academicYear: section.academicYear,
    semesterType: section.semesterNo % 2 === 0 ? "even" : "odd",
    subjectId: subject._id,
    sectionId: section._id,
    curriculumId: curriculum._id,
    subjectCode: subject.code,
    subjectName: subject.name,
    facultyId,
    departmentId: section.departmentId,
    program: section.program,
    semester: section.semesterNo,
    section: section.sectionName,
    totalUnits: unitPlans.length,
    totalPlannedClasses: unitPlans.reduce((sum, unit) => sum + unit.plannedClasses, 0),
    unitPlans,
  };
}

export const lessonPlanService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    lessonPlanRepository.list(filter, page, limit),

  getById: (id: string) => lessonPlanRepository.findById(id),

  create: async (data: Record<string, unknown>, facultyId: string) => {
    const normalized = await normalizeLessonPlan(data, facultyId);
    return lessonPlanRepository.create({
      ...normalized,
      status: "draft",
      createdBy: facultyId,
      reviewHistory: [],
    });
  },

  update: async (
    id: string,
    data: Record<string, unknown>,
    actorId: string,
    facultyOwned: boolean,
  ) => {
    const existing = (await lessonPlanRepository.findById(id)) as unknown as ILessonPlan | null;
    if (!existing) throw createError(404, "Lesson plan not found");
    if (!["draft", "rejected"].includes(existing.status))
      throw createError(409, "Only draft or rejected lesson plans can be edited");
    const normalized = (await normalizeLessonPlan(
      data,
      String(existing.facultyId),
      existing,
    )) as Record<string, unknown>;
    for (const field of [
      "_id",
      "status",
      "submittedAt",
      "approvedBy",
      "approvedAt",
      "rejectionReason",
      "reviewHistory",
      "createdBy",
      "createdAt",
      "updatedAt",
    ])
      delete normalized[field];
    normalized.updatedBy = actorId;
    const updated = await lessonPlanRepository.updateEditable(
      id,
      normalized,
      facultyOwned ? actorId : undefined,
    );
    if (!updated)
      throw createError(409, "Lesson plan was concurrently changed or is not owned by you");
    return updated;
  },

  submit: async (id: string, facultyId: string) => {
    const updated = await lessonPlanRepository.submit(id, facultyId, new Date());
    if (!updated) throw createError(409, "Only an owned draft or rejected plan can be submitted");
    void notifyByPermission(Module.LESSON_PLAN, PermissionAction.APPROVE, {
      departmentId: updated.departmentId as unknown as string,
      title: "Lesson plan awaiting your approval",
      body: `A lesson plan has been submitted for Sem ${updated.semester} and needs your review.`,
      type: NotificationType.INFO,
      actionUrl: "/hod/lesson-plan",
    });
    return updated;
  },

  approve: async (id: string, approvedBy: string) => {
    const updated = (await lessonPlanRepository.approve(
      id,
      approvedBy,
      new Date(),
    )) as unknown as ILessonPlan | null;
    if (!updated) throw createError(409, "Only a submitted plan can be independently approved");
    void notifyUsers([updated.facultyId], {
      title: "Lesson plan approved",
      body: "Your lesson plan has been approved by the academic reviewer.",
      type: NotificationType.SUCCESS,
      actionUrl: "/faculty/lesson-plan",
    });
    return updated;
  },

  reject: async (id: string, rejectedBy: string, remark: string) => {
    const reason = remark?.trim();
    if (!reason || reason.length > 2000)
      throw createError(400, "A valid rejection reason is required");
    const updated = await lessonPlanRepository.reject(id, rejectedBy, new Date(), reason);
    if (!updated) throw createError(409, "Only a submitted plan can be independently rejected");
    void notifyUsers([updated.facultyId], {
      title: "Lesson plan rejected",
      body: `Your lesson plan was rejected. Remark: ${reason}`,
      type: NotificationType.WARNING,
      actionUrl: "/faculty/lesson-plan",
      withEmail: true,
      emailTemplate: EmailTemplate.LESSON_PLAN_UPDATE,
    });
    return updated;
  },
};
