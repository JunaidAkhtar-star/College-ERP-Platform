import mongoose from "mongoose";
import type { PlacementApplicationStatus } from "../models/placement-application.model";
import { PlacementApplicationModel } from "../models/placement-application.model";

export const placementApplicationRepository = {
  findById: (id: string) =>
    PlacementApplicationModel.findById(id)
      .populate("studentId", "name email phone")
      .populate("driveId", "companyName jobRole driveDate")
      .lean(),

  findByDriveAndStudent: (driveId: string, studentId: string) =>
    PlacementApplicationModel.findOne({ driveId, studentId }).lean(),

  findByDrive: (driveId: string, status?: PlacementApplicationStatus) => {
    const filter: Record<string, unknown> = { driveId };
    if (status) filter.status = status;
    return PlacementApplicationModel.find(filter)
      .populate("studentId", "name email phone")
      .sort({ cgpaAtTimeOfApplication: -1 })
      .lean();
  },

  findByStudent: (studentId: string) =>
    PlacementApplicationModel.find({ studentId })
      .populate("driveId", "companyName jobRole driveDate status")
      .sort({ createdAt: -1 })
      .lean(),

  create: (data: Record<string, unknown>) => PlacementApplicationModel.create(data),

  updateById: (id: string, data: Record<string, unknown>, session?: mongoose.ClientSession) =>
    PlacementApplicationModel.findByIdAndUpdate(id, { $set: data }, { session }).lean(),

  countByDriveAndStatus: async (driveId: string) => {
    const rows = await PlacementApplicationModel.aggregate<{ _id: string; count: number }>([
      { $match: { driveId: new mongoose.Types.ObjectId(driveId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  },

  paginate: async (
    filter: Record<string, unknown>,
    page = 1,
    limit = 20,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
  ) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PlacementApplicationModel.find(filter)
        .populate("studentId", "name email phone")
        .populate("driveId", "companyName jobRole driveDate")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      PlacementApplicationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
};
