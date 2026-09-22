import { BookModel, BookIssueModel } from "../models";
import type { ClientSession } from "mongoose";

export const libraryRepository = {
  findBookById: (id: string) => BookModel.findById(id).lean(),

  findBookByIsbn: (isbn: string) => BookModel.findOne({ isbn }).lean(),

  createBook: (data: Record<string, unknown>) => BookModel.create(data),

  updateBook: (id: string, data: Record<string, unknown>) =>
    BookModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateBookInventoryAware: (
    id: string,
    expectedTotalCopies: number,
    expectedAvailableCopies: number,
    data: Record<string, unknown>,
  ) =>
    BookModel.findOneAndUpdate(
      {
        _id: id,
        totalCopies: expectedTotalCopies,
        availableCopies: expectedAvailableCopies,
      },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  searchBooks: async (query: string, filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const searchFilter = query ? { ...filter, $text: { $search: query } } : filter;
    const [data, total] = await Promise.all([
      BookModel.find(searchFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BookModel.countDocuments(searchFilter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  decrementAvailableCopies: (bookId: string, session?: ClientSession) =>
    BookModel.findOneAndUpdate(
      { _id: bookId, isActive: true, isDigital: false, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { returnDocument: "after", session },
    ).lean(),

  incrementAvailableCopies: (bookId: string, session?: ClientSession) =>
    BookModel.findOneAndUpdate(
      { _id: bookId, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
      { $inc: { availableCopies: 1 } },
      { returnDocument: "after", session },
    ).lean(),

  findIssueById: (id: string, session?: ClientSession) =>
    BookIssueModel.findById(id)
      .session(session ?? null)
      .lean(),

  createIssue: async (data: Record<string, unknown>, session?: ClientSession) => {
    const [issue] = await BookIssueModel.create([data], { session });
    return issue;
  },

  updateIssue: (id: string, data: Record<string, unknown>) =>
    BookIssueModel.findByIdAndUpdate(id, { $set: data }).lean(),

  returnIssue: (id: string, data: Record<string, unknown>, session?: ClientSession) =>
    BookIssueModel.findOneAndUpdate(
      { _id: id, status: { $in: ["issued", "overdue"] } },
      { $set: data, $unset: { activeKey: 1 } },
      { returnDocument: "after", session },
    ).lean(),

  renewIssue: (
    id: string,
    memberId: string | undefined,
    now: Date,
    expectedDueDate: Date,
    expectedRenewalCount: number,
    newDueDate: Date,
  ) =>
    BookIssueModel.findOneAndUpdate(
      {
        _id: id,
        status: "issued",
        dueDate: { $gte: now, $eq: expectedDueDate },
        renewalCount: { $eq: expectedRenewalCount, $lt: 2 },
        ...(memberId ? { memberId } : {}),
      },
      { $set: { dueDate: newDueDate }, $inc: { renewalCount: 1 } },
      { returnDocument: "after" },
    ).lean(),

  recordFinePayment: (
    id: string,
    amount: number,
    payment: Record<string, unknown>,
    session?: ClientSession,
  ) =>
    BookIssueModel.findOneAndUpdate(
      {
        _id: id,
        status: "returned",
        $expr: { $gte: [{ $subtract: ["$fineAmount", "$finePaid"] }, amount] },
      },
      { $inc: { finePaid: amount }, $push: { finePayments: payment } },
      { returnDocument: "after", session },
    ).lean(),

  normalizeLegacyFine: (id: string, session?: ClientSession) =>
    BookIssueModel.findOneAndUpdate(
      { _id: id, fineAmount: { $exists: false } },
      [
        {
          $set: {
            fineAmount: { $ifNull: ["$finePaid", 0] },
            finePaid: 0,
            finePayments: { $ifNull: ["$finePayments", []] },
          },
        },
      ],
      { returnDocument: "after", session },
    ).lean(),

  findActiveIssues: (memberId: string) =>
    BookIssueModel.find({ memberId, status: { $in: ["issued", "overdue"] } })
      .populate("bookId", "title isbn authors")
      .lean(),

  findActiveIssueForBook: (bookId: string, memberId: string) =>
    BookIssueModel.exists({ bookId, memberId, status: { $in: ["issued", "overdue"] } }),

  listIssues: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      BookIssueModel.find(filter)
        .populate("bookId", "title isbn authors")
        .populate("memberId", "name email")
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BookIssueModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getOverdueIssues: () =>
    BookIssueModel.find({ status: { $in: ["issued", "overdue"] }, dueDate: { $lt: new Date() } })
      .populate("bookId memberId")
      .lean(),
};
