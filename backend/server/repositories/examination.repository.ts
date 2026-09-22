import { Types, type ClientSession } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import {
  ExamScheduleModel,
  ExamAttemptModel,
  StudentMarksModel,
  SemesterResultModel,
  ExamStatus,
  type ExamType,
} from "../models";
import type { IExamAttempt } from "../models/examination.model";

export const examinationRepository = {
  // ─── Schedule ─────────────────────────────────────────────────────────────

  findScheduleById: (id: string, session?: ClientSession) =>
    ExamScheduleModel.findById(id)
      .session(session ?? null)
      .lean(),

  listSchedules: (filter: Record<string, unknown>, limit = 200) =>
    ExamScheduleModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),

  findScheduleResourceCandidates: (dates: Date[], excludeId?: string, session?: ClientSession) =>
    ExamScheduleModel.find({
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      status: { $in: [ExamStatus.SCHEDULED, ExamStatus.ONGOING] },
      "subjects.examDate": { $in: dates },
    })
      .select("title program semester section subjects")
      .session(session ?? null)
      .lean(),

  createSchedule: (data: Record<string, unknown>, session?: ClientSession) =>
    new ExamScheduleModel(data).save({ session }),

  updateSchedule: (id: string, data: Record<string, unknown>, session?: ClientSession) =>
    ExamScheduleModel.findByIdAndUpdate(
      id,
      { $set: data },
      { runValidators: true, returnDocument: "after", session },
    ).lean(),

  publishSchedule: (id: string) =>
    ExamScheduleModel.findByIdAndUpdate(
      id,
      { $set: { status: ExamStatus.COMPLETED, publishedAt: new Date() } },
      {},
    ).lean(),

  // ─── Marks ───────────────────────────────────────────────────────────────

  findMarks: (studentId: string, subjectId: string, examType: ExamType, academicYear: string) =>
    StudentMarksModel.findOne({ studentId, subjectId, examType, academicYear }).lean(),

  findPublishedMarks: (
    studentId: string,
    subjectId: string,
    examType: ExamType,
    academicYear: string,
  ) =>
    StudentMarksModel.findOne({
      studentId,
      subjectId,
      examType,
      academicYear,
      isPublished: true,
    })
      .select("_id")
      .lean(),

  findMarksByStudent: (
    studentId: string,
    semester: number,
    academicYear: string,
    publishedOnly = false,
  ) =>
    StudentMarksModel.find({
      studentId: new Types.ObjectId(studentId),
      semester,
      academicYear,
      ...(publishedOnly ? { isPublished: true } : {}),
    })
      .limit(100)
      .lean(),

  upsertMarks: (
    studentId: string,
    subjectId: string,
    examType: string,
    academicYear: string,
    data: Record<string, unknown>,
  ) =>
    StudentMarksModel.findOneAndUpdate(
      {
        studentId: new Types.ObjectId(studentId),
        subjectId: new Types.ObjectId(subjectId),
        examType,
        academicYear,
      } as unknown as Parameters<typeof StudentMarksModel.findOneAndUpdate>[0],
      { $set: data },
      { upsert: true, runValidators: true },
    ).lean(),

  bulkUpsertMarks: async (records: Array<Record<string, unknown>>) => {
    const ops = records.map((r) => ({
      updateOne: {
        filter: {
          studentId: r["studentId"],
          subjectId: r["subjectId"],
          examType: r["examType"],
          academicYear: r["academicYear"],
          isPublished: { $ne: true },
        },
        update: { $set: r, $unset: { verifiedBy: "", verifiedAt: "" } },
        upsert: true,
      },
    }));
    return StudentMarksModel.bulkWrite(ops as Parameters<typeof StudentMarksModel.bulkWrite>[0]);
  },

  listPendingVerification: (filter: Record<string, unknown> = {}) =>
    StudentMarksModel.find({
      ...filter,
      isPublished: false,
      verifiedBy: { $exists: false },
    })
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .populate("enteredBy", "name email")
      .sort({ updatedAt: 1 })
      .limit(300)
      .lean(),

  findMarksForVerification: (ids: string[]) =>
    StudentMarksModel.find({ _id: { $in: ids } })
      .select("_id enteredBy verifiedBy isPublished")
      .lean(),

  verifyMarks: (ids: string[], verifiedBy: string) =>
    StudentMarksModel.updateMany(
      {
        _id: { $in: ids },
        isPublished: false,
        verifiedBy: { $exists: false },
        enteredBy: { $ne: verifiedBy },
      },
      { $set: { verifiedBy, verifiedAt: new Date() } },
    ),

  countAttempts: (params: {
    studentId: string;
    subjectId: string;
    examType: string;
    attemptType: string;
  }) =>
    ExamAttemptModel.countDocuments({
      studentId: params.studentId,
      subjectId: params.subjectId,
      examType: params.examType,
      attemptType: params.attemptType,
    } as unknown as MongoFilter<IExamAttempt>),

  upsertAttempt: (filter: Record<string, unknown>, data: Record<string, unknown>) =>
    ExamAttemptModel.findOneAndUpdate(
      filter,
      { $set: data },
      { upsert: true, returnDocument: "after" },
    ).lean(),

  listAttempts: (filter: Record<string, unknown>) =>
    ExamAttemptModel.find(filter).sort({ createdAt: -1 }).lean(),

  // ─── Semester Result ──────────────────────────────────────────────────────

  findResult: (studentId: string, semester: number, academicYear: string, publishedOnly = false) =>
    SemesterResultModel.findOne({
      studentId,
      semester,
      academicYear,
      ...(publishedOnly ? { isPublished: true } : {}),
    }).lean(),

  findResultsByStudent: (studentId: string, publishedOnly = false) =>
    SemesterResultModel.find({ studentId, ...(publishedOnly ? { isPublished: true } : {}) })
      .sort({ semester: 1 })
      .limit(20)
      .lean(),

  upsertResult: (
    studentId: string,
    semester: number,
    academicYear: string,
    data: Record<string, unknown>,
  ) =>
    SemesterResultModel.findOneAndUpdate(
      { studentId, semester, academicYear },
      { $set: data },
      { upsert: true, runValidators: true },
    ).lean(),

  publishResults: async (
    semester: number,
    academicYear: string,
    scope: Record<string, unknown> = {},
    session?: ClientSession,
  ) => {
    return SemesterResultModel.updateMany(
      {
        semester,
        academicYear,
        isPublished: false,
        "subjectResults.0": { $exists: true },
        ...scope,
      },
      { $set: { isPublished: true, publishedAt: new Date() } },
      { session },
    );
  },

  publishMarks: (
    semester: number,
    academicYear: string,
    scope: Record<string, unknown> = {},
    session?: ClientSession,
  ) =>
    StudentMarksModel.updateMany(
      { semester, academicYear, isPublished: false, ...scope },
      { $set: { isPublished: true, publishedAt: new Date() } },
      { session },
    ),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SemesterResultModel.find(filter).sort({ rollNumber: 1 }).skip(skip).limit(limit).lean(),
      SemesterResultModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // SGPA/CGPA leaderboard — capped at 500 for ranklist display
  getRanklist: async (filter: Record<string, unknown>) => {
    return SemesterResultModel.find({
      ...filter,
      isPublished: true,
    })
      .sort({ sgpa: -1, rollNumber: 1 })
      .limit(500)
      .lean();
  },

  // ─── Recheck / Revaluation ─────────────────────────────────────────────────
  createRecheckRequest: (data: Record<string, unknown>) => {
    const { RecheckRequestModel } = require("../models/examination.model");
    return RecheckRequestModel.create(data);
  },

  findRecheckById: (id: string) => {
    const { RecheckRequestModel } = require("../models/examination.model");
    return RecheckRequestModel.findById(id).lean();
  },

  listRecheckRequests: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const { RecheckRequestModel } = require("../models/examination.model");
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      RecheckRequestModel.find(filter)
        .populate("studentId", "name email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecheckRequestModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateRecheckRequest: (id: string, data: Record<string, unknown>) => {
    const { RecheckRequestModel } = require("../models/examination.model");
    return RecheckRequestModel.findByIdAndUpdate(id, { $set: data }).lean();
  },

  transitionRecheckRequest: (
    id: string,
    filter: Record<string, unknown>,
    data: Record<string, unknown>,
    session?: import("mongoose").ClientSession,
  ) => {
    const { RecheckRequestModel } = require("../models/examination.model");
    return RecheckRequestModel.findOneAndUpdate(
      { _id: id, ...filter },
      { $set: data },
      { returnDocument: "after", runValidators: true, session },
    ).lean();
  },
};
