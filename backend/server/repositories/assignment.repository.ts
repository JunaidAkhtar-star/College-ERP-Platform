import { AssignmentModel } from "../models";
import { AssignmentStatus } from "../models/assignment.model";
import type { UpdateQuery } from "mongoose";
import type { IAssignment } from "../models/assignment.model";
import type { MongoFilter } from "../types/mongoose.types";

export const assignmentRepository = {
  findById: (id: string) => AssignmentModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => AssignmentModel.create(data),

  updateDraft: (id: string, data: Record<string, unknown>) =>
    AssignmentModel.findOneAndUpdate(
      { _id: id, status: AssignmentStatus.DRAFT },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  publish: (id: string, facultyId?: string) =>
    AssignmentModel.findOneAndUpdate(
      {
        _id: id,
        status: AssignmentStatus.DRAFT,
        ...(facultyId ? { facultyId } : {}),
      },
      { $set: { status: AssignmentStatus.PUBLISHED, publishedAt: new Date(), isActive: true } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  close: (id: string, facultyId?: string) =>
    AssignmentModel.findOneAndUpdate(
      {
        _id: id,
        status: AssignmentStatus.PUBLISHED,
        ...(facultyId ? { facultyId } : {}),
      },
      { $set: { status: AssignmentStatus.CLOSED, closedAt: new Date(), isActive: false } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  markEvaluated: (id: string) =>
    AssignmentModel.findOneAndUpdate(
      {
        _id: id,
        status: AssignmentStatus.CLOSED,
        "submissions.0": { $exists: true },
        submissions: { $not: { $elemMatch: { marks: { $exists: false } } } },
      },
      { $set: { status: AssignmentStatus.EVALUATED } },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const summaryFilter = { ...filter };
    delete summaryFilter.status;
    const [data, total, statusSummary] = await Promise.all([
      AssignmentModel.find(filter)
        .select("-submissions")
        .populate("subjectId", "name code")
        .populate("createdBy", "name email")
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AssignmentModel.countDocuments(filter),
      AssignmentModel.aggregate<{ _id: AssignmentStatus; count: number }>([
        { $match: summaryFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    const statusCounts = Object.fromEntries(statusSummary.map((item) => [item._id, item.count]));
    return { data, total, page, limit, pages: Math.ceil(total / limit), statusCounts };
  },

  findStudentSubmissions: (assignmentIds: string[], studentId: string) =>
    AssignmentModel.find({
      _id: { $in: assignmentIds },
      submissions: { $elemMatch: { studentId } },
    })
      .select({ _id: 1, submissions: { $elemMatch: { studentId } } })
      .lean(),

  addSubmission: (assignmentId: string, submission: Record<string, unknown>, submittedAt: Date) =>
    AssignmentModel.findOneAndUpdate(
      {
        _id: assignmentId,
        status: AssignmentStatus.PUBLISHED,
        isActive: true,
        "submissions.studentId": { $ne: submission["studentId"] },
        $or: [{ dueDate: { $gte: submittedAt } }, { allowLateSubmission: true }],
      } as MongoFilter<IAssignment>,
      {
        $push: { submissions: submission },
        $inc: { totalSubmissions: 1 },
      } as UpdateQuery<IAssignment>,
      { returnDocument: "after", runValidators: true },
    ).lean(),

  updateSubmission: (assignmentId: string, studentId: string, update: Record<string, unknown>) =>
    AssignmentModel.findOneAndUpdate(
      { _id: assignmentId, "submissions.studentId": studentId },
      {
        $set: Object.fromEntries(
          Object.entries(update).map(([key, value]) => [`submissions.$.${key}`, value]),
        ),
      },
      { returnDocument: "after" },
    ).lean(),

  gradeSubmission: (
    assignmentId: string,
    studentId: string,
    update: Record<string, unknown>,
    history: Record<string, unknown>,
  ) =>
    AssignmentModel.findOneAndUpdate(
      {
        _id: assignmentId,
        status: { $in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] },
        "submissions.studentId": studentId,
      },
      {
        $set: Object.fromEntries(
          Object.entries(update).map(([key, value]) => [`submissions.$.${key}`, value]),
        ),
        $push: { "submissions.$.gradingHistory": history },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),
};
