import mongoose from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import { FacultyProfileModel, type IFacultyProfile } from "../models/faculty-profile.model";
import { buildPaginated, parsePagination } from "../utils/pagination.util";
import type { PaginationQuery } from "../types";

export const facultyProfileRepository = {
  async findById(id: string, includeSalary = false) {
    const query = FacultyProfileModel.findById(id)
      .populate("userId", "name email status roles")
      .populate("department", "name code")
      .lean();
    if (includeSalary)
      query.select(
        "+salaryDetails.panNumber +salaryDetails.bankAccountNo +salaryDetails.pfAccountNo",
      );
    return query.lean().exec();
  },

  async findByUserId(userId: string) {
    return FacultyProfileModel.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate("userId", "name email status roles")
      .populate("department", "name code")
      .lean()
      .exec();
  },

  async findByEmployeeId(employeeId: string) {
    return FacultyProfileModel.findOne({ employeeId }).lean().exec();
  },

  async create(data: Partial<IFacultyProfile>) {
    return FacultyProfileModel.create(data);
  },

  async updateById(id: string, data: Partial<IFacultyProfile>) {
    return FacultyProfileModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
  },

  async paginate(filter: Record<string, unknown>, query: PaginationQuery) {
    const { page, limit, sortBy, sortOrder } = parsePagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>;

    const baseFilter: MongoFilter<IFacultyProfile> = { ...filter };

    if (query.search) {
      const searchStr = query.search as string;
      const regex = new RegExp(searchStr, "i");
      baseFilter.$or = [
        { firstName: regex },
        { lastName: regex },
        { employeeId: regex },
        { collegeEmail: regex },
        { specialization: regex },
      ];
    }

    const [data, total] = await Promise.all([
      FacultyProfileModel.find(baseFilter)
        .populate("userId", "name email status")
        .populate("department", "name code")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      FacultyProfileModel.countDocuments(baseFilter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  async addPublication(facultyId: string, publication: IFacultyProfile["publications"][0]) {
    return FacultyProfileModel.findByIdAndUpdate(
      facultyId,
      { $push: { publications: publication } },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
  },

  async addTraining(facultyId: string, training: IFacultyProfile["trainingRecords"][0]) {
    return FacultyProfileModel.findByIdAndUpdate(
      facultyId,
      {
        $push: { trainingRecords: training },
        $inc: { totalFdpDays: training.durationDays ?? 1 },
      },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
  },

  async countByDesignation(departmentId?: string) {
    const match = departmentId ? { department: new mongoose.Types.ObjectId(departmentId) } : {};
    return FacultyProfileModel.aggregate([
      { $match: match },
      { $group: { _id: "$designation", count: { $sum: 1 } } },
    ]);
  },

  async countByDepartment() {
    return FacultyProfileModel.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);
  },
};
