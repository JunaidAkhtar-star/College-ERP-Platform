import type { MongoFilter } from "../types/mongoose.types";
import type { ITimetable } from "../models/timetable.model";
import { TimetableModel } from "../models/timetable.model";
import type { ClientSession } from "mongoose";

export const timetableRepository = {
  findById: (id: string, session?: ClientSession) =>
    TimetableModel.findById(id)
      .session(session ?? null)
      .lean(),

  findOne: (filter: Record<string, unknown>) =>
    TimetableModel.findOne(filter)
      .populate("sectionId", "sectionName semesterNo academicYear")
      .populate("batchId", "name admissionYear")
      .populate("curriculumId", "program regulationYear")
      .populate("slots.subjectId", "name code")
      .populate("slots.facultyId", "name")
      .lean(),

  create: (data: Record<string, unknown>, session?: ClientSession) =>
    new TimetableModel(data).save({ session }),

  updateById: (id: string, data: Record<string, unknown>, session?: ClientSession) =>
    TimetableModel.findOneAndUpdate(
      { _id: id, isApproved: false },
      { $set: data },
      { returnDocument: "after", runValidators: true, session },
    ).lean(),

  updatePublicationDetails: (id: string, data: Record<string, unknown>) =>
    TimetableModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  approve: (id: string, approvedBy: string, session?: ClientSession) =>
    TimetableModel.findOneAndUpdate(
      { _id: id, isApproved: false, isActive: true, "slots.0": { $exists: true } },
      { $set: { isApproved: true, approvedBy, approvedAt: new Date() } },
      { returnDocument: "after", runValidators: true, session },
    ).lean(),

  pushSubstitute: (id: string, entry: Record<string, unknown>, session?: ClientSession) =>
    TimetableModel.findByIdAndUpdate(
      id,
      { $push: { substituteLog: entry } },
      { returnDocument: "after", runValidators: true, session },
    ).lean(),

  cancelSubstitute: (
    id: string,
    substituteEntryId: string,
    cancelledBy: string,
    cancellationReason: string,
  ) =>
    TimetableModel.findOneAndUpdate(
      {
        _id: id,
        isApproved: true,
        isActive: true,
        substituteLog: { $elemMatch: { _id: substituteEntryId, status: { $ne: "cancelled" } } },
      },
      {
        $set: {
          "substituteLog.$.status": "cancelled",
          "substituteLog.$.cancelledBy": cancelledBy,
          "substituteLog.$.cancelledAt": new Date(),
          "substituteLog.$.cancellationReason": cancellationReason,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  deleteById: (id: string) => TimetableModel.findByIdAndDelete(id).lean(),

  archive: (id: string, updatedBy: string) =>
    TimetableModel.findOneAndUpdate(
      { _id: id, isApproved: true, isActive: true },
      { $set: { isActive: false, updatedBy } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TimetableModel.find(filter)
        .populate("sectionId", "sectionName semesterNo academicYear")
        .populate("batchId", "name admissionYear")
        .populate("curriculumId", "program regulationYear")
        .populate("departmentId", "name code")
        .populate("substituteLog.substituteFacultyId", "name")
        .sort({ academicYear: -1, semester: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TimetableModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getFacultyTimetable: (
    facultyId: string,
    academicYear: string,
    semesterType: string,
    departmentId?: string,
  ) =>
    TimetableModel.find({
      academicYear,
      semesterType,
      "slots.facultyId": facultyId,
      ...(departmentId ? { $or: [{ departmentId }, { branchDepartmentIds: departmentId }] } : {}),
      isApproved: true,
      isActive: true,
    } as unknown as MongoFilter<ITimetable>)
      .populate("sectionId", "sectionName semesterNo academicYear")
      .populate("batchId", "name admissionYear")
      .populate("departmentId", "name code")
      .lean(),

  findSubstituteAssignments: (
    facultyId: string,
    dateStart: Date,
    dateEnd: Date,
    session?: ClientSession,
  ) =>
    TimetableModel.find({
      substituteLog: {
        $elemMatch: {
          substituteFacultyId: facultyId,
          date: { $gte: dateStart, $lt: dateEnd },
        },
      },
    })
      .select("slots substituteLog")
      .session(session ?? null)
      .lean(),

  // Find all timetables that have a slot with the given faculty on the same day/time
  findFacultyConflicts: (
    facultySlots: Array<{ facultyId: string; day: string }>,
    academicYear: string,
    semesterType: string,
    excludeId?: string,
    session?: ClientSession,
  ) => {
    const orConditions = facultySlots.map((s) => ({
      "slots.facultyId": s.facultyId,
      "slots.day": s.day,
    }));
    const base: Record<string, unknown> = { academicYear, semesterType, $or: orConditions };
    if (excludeId) base["_id"] = { $ne: excludeId };
    return TimetableModel.find(base as MongoFilter<ITimetable>)
      .select("program semester section slots")
      .session(session ?? null)
      .lean();
  },

  // Find all timetables that have a slot in the same room on the same day/time
  findRoomConflicts: (
    roomSlots: Array<{ roomNo: string; day: string }>,
    academicYear: string,
    semesterType: string,
    excludeId?: string,
    session?: ClientSession,
  ) => {
    const orConditions = roomSlots.map((s) => ({
      "slots.roomNo": s.roomNo,
      "slots.day": s.day,
    }));
    const base: Record<string, unknown> = { academicYear, semesterType, $or: orConditions };
    if (excludeId) base["_id"] = { $ne: excludeId };
    return TimetableModel.find(base as MongoFilter<ITimetable>)
      .select("program semester section slots")
      .session(session ?? null)
      .lean();
  },

  findAll: (filter: MongoFilter<ITimetable>) => TimetableModel.find(filter).select("slots").lean(),
};
