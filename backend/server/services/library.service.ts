import { libraryRepository } from "../repositories";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import createError from "http-errors";
import mongoose from "mongoose";
import { FacultyProfileModel, FacultyStatus, StudentProfileModel, StudentStatus } from "../models";
import { v4 as uuidv4 } from "uuid";
import { generalLedgerService } from "./general-ledger.service";
import { formatIndiaDate } from "../utils/date.util";

const FINE_PER_DAY = 2; // Rs. 2 per day
const MAX_RENEWALS = 2;
const ISSUE_DAYS = 14;
type CreatedIssue = Awaited<ReturnType<typeof libraryRepository.createIssue>>;
type UpdatedBook = NonNullable<
  Awaited<ReturnType<typeof libraryRepository.decrementAvailableCopies>>
>;
type ReturnedIssue = NonNullable<Awaited<ReturnType<typeof libraryRepository.returnIssue>>>;

export function calculateLibraryFine(dueDate: Date, returnDate: Date, finePerDay = FINE_PER_DAY) {
  if (returnDate <= dueDate) return { overdueDays: 0, fineAmount: 0 };
  const overdueDays = Math.ceil((returnDate.getTime() - dueDate.getTime()) / 86400000);
  return { overdueDays, fineAmount: overdueDays * finePerDay };
}

function financialYearForDate(date: Date) {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export const libraryService = {
  searchBooks: (query: string, filter: Record<string, unknown>, page: number, limit: number) =>
    libraryRepository.searchBooks(query, filter, page, limit),

  getBookById: (id: string) => libraryRepository.findBookById(id),

  addBook: (data: Record<string, unknown>) => {
    const isDigital = Boolean(data["isDigital"]);
    const totalCopies = isDigital ? 0 : Number(data["totalCopies"]);
    if (!isDigital && (!Number.isInteger(totalCopies) || totalCopies < 1)) {
      throw createError(400, "A physical book requires at least one copy");
    }
    return libraryRepository.createBook({
      ...data,
      totalCopies,
      availableCopies: totalCopies,
    });
  },

  updateBook: async (id: string, data: Record<string, unknown>) => {
    const book = await libraryRepository.findBookById(id);
    if (!book) throw createError(404, "Book not found");
    const editable = [
      "title",
      "authors",
      "publisher",
      "publicationYear",
      "edition",
      "category",
      "subject",
      "language",
      "totalCopies",
      "shelfLocation",
      "coverImageUrl",
      "digitalUrl",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => editable.includes(key)),
    );
    if (data["totalCopies"] !== undefined) {
      const totalCopies = Number(data["totalCopies"]);
      const issuedCopies = book.totalCopies - book.availableCopies;
      if (!Number.isInteger(totalCopies) || totalCopies < issuedCopies) {
        throw createError(
          409,
          `Total copies cannot be lower than ${issuedCopies} currently issued copy/copies`,
        );
      }
      update["totalCopies"] = totalCopies;
      update["availableCopies"] = totalCopies - issuedCopies;
    }
    const updated = await libraryRepository.updateBookInventoryAware(
      id,
      book.totalCopies,
      book.availableCopies,
      update,
    );
    if (!updated) throw createError(409, "Book inventory changed; refresh and try again");
    return updated;
  },

  issueBook: async (
    bookId: string,
    memberId: string,
    memberType: "student" | "faculty",
    issuedBy: string,
  ) => {
    const memberExists =
      memberType === "student"
        ? await StudentProfileModel.exists({ userId: memberId, status: StudentStatus.ACTIVE })
        : await FacultyProfileModel.exists({ userId: memberId, status: FacultyStatus.ACTIVE });
    if (!memberExists) throw createError(400, `An active ${memberType} profile is required`);
    if (await libraryRepository.findActiveIssueForBook(bookId, memberId)) {
      throw createError(409, "This member already has an active issue for this book");
    }
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + ISSUE_DAYS);

    const session = await mongoose.startSession();
    let issue: Awaited<ReturnType<typeof libraryRepository.createIssue>> | null = null;
    let book: Awaited<ReturnType<typeof libraryRepository.decrementAvailableCopies>> = null;
    try {
      await session.withTransaction(async () => {
        book = await libraryRepository.decrementAvailableCopies(bookId, session);
        if (!book) throw createError(409, "Book is not available for issue");
        issue = await libraryRepository.createIssue(
          {
            bookId,
            memberId,
            memberType,
            issueDate,
            dueDate,
            issuedBy,
            activeKey: `${memberId}:${bookId}`,
          },
          session,
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "This member already has an active issue for this book");
      }
      throw error;
    } finally {
      await session.endSession();
    }
    const completedIssue = issue as unknown as CreatedIssue;
    const issuedBook = book as unknown as UpdatedBook;
    if (!completedIssue || !issuedBook)
      throw createError(500, "Book issue transaction did not complete");
    void notifyUsers([memberId], {
      title: "Book issued",
      body: `"${issuedBook.title ?? "A book"}" has been issued to you. Due by ${formatIndiaDate(dueDate)}.`,
      type: NotificationType.INFO,
      actionUrl: "/student/library",
    });
    return completedIssue;
  },

  returnBook: async (issueId: string, returnedTo: string) => {
    const returnDate = new Date();
    const session = await mongoose.startSession();
    let returned: Awaited<ReturnType<typeof libraryRepository.returnIssue>> = null;
    let overdueDays = 0;
    let fineAmount = 0;
    try {
      await session.withTransaction(async () => {
        const issue = await libraryRepository.findIssueById(issueId, session);
        if (!issue || !["issued", "overdue"].includes(issue.status)) {
          throw createError(409, "Issue record is already returned or finalized");
        }
        ({ overdueDays, fineAmount } = calculateLibraryFine(new Date(issue.dueDate), returnDate));
        returned = await libraryRepository.returnIssue(
          issueId,
          {
            status: "returned",
            returnDate,
            fineAmount,
            finePaid: 0,
            returnedTo,
          },
          session,
        );
        if (!returned) throw createError(409, "Issue record was finalized concurrently");
        const book = await libraryRepository.incrementAvailableCopies(
          issue.bookId.toString(),
          session,
        );
        if (!book) throw createError(409, "Book inventory is inconsistent with this issue");
      });
    } finally {
      await session.endSession();
    }
    const completedReturn = returned as unknown as ReturnedIssue;
    if (!completedReturn) throw createError(500, "Book return transaction did not complete");
    void notifyUsers([completedReturn.memberId.toString()], {
      title: fineAmount > 0 ? "Book returned — fine due" : "Book returned",
      body:
        fineAmount > 0
          ? `Returned with ${overdueDays} day(s) overdue. Fine due: ₹${fineAmount}.`
          : "Thanks for returning the book on time.",
      type: fineAmount > 0 ? NotificationType.WARNING : NotificationType.SUCCESS,
      actionUrl: "/student/library",
      withEmail: fineAmount > 0,
    });
    return { issue: completedReturn, overdueDays, fineAmount, finePaid: 0 };
  },

  renewBook: async (issueId: string, requesterId: string, canManageAll: boolean) => {
    const issue = await libraryRepository.findIssueById(issueId);
    if (!issue) throw createError(404, "Issue not found");
    if (!canManageAll && issue.memberId.toString() !== requesterId) {
      throw createError(403, "You can renew only your own issued books");
    }
    if (issue.status !== "issued") throw createError(409, "Only an active issue can be renewed");
    if (new Date(issue.dueDate) < new Date()) {
      throw createError(409, "Overdue books must be returned and cannot be renewed");
    }
    if (issue.renewalCount >= MAX_RENEWALS) throw createError(409, "Maximum renewals reached");
    const newDueDate = new Date(issue.dueDate);
    newDueDate.setDate(newDueDate.getDate() + ISSUE_DAYS);
    const updated = await libraryRepository.renewIssue(
      issueId,
      canManageAll ? undefined : requesterId,
      new Date(),
      new Date(issue.dueDate),
      issue.renewalCount,
      newDueDate,
    );
    if (!updated) throw createError(409, "Issue changed concurrently; refresh and try again");
    void notifyUsers([issue.memberId as unknown as string], {
      title: "Book renewed",
      body: `Renewal successful. New due date: ${formatIndiaDate(newDueDate)}.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/student/library",
    });
    return updated;
  },

  collectFine: async (
    issueId: string,
    amount: number,
    paymentMode: "cash" | "bank_transfer" | "upi",
    collectedBy: string,
    referenceNo?: string,
  ) => {
    const normalizedAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    if (normalizedAmount <= 0) throw createError(400, "Fine payment amount must be positive");
    const paidAt = new Date();
    const paymentId = `LIBF-${uuidv4().split("-")[0].toUpperCase()}`;
    const session = await mongoose.startSession();
    let updated: Awaited<ReturnType<typeof libraryRepository.recordFinePayment>> = null;
    try {
      await session.withTransaction(async () => {
        await libraryRepository.normalizeLegacyFine(issueId, session);
        const issue = await libraryRepository.findIssueById(issueId, session);
        if (!issue) throw createError(404, "Issue not found");
        if (issue.status !== "returned") {
          throw createError(409, "Fine can be collected only after the book is returned");
        }
        const outstanding =
          Math.round((issue.fineAmount - issue.finePaid + Number.EPSILON) * 100) / 100;
        if (normalizedAmount > outstanding) {
          throw createError(400, `Fine payment exceeds outstanding amount of ₹${outstanding}`);
        }
        updated = await libraryRepository.recordFinePayment(
          issueId,
          normalizedAmount,
          { paymentId, amount: normalizedAmount, paymentMode, referenceNo, paidAt, collectedBy },
          session,
        );
        if (!updated) throw createError(409, "Fine balance changed; refresh and try again");
        await generalLedgerService.postLibraryFineCollection(
          {
            issueId,
            memberId: issue.memberId,
            paymentId,
            amount: normalizedAmount,
            paymentMode,
            paymentDate: paidAt,
            financialYear: financialYearForDate(paidAt),
            postedBy: collectedBy,
            referenceNo,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (!updated) throw createError(500, "Fine payment transaction did not complete");
    return { issue: updated, paymentId, amount: normalizedAmount };
  },

  getMemberActiveIssues: (memberId: string) => libraryRepository.findActiveIssues(memberId),

  listIssues: (filter: Record<string, unknown>, page: number, limit: number) =>
    libraryRepository.listIssues(filter, page, limit),

  getOverdueIssues: () => libraryRepository.getOverdueIssues(),

  // Digital library resources
  addDigitalResource: (data: Record<string, unknown>) =>
    libraryService.addBook({ ...data, isDigital: true }),

  listDigitalResources: (query: string, category: string, page: number, limit: number) =>
    libraryRepository.searchBooks(
      query,
      { isDigital: true, ...(category ? { category } : {}) },
      page,
      limit,
    ),
};
