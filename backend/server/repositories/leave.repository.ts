import { LeaveRequestModel, LeaveBalanceModel } from "../models";
import type { ClientSession } from "mongoose";

export const leaveRepository = {
  findRequestById: (id: string) => LeaveRequestModel.findById(id).lean(),

  createRequest: (data: Record<string, unknown>) => LeaveRequestModel.create(data),

  updateRequestById: (id: string, data: Record<string, unknown>) =>
    LeaveRequestModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean(),

  transitionRequest: (
    id: string,
    filter: Record<string, unknown>,
    data: Record<string, unknown>,
    session?: ClientSession,
  ) =>
    LeaveRequestModel.findOneAndUpdate(
      { _id: id, ...filter },
      { $set: data },
      { returnDocument: "after", session },
    ).lean(),

  listRequests: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      LeaveRequestModel.find(filter)
        .populate("employeeId", "name email")
        .populate("departmentId", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LeaveRequestModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  findBalance: (employeeId: string, academicYear: string) =>
    LeaveBalanceModel.findOne({ employeeId, academicYear }).lean(),

  upsertBalance: (employeeId: string, academicYear: string, data: Record<string, unknown>) =>
    LeaveBalanceModel.findOneAndUpdate(
      { employeeId, academicYear },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true },
    ).lean(),

  decrementBalance: (
    employeeId: string,
    academicYear: string,
    leaveType: string,
    days: number,
    session?: ClientSession,
  ) => {
    const fieldMap: Record<string, string> = {
      casual: "casual",
      sick: "sick",
      earned: "earned",
      on_duty: "onDuty",
    };
    const allowanceField = fieldMap[leaveType];
    if (!allowanceField) return Promise.resolve(null);
    const usedField = `${allowanceField}Used`;
    return LeaveBalanceModel.findOneAndUpdate(
      {
        employeeId,
        academicYear,
        $expr: { $gte: [{ $subtract: [`$${allowanceField}`, `$${usedField}`] }, days] },
      },
      { $inc: { [usedField]: days }, $set: { updatedAt: new Date() } },
      { returnDocument: "after", session },
    ).lean();
  },
};
