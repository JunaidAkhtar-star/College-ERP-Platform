import mongoose from "mongoose";
import {
  HrEmployeeModel,
  EmploymentStatus,
  EmploymentType,
  type IHrEmployee,
} from "../models/hr.model";
import type { MongoFilter } from "../types/mongoose.types";

export const hrRepository = {
  create: (data: Partial<IHrEmployee>) => HrEmployeeModel.create(data),

  findById: (id: string) => HrEmployeeModel.findById(id).populate("department", "name code").lean(),

  findByUserId: (userId: string) =>
    HrEmployeeModel.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean(),

  findByEmployeeId: (employeeId: string) => HrEmployeeModel.findOne({ employeeId }).lean(),

  list: (filter: MongoFilter<IHrEmployee>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const activeFilter = {
      $and: [filter, { employmentStatus: EmploymentStatus.ACTIVE }],
    } as MongoFilter<IHrEmployee>;
    const permanentFilter = {
      $and: [filter, { employmentType: EmploymentType.PERMANENT }],
    } as MongoFilter<IHrEmployee>;
    return Promise.all([
      HrEmployeeModel.find(filter)
        .populate("department", "name code")
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 })
        .lean(),
      HrEmployeeModel.countDocuments(filter),
      HrEmployeeModel.countDocuments(activeFilter),
      HrEmployeeModel.countDocuments(permanentFilter),
    ]).then(([data, total, active, permanent]) => ({
      data,
      total,
      page,
      limit,
      summary: { total, active, permanent },
    }));
  },

  updateById: (id: string, update: Partial<IHrEmployee>) =>
    HrEmployeeModel.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  countByDepartment: (departmentId: string) =>
    HrEmployeeModel.countDocuments({
      department: new mongoose.Types.ObjectId(departmentId),
      employmentStatus: EmploymentStatus.ACTIVE,
    }),
};
