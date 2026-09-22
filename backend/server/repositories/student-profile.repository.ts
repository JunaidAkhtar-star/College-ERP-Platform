import mongoose from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import {
  StudentProfileModel,
  StudentStatus,
  type IStudentProfile,
} from "../models/student-profile.model";
import { buildPaginated, parsePagination } from "../utils/pagination.util";
import type { PaginationQuery } from "../types";

export const studentProfileRepository = {
  async findById(id: string) {
    return StudentProfileModel.findById(id)
      .populate("userId", "name email status roles")
      .populate("department", "name code")
      .populate("mentor", "name email")
      .populate("admissionApplicationId", "applicationNumber documentChecklist passportPhotoUrl")
      .lean()
      .exec();
  },

  async findByUserId(userId: string) {
    return StudentProfileModel.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate("userId", "name email status roles")
      .populate("department", "name code")
      .lean()
      .exec();
  },

  async findByRollNumber(rollNumber: string) {
    return StudentProfileModel.findOne({ rollNumber }).lean().exec();
  },

  async findUserIdsByDepartment(departmentId: string) {
    return StudentProfileModel.distinct("userId", {
      department: new mongoose.Types.ObjectId(departmentId),
    }).exec();
  },

  async findByRegistrationNumber(registrationNumber: string) {
    return StudentProfileModel.findOne({ registrationNumber }).lean().exec();
  },

  async create(data: Partial<IStudentProfile>) {
    return StudentProfileModel.create(data);
  },

  async updateById(id: string, data: Partial<IStudentProfile>) {
    return StudentProfileModel.findByIdAndUpdate(
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

    const baseFilter: MongoFilter<IStudentProfile> = { ...filter };

    // Search by name, rollNumber, or registrationNumber
    if (query.search) {
      const searchStr = query.search as string;
      const regex = new RegExp(searchStr, "i");
      baseFilter.$or = [
        { firstName: regex },
        { lastName: regex },
        { rollNumber: regex },
        { registrationNumber: regex },
        { collegeEmail: regex },
      ];
    }

    const [data, total] = await Promise.all([
      StudentProfileModel.find(baseFilter)
        .populate("userId", "name email status")
        .populate("department", "name code")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      StudentProfileModel.countDocuments(baseFilter),
    ]);

    return buildPaginated(data, total, page, limit);
  },

  /** Bulk update semester for all active students of a program going to next sem */
  async promoteSemester(program: string, currentSemester: number, academicYear: string) {
    return StudentProfileModel.updateMany(
      {
        program: program as IStudentProfile["program"],
        currentSemester,
        status: StudentStatus.ACTIVE,
      },
      {
        $set: {
          currentSemester: currentSemester + 1,
          academicYear,
          currentYear: Math.ceil((currentSemester + 1) / 2),
        },
      },
    );
  },

  async countByProgram(batch: string) {
    return StudentProfileModel.aggregate([
      { $match: { batch } },
      { $group: { _id: "$program", count: { $sum: 1 } } },
    ]);
  },

  async countByStatus() {
    return StudentProfileModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  },
};
