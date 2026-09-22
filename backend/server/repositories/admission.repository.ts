import type { Types } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import type {
  IAdmissionApplication,
  ApplicationStatus,
} from "../models/admission-application.model";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import type { PaginationQuery } from "../types";
import { buildPaginated, parsePagination } from "../utils/pagination.util";

export const admissionRepository = {
  async findById(id: string | Types.ObjectId) {
    return AdmissionApplicationModel.findById(id)
      .populate("paymentDetails.verifiedBy", "name email role")
      .lean()
      .exec();
  },

  async findByApplicationNumber(applicationNumber: string) {
    return AdmissionApplicationModel.findOne({ applicationNumber }).lean().exec();
  },

  async findByEmail(email: string) {
    return AdmissionApplicationModel.findOne({ email: email.toLowerCase() }).lean().exec();
  },

  async findByEmailAndAcademicYear(email: string, academicYear: string) {
    return AdmissionApplicationModel.findOne({
      email: email.toLowerCase().trim(),
      academicYear,
    })
      .lean()
      .exec();
  },

  async create(data: Partial<IAdmissionApplication>) {
    const application = await AdmissionApplicationModel.create(data);
    return application.toObject();
  },

  async updateById(id: string | Types.ObjectId, update: Partial<IAdmissionApplication>) {
    return AdmissionApplicationModel.findByIdAndUpdate(id, update, {}).lean().exec();
  },

  async updateStatus(id: string | Types.ObjectId, status: ApplicationStatus, remarks?: string) {
    return AdmissionApplicationModel.findByIdAndUpdate(
      id,
      { status, ...(remarks ? { remarks } : {}) },
      {},
    )
      .lean()
      .exec();
  },

  async paginate(filter: MongoFilter<IAdmissionApplication>, query: PaginationQuery) {
    const { page, limit, sortBy, sortOrder, search } = parsePagination(
      query as Record<string, unknown>,
    );

    const searchFilter: MongoFilter<IAdmissionApplication> = search
      ? {
          ...filter,
          $or: [
            { candidateName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { applicationNumber: { $regex: search, $options: "i" } },
          ],
        }
      : filter;

    const [data, total] = await Promise.all([
      AdmissionApplicationModel.find(searchFilter)
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      AdmissionApplicationModel.countDocuments(searchFilter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  async countByStatus(academicYear: string): Promise<Record<string, number>> {
    const result = await AdmissionApplicationModel.aggregate([
      { $match: { academicYear } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    return result.reduce(
      (acc, { _id, count }) => ({ ...acc, [_id]: count }),
      {} as Record<string, number>,
    );
  },

  async countByProgram(academicYear: string): Promise<Array<{ _id: string; count: number }>> {
    return AdmissionApplicationModel.aggregate([
      { $match: { academicYear, allocatedProgram: { $exists: true, $ne: null } } },
      { $group: { _id: "$allocatedProgram", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  },
};
