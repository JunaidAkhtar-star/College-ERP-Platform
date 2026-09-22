import { Types } from "mongoose";
import { MeetingModel, type MeetingStatus } from "../models";

export const meetingRepository = {
  findById: (id: string) =>
    MeetingModel.findById(id)
      .populate("conductedBy", "name email")
      .populate("department", "name code")
      .populate("invitees", "name email")
      .populate("targetDepartments", "name code")
      .populate("attendees.userId", "name email studentId facultyId")
      .lean(),

  create: (data: Record<string, unknown>) => MeetingModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    MeetingModel.findOneAndUpdate(
      { _id: id, status: "scheduled" },
      { $set: { ...data, reminderSent10m: false } },
      { returnDocument: "after" },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      MeetingModel.find(filter)
        .populate("conductedBy", "name email")
        .populate("department", "name code")
        .populate("targetDepartments", "name code")
        .populate("attendees.userId", "name email studentId facultyId")
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MeetingModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  /** Meetings visible to a specific invitee (faculty meeting) */
  listForInvitee: async (userId: string, page = 1, limit = 20, status?: MeetingStatus) => {
    const personId = new Types.ObjectId(userId);
    const filter = {
      $or: [{ invitees: personId }, { conductedBy: personId }, { createdBy: personId }],
      isDeleted: false,
      ...(status ? { status } : {}),
    };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      MeetingModel.find(filter)
        .populate("conductedBy", "name email")
        .populate("department", "name code")
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MeetingModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  /** Student meetings matching department + year */
  listForStudent: async (
    departmentId: string,
    year: number,
    page = 1,
    limit = 20,
    status?: MeetingStatus,
  ) => {
    const query = {
      meetingType: "student" as const,
      isDeleted: false,
      ...(status ? { status } : {}),
      $and: [
        {
          $or: [
            { targetDepartments: new Types.ObjectId(departmentId) },
            { targetDepartments: { $size: 0 } },
          ],
        },
        {
          $or: [{ targetYears: year }, { targetYears: { $size: 0 } }],
        },
      ],
    };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      MeetingModel.find(query)
        .populate("conductedBy", "name email")
        .populate("targetDepartments", "name code")
        .populate("attendees.userId", "name email studentId facultyId")
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MeetingModel.countDocuments(query),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateStatus: (id: string, from: MeetingStatus[], status: MeetingStatus) =>
    MeetingModel.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      {
        $set: {
          status,
          ...(status === "ongoing" ? { startedAt: new Date(), endedAt: null } : {}),
          ...(status === "completed" || status === "cancelled" ? { endedAt: new Date() } : {}),
        },
      },
      { returnDocument: "after" },
    ).lean(),

  submitConcludingRemarks: (id: string, remarks: string, submittedBy: string) =>
    MeetingModel.findOneAndUpdate(
      { _id: id, status: "ongoing" },
      {
        $set: {
          concludingRemarks: remarks,
          concludingRemarksSubmittedAt: new Date(),
          minutesStatus: "pending_approval",
          minutesSubmittedBy: submittedBy,
          status: "completed" as MeetingStatus,
          endedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean(),

  markNotified: (id: string) =>
    MeetingModel.findByIdAndUpdate(id, { $set: { notifiedAt: new Date() } }).lean(),

  markAttendance: (meetingId: string, userId: string) =>
    MeetingModel.updateOne(
      { _id: meetingId, "attendees.userId": userId },
      { $set: { "attendees.$.attended": true, "attendees.$.joinedAt": new Date() } },
    ),

  addAttendee: (meetingId: string, userId: string) =>
    MeetingModel.findByIdAndUpdate(
      meetingId,
      {
        $addToSet: {
          attendees: { userId: new Types.ObjectId(userId), attended: true, joinedAt: new Date() },
        },
      },
      {},
    ).lean(),

  cancel: (id: string, updatedBy: string) =>
    MeetingModel.findOneAndUpdate(
      { _id: id, status: "scheduled" },
      { $set: { status: "cancelled", updatedBy } },
      { returnDocument: "after" },
    ).lean(),
};
