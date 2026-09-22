import createError from "http-errors";
import { Types } from "mongoose";
import { SystemRole } from "../constants/roles";
import {
  MentorModel,
  StudentAttendanceSummaryModel,
  StudentProfileModel,
  StudentRiskSnapshotModel,
  StudentSuccessCaseModel,
  UserModel,
} from "../models";
import { NotificationType } from "../models/notification.model";
import { notifyUsers } from "./helpers/notify.helper";

interface IRiskThresholds {
  attendancePercent: number;
  cgpa: number;
  backlogCount: number;
  feeOutstandingPercent: number;
  advisorFollowupDays: number;
}

const DEFAULT_THRESHOLDS: IRiskThresholds = {
  attendancePercent: 75,
  cgpa: 6,
  backlogCount: 2,
  feeOutstandingPercent: 35,
  advisorFollowupDays: 60,
};

const scoreLevel = (score: number): "low" | "medium" | "high" | "critical" =>
  score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

const signalSeverity = (score: number): "low" | "medium" | "high" =>
  score >= 18 ? "high" : score >= 8 ? "medium" : "low";

async function calculateStudentRisk(studentProfileId: string, thresholds = DEFAULT_THRESHOLDS) {
  const student = await StudentProfileModel.findById(studentProfileId).lean();
  if (!student) throw createError(404, "Student profile not found");
  const [attendance, mentorAssignment] = await Promise.all([
    StudentAttendanceSummaryModel.find({
      studentId: student.userId,
      academicYear: student.academicYear,
    }).lean(),
    MentorModel.findOne({ menteeIds: student.userId, isActive: true })
      .select("facultyId meetings")
      .lean(),
  ]);
  const totalClasses = attendance.reduce((sum, row) => sum + row.totalClasses, 0);
  const attended = attendance.reduce((sum, row) => sum + row.attended + row.onDuty, 0);
  const attendancePercent =
    totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 100;
  const attendanceScore =
    attendancePercent < thresholds.attendancePercent
      ? Math.min(30, Math.round((thresholds.attendancePercent - attendancePercent) * 1.5))
      : 0;

  const backlogs = Math.max(
    student.totalBacklogs ?? 0,
    ...student.semesterResults.map((result) => result.backlogs ?? 0),
  );
  const backlogScore = Math.min(25, Math.max(0, backlogs - thresholds.backlogCount + 1) * 8);
  const cgpa = student.currentCgpa ?? 10;
  const cgpaScore =
    cgpa < thresholds.cgpa ? Math.min(20, Math.round((thresholds.cgpa - cgpa) * 7)) : 0;
  const due = Math.max(0, student.totalFeeDue ?? 0);
  const paid = Math.max(0, student.totalFeePaid ?? 0);
  const feeOutstandingPercent = due > 0 ? Math.round((Math.max(0, due - paid) / due) * 100) : 0;
  const feeScore =
    feeOutstandingPercent >= thresholds.feeOutstandingPercent
      ? Math.min(15, Math.round(feeOutstandingPercent / 7))
      : 0;
  const studentMeetings = (mentorAssignment?.meetings ?? []).filter(
    (meeting) => meeting.studentId.toString() === student.userId.toString(),
  );
  const lastMeeting = studentMeetings.sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  )[0];
  const followupDays = lastMeeting
    ? Math.floor((Date.now() - lastMeeting.date.getTime()) / 86_400_000)
    : thresholds.advisorFollowupDays + 1;
  const followupScore = followupDays > thresholds.advisorFollowupDays ? 10 : 0;

  const values = [
    {
      key: "attendance" as const,
      label: "Attendance",
      value: attendancePercent,
      threshold: thresholds.attendancePercent,
      score: attendanceScore,
      explanation: `${attendancePercent}% attendance across ${totalClasses} recorded classes.`,
    },
    {
      key: "backlogs" as const,
      label: "Academic backlogs",
      value: backlogs,
      threshold: thresholds.backlogCount,
      score: backlogScore,
      explanation: `${backlogs} active or recently reported backlog subjects.`,
    },
    {
      key: "cgpa" as const,
      label: "Academic performance",
      value: cgpa,
      threshold: thresholds.cgpa,
      score: cgpaScore,
      explanation: `Current CGPA is ${cgpa.toFixed(2)} against the ${thresholds.cgpa.toFixed(2)} support threshold.`,
    },
    {
      key: "fee_balance" as const,
      label: "Fee balance",
      value: feeOutstandingPercent,
      threshold: thresholds.feeOutstandingPercent,
      score: feeScore,
      explanation: `${feeOutstandingPercent}% of assessed fees remain outstanding.`,
    },
    {
      key: "advisor_followup" as const,
      label: "Advisor follow-up",
      value: followupDays,
      threshold: thresholds.advisorFollowupDays,
      score: followupScore,
      explanation: lastMeeting
        ? `Last recorded mentor interaction was ${followupDays} days ago.`
        : "No mentor interaction is recorded for this student.",
    },
  ];
  const riskScore = Math.min(
    100,
    values.reduce((sum, item) => sum + item.score, 0),
  );
  const signals = values.map((item) => ({ ...item, severity: signalSeverity(item.score) }));
  return StudentRiskSnapshotModel.findOneAndUpdate(
    { studentProfileId: student._id },
    {
      $set: {
        studentId: student.userId,
        departmentId: student.department,
        mentorId: mentorAssignment?.facultyId,
        academicYear: student.academicYear,
        riskScore,
        riskLevel: scoreLevel(riskScore),
        signals,
        calculatedAt: new Date(),
        sourceUpdatedAt: student.updatedAt,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean();
}

export const studentSuccessService = {
  calculateStudentRisk,

  studentScope: async (studentProfileId: string) => {
    const student = await StudentProfileModel.findById(studentProfileId)
      .select("_id department")
      .lean();
    if (!student) throw createError(404, "Student profile not found");
    return student;
  },

  caseById: async (id: string) => {
    const item = await StudentSuccessCaseModel.findById(id).lean();
    if (!item) throw createError(404, "Student-success case not found");
    return item;
  },

  refreshDepartment: async (departmentId?: string) => {
    const filter: Record<string, unknown> = { status: "active" };
    if (departmentId) filter.department = departmentId;
    const students = await StudentProfileModel.find(filter).select("_id").limit(5000).lean();
    const results = [];
    const concurrency = 10;
    for (let index = 0; index < students.length; index += concurrency) {
      results.push(
        ...(await Promise.all(
          students
            .slice(index, index + concurrency)
            .map((student) => calculateStudentRisk(student._id.toString())),
        )),
      );
    }
    return { evaluated: results.length };
  },

  mine: async (userId: string) => {
    const student = await StudentProfileModel.findOne({ userId }).select("_id").lean();
    if (!student) throw createError(403, "An active student profile is required");
    const snapshot = await calculateStudentRisk(student._id.toString());
    const activeCase = await StudentSuccessCaseModel.findOne({
      studentProfileId: student._id,
      status: { $nin: ["resolved", "closed"] },
    })
      .select(
        "status priority dueAt interventions.type interventions.action interventions.nextFollowUpAt",
      )
      .lean();
    return { snapshot, activeCase };
  },

  caseload: async (filter: Record<string, unknown>, page = 1, limit = 30) => {
    const bounded = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * bounded;
    const [data, total] = await Promise.all([
      StudentRiskSnapshotModel.find(filter)
        .populate(
          "studentProfileId",
          "firstName middleName lastName rollNumber program currentSemester",
        )
        .populate("mentorId", "name email")
        .sort({ riskScore: -1, calculatedAt: -1 })
        .skip(skip)
        .limit(bounded)
        .lean(),
      StudentRiskSnapshotModel.countDocuments(filter),
    ]);
    const profileIds = data.map((row) => row.studentProfileId);
    const cases = await StudentSuccessCaseModel.find({
      studentProfileId: { $in: profileIds },
      status: { $nin: ["resolved", "closed"] },
    }).lean();
    const caseByProfile = new Map(cases.map((item) => [item.studentProfileId.toString(), item]));
    return {
      data: data.map((row) => ({
        ...row,
        activeCase: caseByProfile.get(
          String(
            (row.studentProfileId as unknown as { _id?: Types.ObjectId })._id ??
              row.studentProfileId,
          ),
        ),
      })),
      total,
      page: Math.max(1, page),
      limit: bounded,
      pages: Math.ceil(total / bounded),
    };
  },

  openCase: async (
    actorId: string,
    input: {
      studentProfileId: string;
      assignedAdvisorId: string;
      title: string;
      summary: string;
      priority: "low" | "medium" | "high" | "critical";
      dueAt?: string;
    },
  ) => {
    if (input.dueAt && new Date(input.dueAt).getTime() <= Date.now())
      throw createError(400, "The intervention due date must be in the future");
    const [student, snapshot] = await Promise.all([
      StudentProfileModel.findById(input.studentProfileId).lean(),
      StudentRiskSnapshotModel.findOne({ studentProfileId: input.studentProfileId }).lean(),
    ]);
    if (!student) throw createError(404, "Student profile not found");
    const advisor = await UserModel.exists({
      _id: input.assignedAdvisorId,
      status: "active",
      roles: { $in: [SystemRole.FACULTY, SystemRole.HOD] },
      department: student.department,
    });
    if (!advisor)
      throw createError(400, "Select an active faculty advisor from the student's department");
    const created = await StudentSuccessCaseModel.create({
      studentProfileId: student._id,
      studentId: student.userId,
      departmentId: student.department,
      riskSnapshotId: snapshot?._id,
      title: input.title,
      summary: input.summary,
      priority: input.priority,
      assignedAdvisorId: input.assignedAdvisorId,
      openedBy: actorId,
      openedAt: new Date(),
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    });
    void notifyUsers([input.assignedAdvisorId], {
      title: "Student success case assigned",
      body: `${input.title} requires advisor follow-up.`,
      type: NotificationType.GENERAL,
      actionUrl: "/student-success",
    });
    return created.toObject();
  },

  addIntervention: async (
    caseId: string,
    actorId: string,
    input: {
      type: "academic" | "attendance" | "financial" | "wellbeing" | "career" | "parent_outreach";
      action: string;
      outcome?: string;
      nextFollowUpAt?: string;
      status?: "contacted" | "in_progress" | "monitoring";
    },
  ) => {
    const updated = await StudentSuccessCaseModel.findOneAndUpdate(
      { _id: caseId, status: { $nin: ["resolved", "closed"] } },
      {
        $push: {
          interventions: {
            type: input.type,
            action: input.action,
            outcome: input.outcome,
            nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
            recordedBy: actorId,
            recordedAt: new Date(),
          },
        },
        $set: { status: input.status ?? "in_progress" },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw createError(409, "Only an active student-success case can be updated");
    return updated;
  },

  resolveCase: async (caseId: string, actorId: string, resolution: string) => {
    const updated = await StudentSuccessCaseModel.findOneAndUpdate(
      { _id: caseId, status: { $nin: ["resolved", "closed"] } },
      { $set: { status: "resolved", resolution, resolvedBy: actorId, resolvedAt: new Date() } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw createError(409, "Only an active student-success case can be resolved");
    return updated;
  },

  processOverdueCases: async () => {
    const now = new Date();
    const overdue = await StudentSuccessCaseModel.find({
      status: { $in: ["open", "contacted", "in_progress", "monitoring"] },
      dueAt: { $lte: now },
      $or: [{ escalatedAt: { $exists: false } }, { escalatedAt: null }],
    })
      .select("_id title assignedAdvisorId departmentId status dueAt")
      .limit(500)
      .lean();
    let escalated = 0;
    for (const item of overdue) {
      const claimed = await StudentSuccessCaseModel.updateOne(
        {
          _id: item._id,
          status: item.status,
          $or: [{ escalatedAt: { $exists: false } }, { escalatedAt: null }],
        },
        { $set: { escalatedAt: now }, $inc: { escalationCount: 1 } },
      );
      if (!claimed.modifiedCount) continue;
      const leaders = await UserModel.find({
        status: "active",
        department: item.departmentId,
        roles: { $in: [SystemRole.HOD, SystemRole.DEAN_ACADEMIC] },
      })
        .select("_id")
        .lean();
      await notifyUsers([item.assignedAdvisorId, ...leaders.map((leader) => leader._id)], {
        title: "Overdue student success intervention",
        body: `${item.title} has exceeded its follow-up due date and needs attention.`,
        type: NotificationType.WARNING,
        actionUrl: "/student-success",
      });
      escalated += 1;
    }
    return { evaluated: overdue.length, escalated };
  },
};
