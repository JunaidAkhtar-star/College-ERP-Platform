import createError from "http-errors";
import { Types } from "mongoose";
import {
  AssessmentActivityModel,
  AssessmentScoreLedgerModel,
  ActivityStatus,
  GradebookStatus,
} from "../models/assessment-gradebook.model";
import type { IAssessmentScoreLedger } from "../models/assessment-gradebook.model";
import { AssessmentPolicyModel, AssessmentPolicyStatus } from "../models/assessment-policy.model";
import { AttendanceRecordModel, AttendanceStatus } from "../models/attendance.model";
import { StudentMarksModel } from "../models/examination.model";
import { FacultyWorkloadModel } from "../models/faculty-workload.model";
import {
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
} from "../models/student-section-allotment.model";
import { SystemRole } from "../constants/roles";
import { SubjectModel } from "../models/subject.model";
import { calculateComponentScore } from "./assessment-policy.service";

async function publishedPolicy(id: string) {
  const policy = await AssessmentPolicyModel.findOne({
    _id: id,
    status: AssessmentPolicyStatus.PUBLISHED,
  }).lean();
  if (!policy) throw createError(409, "A published assessment policy is required");
  return policy;
}
async function assertFacultyAssignment(
  userId: string,
  activeRole: string | undefined,
  departmentId: string | undefined,
  subjectId: string,
  academicYear: string,
  semester: number,
) {
  if (activeRole === SystemRole.HOD) {
    if (!departmentId) throw createError(403, "Department context is required");
    const inDepartment = await SubjectModel.exists({ _id: subjectId, departmentId });
    if (!inDepartment) throw createError(403, "This subject is outside your department");
    return;
  }
  if (activeRole !== SystemRole.FACULTY) return;
  const assigned = await FacultyWorkloadModel.exists({
    facultyId: userId,
    academicYear,
    isApproved: true,
    teachingAssignments: { $elemMatch: { subjectId, semester } },
  });
  if (!assigned) throw createError(403, "This subject is not in your approved teaching workload");
}
async function scopedSubjectIds(
  userId: string,
  activeRole?: string,
  departmentId?: string,
): Promise<string[] | undefined> {
  if (activeRole === SystemRole.FACULTY) {
    const workloads = await FacultyWorkloadModel.find({ facultyId: userId, isApproved: true })
      .select("teachingAssignments.subjectId")
      .lean();
    return [
      ...new Set(
        workloads.flatMap((row) => row.teachingAssignments.map((a) => a.subjectId.toString())),
      ),
    ];
  }
  if (activeRole === SystemRole.HOD) {
    if (!departmentId) return [];
    return (await SubjectModel.find({ departmentId }).select("_id").lean()).map((row) =>
      row._id.toString(),
    );
  }
  return undefined;
}

const ACTIVITY_FILTERS = [
  "policyId",
  "componentKey",
  "subjectId",
  "sectionId",
  "semester",
  "academicYear",
  "status",
] as const;
const LEDGER_FILTERS = [
  "policyId",
  "studentId",
  "subjectId",
  "sectionId",
  "semester",
  "academicYear",
  "status",
  "enteredBy",
] as const;
function allowlistedFilter(
  input: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = input[key];
      return typeof value === "string" || typeof value === "number" ? [[key, value]] : [];
    }),
  );
}
interface IRecordScoreInput {
  policyId: string;
  activityId?: string;
  studentId: string;
  subjectId: string;
  sectionId?: string;
  semester: number;
  academicYear: string;
  componentKey: string;
  rawMarks: number;
  attendanceRecordId?: string;
  isMakeup?: boolean;
}
async function bulkRecordScores(
  inputs: IRecordScoreInput[],
  userId: string,
  activeRole?: string,
  departmentId?: string,
) {
  if (!inputs.length || inputs.length > 500)
    throw createError(400, "Bulk entry requires between 1 and 500 student scores");
  const unique = new Set(
    inputs.map((row) => `${row.studentId}:${row.activityId || row.componentKey}`),
  );
  if (unique.size !== inputs.length) throw createError(400, "Duplicate student score rows found");
  const results = [];
  for (const input of inputs)
    results.push(
      await assessmentGradebookService.recordScore(input, userId, activeRole, departmentId),
    );
  return { processed: results.length, ledgers: results };
}
async function syncFrozenLedgerToMarks(ledger: IAssessmentScoreLedger | null) {
  if (!ledger) return;
  const marksRows = await StudentMarksModel.find({
    studentId: ledger.studentId,
    subjectId: ledger.subjectId,
    semester: ledger.semester,
    academicYear: ledger.academicYear,
    isPublished: { $ne: true },
  });
  for (const marks of marksRows) {
    const target = ledger.policySnapshot.resultTarget;
    if (target === "internal" || target === "standalone") {
      marks.internalTotal = ledger.totalMarks;
      marks.internalMax = ledger.maximumMarks;
      marks.internalComponents = ledger.componentResults.map((component) => ({
        name: component.key,
        maxMarks: component.maximumMarks,
        marksObtained: component.marks,
      }));
    }
    if (target === "external") {
      marks.externalMarks = ledger.totalMarks;
      marks.externalMax = ledger.maximumMarks;
    }
    if (target === "standalone") {
      marks.externalMarks = 0;
      marks.externalMax = 0;
      marks.totalMax = ledger.maximumMarks;
    }
    marks.assessmentPolicyId = ledger.policyId;
    marks.assessmentPolicyCode = ledger.policyCode;
    marks.assessmentPolicyVersion = ledger.policyVersion;
    marks.assessmentPolicySnapshot = ledger.policySnapshot as unknown as Record<string, unknown>;
    marks.assessmentLedgerId = ledger._id;
    marks.verifiedBy = ledger.verifiedBy;
    await marks.save();
  }
}

export const assessmentGradebookService = {
  listActivities: async (
    filter: Record<string, unknown>,
    userId: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const safe = allowlistedFilter(filter, ACTIVITY_FILTERS);
    const subjects = await scopedSubjectIds(userId, activeRole, departmentId);
    if (subjects) safe.subjectId = { $in: subjects };
    return AssessmentActivityModel.find(safe).sort({ scheduledAt: 1, sequence: 1 }).lean();
  },
  createActivity: async (
    input: Record<string, unknown>,
    userId: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const policy = await publishedPolicy(String(input.policyId));
    const key = String(input.componentKey || "").toLowerCase();
    const component = policy.components.find((c) => c.key === key);
    if (!component) throw createError(400, "Component is not part of this policy");
    await assertFacultyAssignment(
      userId,
      activeRole,
      departmentId,
      String(input.subjectId),
      String(input.academicYear),
      Number(input.semester),
    );
    const count = await AssessmentActivityModel.countDocuments({
      policyId: policy._id,
      componentKey: key,
      subjectId: input.subjectId,
      sectionId: input.sectionId,
      academicYear: input.academicYear,
      status: { $ne: ActivityStatus.CANCELLED },
    } as never);
    if (count >= component.attemptCount)
      throw createError(409, `The configured ${component.attemptCount} activities already exist`);
    const maximumMarks = Number(input.maximumMarks);
    if (!Number.isFinite(maximumMarks) || maximumMarks <= 0)
      throw createError(400, "Valid activity maximum marks required");
    return AssessmentActivityModel.create({
      ...input,
      componentKey: key,
      maximumMarks,
      createdBy: userId,
    });
  },
  updateActivity: async (
    id: string,
    input: Record<string, unknown>,
    userId: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const activity = await AssessmentActivityModel.findById(id);
    if (!activity) throw createError(404, "Assessment activity not found");
    await assertFacultyAssignment(
      userId,
      activeRole,
      departmentId,
      activity.subjectId.toString(),
      activity.academicYear,
      activity.semester,
    );
    const locked = await AssessmentScoreLedgerModel.exists({
      "attempts.activityId": activity._id,
      status: {
        $in: [GradebookStatus.SUBMITTED, GradebookStatus.VERIFIED, GradebookStatus.FROZEN],
      },
    });
    if (locked) throw createError(409, "Activity is referenced by a submitted gradebook");
    return AssessmentActivityModel.findByIdAndUpdate(
      id,
      { $set: input },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },
  listLedgers: async (
    filter: Record<string, unknown>,
    userId: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const safe = allowlistedFilter(filter, LEDGER_FILTERS);
    const subjects = await scopedSubjectIds(userId, activeRole, departmentId);
    if (subjects) safe.subjectId = { $in: subjects };
    return AssessmentScoreLedgerModel.find(safe)
      .populate("studentId", "name email studentId")
      .populate("subjectId", "name code")
      .populate("sectionId", "sectionName academicYear semesterNo program departmentCode")
      .sort({ updatedAt: -1 })
      .lean();
  },
  recordScore: async (
    input: IRecordScoreInput,
    userId: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const policy = await publishedPolicy(input.policyId);
    const component = policy.components.find((c) => c.key === input.componentKey.toLowerCase());
    if (!component) throw createError(400, "Component is not part of this policy");
    await assertFacultyAssignment(
      userId,
      activeRole,
      departmentId,
      input.subjectId,
      input.academicYear,
      input.semester,
    );
    if (input.isMakeup && !component.allowMakeup)
      throw createError(409, "Makeup attempts are not allowed for this component");
    let activity = null;
    if (input.activityId) {
      activity = await AssessmentActivityModel.findOne({
        _id: input.activityId,
        policyId: policy._id,
        componentKey: component.key,
        subjectId: input.subjectId,
      });
      if (!activity) throw createError(404, "Assessment activity not found");
      if (activity.status === ActivityStatus.CANCELLED)
        throw createError(409, "Cancelled activity cannot receive marks");
    }
    const effectiveSectionId = input.sectionId || activity?.sectionId?.toString();
    if (effectiveSectionId) {
      const enrolled = await StudentSectionAllotmentModel.exists({
        studentId: input.studentId,
        sectionId: effectiveSectionId,
        academicYear: input.academicYear,
        semesterNo: input.semester,
        status: StudentSectionAllotmentStatus.ACTIVE,
      });
      if (!enrolled) throw createError(409, "Student is not actively allotted to this section");
    }
    const max = activity?.maximumMarks ?? component.scaleFrom ?? component.maximumMarks;
    if (!Number.isFinite(input.rawMarks) || input.rawMarks < 0 || input.rawMarks > max)
      throw createError(400, `Marks must be between 0 and ${max}`);
    const attendanceId = input.attendanceRecordId || activity?.attendanceRecordId?.toString();
    let attended: boolean | undefined;
    if (component.attendanceRequired) {
      if (!attendanceId) throw createError(400, "Attendance record is required for this component");
      const attendance = await AttendanceRecordModel.findOne({
        _id: attendanceId,
        subjectId: input.subjectId,
        "entries.studentId": input.studentId,
      }).lean();
      if (!attendance) throw createError(404, "Matching attendance record not found");
      const entry = attendance.entries.find((e) => e.studentId.toString() === input.studentId);
      attended =
        !!entry &&
        [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.OD].includes(
          entry.status,
        );
      if (!attended && input.rawMarks > 0)
        throw createError(409, "Marks cannot be entered because the student was absent");
    }
    let ledger = await AssessmentScoreLedgerModel.findOne({
      policyId: policy._id,
      studentId: input.studentId,
      subjectId: input.subjectId,
      semester: input.semester,
      academicYear: input.academicYear,
    });
    if (!ledger) {
      ledger = new AssessmentScoreLedgerModel({
        policyId: policy._id,
        policyCode: policy.code,
        policyVersion: policy.version,
        policySnapshot: {
          maximumMarks: policy.maximumMarks,
          resultTarget: policy.resultTarget,
          minimumTotalMarks: policy.minimumTotalMarks,
          gradeScale: policy.gradeScale,
          components: policy.components,
        },
        studentId: input.studentId,
        subjectId: input.subjectId,
        sectionId: input.sectionId,
        semester: input.semester,
        academicYear: input.academicYear,
        maximumMarks: policy.maximumMarks,
        enteredBy: userId,
      });
    }
    if (![GradebookStatus.DRAFT, GradebookStatus.RETURNED].includes(ledger.status))
      throw createError(409, "Only draft or returned gradebooks can be edited");
    const activityKey = input.activityId || `${component.key}:${attendanceId || "manual"}`;
    const idx = ledger.attempts.findIndex(
      (a) =>
        (a.activityId?.toString() ||
          `${a.componentKey}:${a.attendanceRecordId?.toString() || "manual"}`) === activityKey,
    );
    const attempt = {
      componentKey: component.key,
      activityId: input.activityId ? new Types.ObjectId(input.activityId) : undefined,
      rawMarks: input.rawMarks,
      maximumMarks: max,
      attendanceRecordId: attendanceId ? new Types.ObjectId(attendanceId) : undefined,
      attended,
      isMakeup: !!input.isMakeup,
      recordedBy: new Types.ObjectId(userId),
      recordedAt: new Date(),
    };
    if (idx >= 0) ledger.attempts[idx] = attempt;
    else ledger.attempts.push(attempt);
    await ledger.save();
    return ledger.toObject();
  },
  bulkRecordScores,
  submit: async (id: string, userId: string) => {
    const ledger = await AssessmentScoreLedgerModel.findById(id);
    if (!ledger) throw createError(404, "Gradebook not found");
    if (![GradebookStatus.DRAFT, GradebookStatus.RETURNED].includes(ledger.status))
      throw createError(409, "Only draft or returned gradebooks can be submitted");
    if (ledger.enteredBy.toString() !== userId)
      throw createError(403, "Only the marks-entry owner can submit this gradebook");
    const grouped = new Map<string, number[]>();
    for (const attempt of ledger.attempts) {
      const list = grouped.get(attempt.componentKey) || [];
      list.push(attempt.rawMarks);
      grouped.set(attempt.componentKey, list);
    }
    const results = ledger.policySnapshot.components.map((component) => {
      const attempts = grouped.get(component.key) || [];
      if (component.isRequired && !attempts.length)
        throw createError(409, `${component.name} is required before submission`);
      const marks = attempts.length
        ? calculateComponentScore(component, {
            componentKey: component.key,
            attempts,
            attended: true,
          })
        : 0;
      return {
        key: component.key,
        marks,
        maximumMarks: component.maximumMarks,
        passed: marks >= component.minimumPassMarks,
      };
    });
    ledger.componentResults = results;
    ledger.totalMarks = results.reduce((s, c) => s + c.marks, 0);
    ledger.percentage =
      ledger.maximumMarks > 0 ? (ledger.totalMarks / ledger.maximumMarks) * 100 : 0;
    const grade = [...ledger.policySnapshot.gradeScale]
      .sort((a, b) => b.minimumPercentage - a.minimumPercentage)
      .find((band) => ledger.percentage >= band.minimumPercentage);
    ledger.gradeLetter = grade?.letter ?? "";
    ledger.gradePoint = grade?.point ?? 0;
    ledger.passed =
      results.every((r) => r.passed) &&
      ledger.totalMarks >= ledger.policySnapshot.minimumTotalMarks;
    ledger.status = GradebookStatus.SUBMITTED;
    ledger.submittedAt = new Date();
    ledger.reviewedBy = undefined;
    ledger.reviewedAt = undefined;
    ledger.reviewNote = undefined;
    await ledger.save();
    return ledger.toObject();
  },
  verify: async (id: string, userId: string, activeRole?: string, departmentId?: string) => {
    const ledger = await AssessmentScoreLedgerModel.findById(id);
    if (!ledger) throw createError(404, "Gradebook not found");
    if (ledger.status !== GradebookStatus.SUBMITTED)
      throw createError(409, "Only submitted gradebooks can be verified");
    if (ledger.enteredBy.toString() === userId)
      throw createError(409, "Marks must be verified by a different authorized user");
    await assertFacultyAssignment(
      userId,
      activeRole,
      departmentId,
      ledger.subjectId.toString(),
      ledger.academicYear,
      ledger.semester,
    );
    ledger.status = GradebookStatus.VERIFIED;
    ledger.verifiedBy = new Types.ObjectId(userId);
    ledger.verifiedAt = new Date();
    await ledger.save();
    return ledger.toObject();
  },
  returnForCorrection: async (
    id: string,
    userId: string,
    note: string,
    activeRole?: string,
    departmentId?: string,
  ) => {
    const normalizedNote = note.trim();
    if (normalizedNote.length < 5) throw createError(400, "A correction note is required");
    const ledger = await AssessmentScoreLedgerModel.findOne({
      _id: id,
      status: GradebookStatus.SUBMITTED,
    });
    if (!ledger) throw createError(409, "Only submitted gradebooks can be returned");
    if (ledger.enteredBy.toString() === userId)
      throw createError(409, "The marks-entry owner cannot review their own gradebook");
    await assertFacultyAssignment(
      userId,
      activeRole,
      departmentId,
      ledger.subjectId.toString(),
      ledger.academicYear,
      ledger.semester,
    );
    ledger.status = GradebookStatus.RETURNED;
    ledger.reviewedBy = new Types.ObjectId(userId);
    ledger.reviewedAt = new Date();
    ledger.reviewNote = normalizedNote;
    await ledger.save();
    return ledger.toObject();
  },
  freeze: async (id: string, userId: string) => {
    const verified = await AssessmentScoreLedgerModel.findOne({
      _id: id,
      status: GradebookStatus.VERIFIED,
    });
    if (!verified) throw createError(409, "Only verified gradebooks can be frozen");
    await syncFrozenLedgerToMarks(verified);
    const row = await AssessmentScoreLedgerModel.findOneAndUpdate(
      { _id: id, status: GradebookStatus.VERIFIED },
      { $set: { status: GradebookStatus.FROZEN, frozenBy: userId, frozenAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Gradebook state changed before it could be frozen");
    return row;
  },
};
