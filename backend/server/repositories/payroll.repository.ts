import { PayslipModel } from "../models";
import type { ClientSession } from "mongoose";

export const payrollRepository = {
  findById: (id: string) => PayslipModel.findById(id).lean(),

  findByEmployeeMonthYear: (employeeId: string, month: number, year: number) =>
    PayslipModel.findOne({ employeeId, month, year }).lean(),

  create: (data: Record<string, unknown>) => PayslipModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    PayslipModel.findByIdAndUpdate(id, { $set: data }).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PayslipModel.find(filter)
        .populate("departmentId", "name code")
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PayslipModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  markPaid: (id: string, paymentDate: Date, paymentMode: string, session?: ClientSession) =>
    PayslipModel.findOneAndUpdate(
      { _id: id, isPaid: false, status: "approved" },
      { $set: { isPaid: true, status: "paid", paymentDate, paymentMode } },
      { returnDocument: "after", session },
    ).lean(),

  getSummary: (month: number, year: number) =>
    PayslipModel.aggregate([
      { $match: { month, year, isGenerated: true } },
      {
        $group: {
          _id: null,
          totalGross: { $sum: "$grossPay" },
          totalNet: { $sum: "$netPay" },
          totalPF: { $sum: "$pfAmount" },
          totalTDS: { $sum: "$tdsAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
};
