import { Types } from "mongoose";
import { FacultyAttendanceModel } from "../models";

export const facultyAttendanceRepository = {
  findById: (id: string) => FacultyAttendanceModel.findById(id).lean(),

  findByFacultyDate: (facultyId: string, date: Date) =>
    FacultyAttendanceModel.findOne({ facultyId, date }).lean(),

  create: (data: Record<string, unknown>) => FacultyAttendanceModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    FacultyAttendanceModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateUnlockedById: (id: string, data: Record<string, unknown>) =>
    FacultyAttendanceModel.findOneAndUpdate(
      { _id: id, isLocked: false },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 31) => {
    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      FacultyAttendanceModel.find(filter)
        .populate("facultyId", "name email employeeId")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FacultyAttendanceModel.countDocuments(filter),
    ]);
    const data = records.map((record) => ({
      ...record,
      facultyName:
        typeof record.facultyId === "object" && "name" in record.facultyId
          ? String(record.facultyId.name)
          : undefined,
    }));
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getMonthlySummary: (facultyId: string, month: number, year: number) =>
    FacultyAttendanceModel.aggregate([
      {
        $match: {
          facultyId: new Types.ObjectId(facultyId),
          $expr: {
            $and: [{ $eq: [{ $month: "$date" }, month] }, { $eq: [{ $year: "$date" }, year] }],
          },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

  /** Department-level summary for HOD over the exact reporting window shown in the UI. */
  getDepartmentSummary: (
    departmentId: string,
    month: number,
    year: number,
    startDate?: Date,
    endDate?: Date,
  ) =>
    FacultyAttendanceModel.aggregate([
      {
        $match: {
          departmentId: new Types.ObjectId(departmentId),
          ...(startDate && endDate
            ? { date: { $gte: startDate, $lte: endDate } }
            : {
                $expr: {
                  $and: [
                    { $eq: [{ $month: "$date" }, month] },
                    { $eq: [{ $year: "$date" }, year] },
                  ],
                },
              }),
        },
      },
      {
        $group: {
          _id: "$facultyId",
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
          },
          halfDay: { $sum: { $cond: [{ $eq: ["$status", "half_day"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          onLeave: { $sum: { $cond: [{ $eq: ["$status", "on_leave"] }, 1, 0] } },
        },
      },
      {
        $addFields: {
          eligibleDays: { $subtract: ["$total", "$onLeave"] },
          attendanceEquivalent: { $add: ["$present", { $multiply: ["$halfDay", 0.5] }] },
          attendancePercent: {
            $multiply: [
              {
                $divide: [
                  { $add: ["$present", { $multiply: ["$halfDay", 0.5] }] },
                  { $max: [{ $subtract: ["$total", "$onLeave"] }, 1] },
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "faculty",
          pipeline: [{ $project: { name: 1, email: 1, employeeId: 1 } }],
        },
      },
      { $unwind: { path: "$faculty", preserveNullAndEmptyArrays: true } },
      { $sort: { attendancePercent: 1 } },
    ]),
};
