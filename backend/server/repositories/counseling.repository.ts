import type { Types } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import {
  type ICounselingSession,
  CounselingSessionModel,
  CounselingStatus,
} from "../models/counseling-session.model";
import type { PaginationQuery } from "../types";
import { buildPaginated, parsePagination } from "../utils/pagination.util";

export const counselingRepository = {
  async findById(id: string | Types.ObjectId, includeSensitiveNotes = false) {
    const q = CounselingSessionModel.findById(id)
      .populate("student", "name email studentId department")
      .populate("counselor", "name email employeeId")
      .lean();
    if (includeSensitiveNotes) q.select("+counselorNotes");
    return q.lean().exec();
  },

  async create(data: Partial<ICounselingSession>) {
    const session = await CounselingSessionModel.create(data);
    return session.toObject();
  },

  async updateById(id: string | Types.ObjectId, update: Partial<ICounselingSession>) {
    return CounselingSessionModel.findByIdAndUpdate(id, update).lean().exec();
  },

  async updateStatus(id: string | Types.ObjectId, status: CounselingStatus) {
    return CounselingSessionModel.findByIdAndUpdate(id, { status }).lean().exec();
  },

  async findByStudent(studentId: string | Types.ObjectId, academicYear?: string) {
    const filter: MongoFilter<ICounselingSession> = { student: studentId };
    if (academicYear) filter.academicYear = academicYear;
    return CounselingSessionModel.find(filter).sort({ scheduledAt: -1 }).lean().exec();
  },

  async paginate(filter: MongoFilter<ICounselingSession>, query: PaginationQuery) {
    const { page, limit, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);

    const [data, total] = await Promise.all([
      CounselingSessionModel.find(filter)
        .populate("student", "name email studentId department")
        .populate("counselor", "name email")
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      CounselingSessionModel.countDocuments(filter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  async countPendingFollowUps(counselorId: string | Types.ObjectId): Promise<number> {
    return CounselingSessionModel.countDocuments({
      counselor: counselorId,
      status: CounselingStatus.FOLLOW_UP_REQUIRED,
    });
  },

  async countByFilter(filter: MongoFilter<ICounselingSession>): Promise<number> {
    return CounselingSessionModel.countDocuments(filter);
  },
};
