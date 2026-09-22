import { AccountsTransactionModel } from "../models";

export const accountsRepository = {
  findById: (id: string) => AccountsTransactionModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => AccountsTransactionModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    AccountsTransactionModel.findByIdAndUpdate(id, { $set: data }).lean(),

  deleteById: (id: string) => AccountsTransactionModel.findByIdAndDelete(id).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AccountsTransactionModel.find(filter)
        .populate("departmentId", "name code")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AccountsTransactionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getSummaryByCategory: (financialYear: string) =>
    AccountsTransactionModel.aggregate([
      { $match: { financialYear } },
      {
        $group: {
          _id: { type: "$transactionType", category: "$category" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.type": 1, total: -1 } },
    ]),

  getMonthlyFlow: (financialYear: string) =>
    AccountsTransactionModel.aggregate([
      { $match: { financialYear } },
      {
        $group: {
          _id: {
            type: "$transactionType",
            month: { $month: "$date" },
            year: { $year: "$date" },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

  getBalance: async (financialYear: string) => {
    const result = await AccountsTransactionModel.aggregate([
      { $match: { financialYear } },
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: "$amount" },
        },
      },
    ]);
    const income = result.find((r) => r._id === "income")?.total ?? 0;
    const expense = result.find((r) => r._id === "expense")?.total ?? 0;
    return { income, expense, balance: income - expense };
  },
};
