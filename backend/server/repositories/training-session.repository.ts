import { TrainingSessionModel, TrainingSessionStatus } from "../models/training-session.model";

export const trainingSessionRepository = {
  findById: (id: string) =>
    TrainingSessionModel.findById(id).populate("createdBy", "name email").lean(),

  findAll: (filter: Record<string, unknown> = {}) =>
    TrainingSessionModel.find(filter).sort({ scheduledDate: -1 }).lean(),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TrainingSessionModel.find(filter)
        .populate("createdBy", "name")
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrainingSessionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  create: (data: Record<string, unknown>) => TrainingSessionModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    TrainingSessionModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  transition: (id: string, from: TrainingSessionStatus, data: Record<string, unknown>) =>
    TrainingSessionModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  deleteDraft: (id: string) =>
    TrainingSessionModel.findOneAndDelete({
      _id: id,
      status: TrainingSessionStatus.DRAFT,
      registeredStudents: { $size: 0 },
    }).lean(),

  registerStudent: (id: string, studentId: string, now: Date) =>
    TrainingSessionModel.findOneAndUpdate(
      {
        _id: id,
        status: TrainingSessionStatus.SCHEDULED,
        registrationStart: { $lte: now },
        registrationEnd: { $gte: now },
        registeredStudents: { $ne: studentId },
        $or: [
          { maxParticipants: { $exists: false } },
          { maxParticipants: null },
          { $expr: { $lt: [{ $size: "$registeredStudents" }, "$maxParticipants"] } },
        ],
      },
      { $addToSet: { registeredStudents: studentId } },
      { returnDocument: "after" },
    ).lean(),

  unregisterStudent: (id: string, studentId: string) =>
    TrainingSessionModel.findOneAndUpdate(
      {
        _id: id,
        status: TrainingSessionStatus.SCHEDULED,
        registrationEnd: { $gte: new Date() },
        registeredStudents: studentId,
      },
      { $pull: { registeredStudents: studentId } },
      { returnDocument: "after" },
    ).lean(),

  /** Get sessions for a specific student (registered). */
  findByStudent: (studentId: string) =>
    TrainingSessionModel.find({ registeredStudents: studentId }).sort({ scheduledDate: -1 }).lean(),

  /** Upcoming sessions in next N days. */
  findUpcoming: (days = 7) => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);
    return TrainingSessionModel.find({
      scheduledDate: { $gte: from, $lte: to },
      status: TrainingSessionStatus.SCHEDULED,
    })
      .sort({ scheduledDate: 1 })
      .lean();
  },

  getStats: async () => {
    const [summary, statuses, types, modes, monthly] = await Promise.all([
      TrainingSessionModel.aggregate<{
        _id: null;
        sessions: number;
        registrations: number;
        capacity: number;
        present: number;
        absent: number;
        trainingMinutes: number;
        averageRating: number;
      }>([
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            registrations: { $sum: { $size: "$registeredStudents" } },
            capacity: { $sum: { $ifNull: ["$maxParticipants", 0] } },
            present: { $sum: "$totalPresent" },
            absent: { $sum: "$totalAbsent" },
            trainingMinutes: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$duration", 0] },
            },
            averageRating: { $avg: "$averageRating" },
          },
        },
      ]),
      TrainingSessionModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      TrainingSessionModel.aggregate<{ _id: string; count: number; registrations: number }>([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            registrations: { $sum: { $size: "$registeredStudents" } },
          },
        },
        { $sort: { registrations: -1 } },
      ]),
      TrainingSessionModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$mode", count: { $sum: 1 } } },
      ]),
      TrainingSessionModel.aggregate<{
        _id: string;
        sessions: number;
        registrations: number;
        attendance: number;
      }>([
        {
          $match: {
            scheduledDate: {
              $gte: new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1),
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$scheduledDate" } },
            sessions: { $sum: 1 },
            registrations: { $sum: { $size: "$registeredStudents" } },
            attendance: { $sum: "$totalPresent" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const totals = summary[0] ?? {
      sessions: 0,
      registrations: 0,
      capacity: 0,
      present: 0,
      absent: 0,
      trainingMinutes: 0,
      averageRating: 0,
    };
    return {
      ...totals,
      ...Object.fromEntries(statuses.map((row) => [row._id, row.count])),
      capacityUtilization: totals.capacity ? (totals.registrations / totals.capacity) * 100 : 0,
      attendanceRate:
        totals.present + totals.absent
          ? (totals.present / (totals.present + totals.absent)) * 100
          : 0,
      types: types.map((row) => ({
        type: row._id,
        sessions: row.count,
        registrations: row.registrations,
      })),
      modes: modes.map((row) => ({ mode: row._id, count: row.count })),
      monthly: monthly.map((row) => ({
        month: row._id,
        sessions: row.sessions,
        registrations: row.registrations,
        attendance: row.attendance,
      })),
    };
  },
};
