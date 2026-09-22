import {
  assignmentRepository,
  curriculumRepository,
  sectionRepository,
  subjectRepository,
} from "../repositories";
import { notifyUsers, notifyStudentsByClass } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import createError from "http-errors";
import { AssignmentStatus, type IAssignment } from "../models/assignment.model";
import { SectionModel } from "../models/section.model";
import { TimetableModel } from "../models/timetable.model";
import { Types } from "mongoose";
import { formatIndiaDate } from "../utils/date.util";

export function calculateAssignmentGrade(
  rawMarks: number,
  maxMarks: number,
  isLate: boolean,
  latePenaltyPercent: number,
) {
  if (
    !Number.isFinite(rawMarks) ||
    !Number.isFinite(maxMarks) ||
    rawMarks < 0 ||
    maxMarks <= 0 ||
    rawMarks > maxMarks ||
    latePenaltyPercent < 0 ||
    latePenaltyPercent > 100
  ) {
    throw createError(400, "Marks and penalty must be within configured limits");
  }
  const penaltyApplied = isLate ? latePenaltyPercent : 0;
  const marks = Number((rawMarks * (1 - penaltyApplied / 100)).toFixed(2));
  const percentage = (marks / maxMarks) * 100;
  const grade =
    percentage >= 90
      ? "O"
      : percentage >= 80
        ? "A+"
        : percentage >= 70
          ? "A"
          : percentage >= 60
            ? "B+"
            : percentage >= 50
              ? "B"
              : percentage >= 40
                ? "C"
                : "F";
  return { rawMarks, marks, penaltyApplied, grade };
}

async function normalizeAssignment(
  data: Record<string, unknown>,
  facultyId: string,
  existing?: IAssignment,
) {
  const sectionIdInput = String(data.sectionId ?? existing?.sectionId ?? "");
  const subjectId = String(data.subjectId ?? existing?.subjectId ?? "");
  let section = Types.ObjectId.isValid(sectionIdInput)
    ? await sectionRepository.findRawById(sectionIdInput)
    : null;
  if (!section) {
    section = await SectionModel.findOne({ sectionName: sectionIdInput }).lean();
  }
  if (!section) throw createError(400, "Valid section is required");
  const [curriculum, subject] = await Promise.all([
    curriculumRepository.findById(section.curriculumId.toString()),
    subjectRepository.findById(subjectId),
  ]);
  const plan = curriculum?.semesterPlans?.find((item) => item.semesterNo === section.semesterNo);
  if (
    !curriculum?.isActive ||
    !plan?.subjects.some((item) => item.subjectId.toString() === subjectId)
  ) {
    throw createError(400, "Subject is not assigned to the section curriculum");
  }
  if (!subject?.isActive) throw createError(404, "Active subject not found");
  const teachesClass = await TimetableModel.exists({
    sectionId: section._id,
    isApproved: true,
    isActive: true,
    slots: { $elemMatch: { subjectId, facultyId } },
  });
  if (!teachesClass)
    throw createError(403, "Faculty is not assigned to teach this subject and section");
  const dueDate = new Date(String(data.dueDate ?? existing?.dueDate ?? ""));
  if (!Number.isFinite(dueDate.getTime())) throw createError(400, "Valid due date is required");
  const allowLateSubmission = Boolean(data.allowLateSubmission ?? existing?.allowLateSubmission);
  return {
    ...data,
    sectionId: section._id,
    subjectId: subject._id,
    subjectCode: subject.code,
    facultyId,
    departmentId: section.departmentId,
    program: section.program,
    semester: section.semesterNo,
    section: section.sectionName,
    academicYear: section.academicYear,
    dueDate,
    allowLateSubmission,
    latePenaltyPercent: allowLateSubmission ? Number(data.latePenaltyPercent ?? 0) : 0,
  };
}

export const assignmentService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    assignmentRepository.list(filter, page, limit),

  getById: (id: string) => assignmentRepository.findById(id),

  create: async (data: Record<string, unknown>) => {
    const facultyId = String(data.facultyId || "");
    const normalized = await normalizeAssignment(data, facultyId);
    return assignmentRepository.create({
      ...normalized,
      status: AssignmentStatus.DRAFT,
      isActive: false,
      publishedAt: undefined,
    });
  },

  update: async (id: string, data: Record<string, unknown>, facultyId: string) => {
    const existing = (await assignmentRepository.findById(id)) as unknown as IAssignment | null;
    if (!existing) throw createError(404, "Assignment not found");
    if (existing.status !== AssignmentStatus.DRAFT) {
      throw createError(409, "Only draft assignments can be edited");
    }
    const normalized: Record<string, unknown> = await normalizeAssignment(
      data,
      facultyId,
      existing,
    );
    for (const field of [
      "_id",
      "status",
      "isActive",
      "publishedAt",
      "closedAt",
      "submissions",
      "totalSubmissions",
      "createdBy",
      "createdAt",
      "updatedAt",
    ])
      delete normalized[field];
    const updated = await assignmentRepository.updateDraft(id, normalized);
    if (!updated) throw createError(409, "Assignment was concurrently published");
    return updated;
  },

  publish: async (id: string, facultyId?: string) => {
    const assignment = await assignmentRepository.findById(id);
    if (!assignment) throw createError(404, "Assignment not found");
    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw createError(409, "Only draft assignments can be published");
    }
    if (new Date(assignment.dueDate).getTime() <= Date.now()) {
      throw createError(400, "Assignment due date must be in the future when published");
    }
    const published = await assignmentRepository.publish(id, facultyId);
    if (!published) throw createError(409, "Assignment was concurrently changed or published");
    void notifyStudentsByClass(
      {
        departmentId: String(published.departmentId),
        semester: published.semester,
        section: published.section,
        academicYear: published.academicYear,
      },
      {
        title: "New assignment posted",
        body: `${published.title} is now available. Due ${formatIndiaDate(published.dueDate)}.`,
        type: NotificationType.INFO,
        actionUrl: "/student/assignment",
      },
    );
    return published;
  },

  close: async (id: string, facultyId?: string) => {
    const closed = await assignmentRepository.close(id, facultyId);
    if (!closed) throw createError(409, "Only a published assignment can be closed");
    return closed;
  },

  submitAssignment: async (
    assignmentId: string,
    studentId: string,
    input: { fileUrl?: string; textContent?: string },
  ) => {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw createError(404, "Assignment not found");
    if (assignment.status !== AssignmentStatus.PUBLISHED || !assignment.isActive) {
      throw createError(409, "This assignment is not accepting submissions");
    }
    const fileUrl = input.fileUrl?.trim();
    const textContent = input.textContent?.trim();
    if (!fileUrl && !textContent) throw createError(400, "File or answer text is required");
    const submittedAt = new Date();
    const isLate = submittedAt > new Date(assignment.dueDate);
    if (isLate && !assignment.allowLateSubmission) {
      throw createError(409, "The submission deadline has passed");
    }
    const updated = await assignmentRepository.addSubmission(
      assignmentId,
      {
        studentId,
        fileUrl: fileUrl || undefined,
        textContent: textContent || undefined,
        submittedAt,
        isLate,
        gradingHistory: [],
      },
      submittedAt,
    );
    if (!updated) throw createError(409, "Assignment is closed, overdue, or already submitted");
    if (updated?.facultyId) {
      void notifyUsers([updated.facultyId], {
        title: "New assignment submission",
        body: `A student has submitted "${updated.title ?? "an assignment"}"${isLate ? " (late)" : ""}.`,
        type: NotificationType.INFO,
        actionUrl: "/faculty/assignment",
      });
    }
    return updated;
  },

  gradeSubmission: async (
    assignmentId: string,
    studentId: string,
    rawMarks: number,
    feedback: string,
    evaluatedBy: string,
  ) => {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw createError(404, "Assignment not found");
    const submission = assignment.submissions.find((item) => String(item.studentId) === studentId);
    if (!submission) throw createError(404, "Student submission not found");
    const gradeResult = calculateAssignmentGrade(
      Number(rawMarks),
      assignment.maxMarks,
      submission.isLate,
      assignment.latePenaltyPercent,
    );
    const evaluatedAt = new Date();
    const history = {
      ...gradeResult,
      feedback,
      evaluatedBy,
      evaluatedAt,
    };
    let updated = await assignmentRepository.gradeSubmission(
      assignmentId,
      studentId,
      { ...gradeResult, feedback: feedback?.trim(), evaluatedBy, evaluatedAt },
      history,
    );
    if (!updated) throw createError(409, "Assignment is not available for grading");
    if (
      updated.status === AssignmentStatus.CLOSED &&
      updated.submissions.length > 0 &&
      updated.submissions.every((item) => item.marks !== undefined)
    ) {
      updated = (await assignmentRepository.markEvaluated(assignmentId)) ?? updated;
    }
    void notifyUsers([studentId], {
      title: "Assignment graded",
      body: `Your assignment "${updated?.title ?? ""}" has been graded: ${gradeResult.marks} marks (${gradeResult.grade}).`,
      type: NotificationType.RESULT,
      actionUrl: "/student/assignment",
      withEmail: true,
      emailTemplate: EmailTemplate.ASSIGNMENT_GRADED,
    });
    return updated;
  },
};
