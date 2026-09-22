import { HostelRoomModel, HostelAllocationModel } from "../models";
import type { ClientSession } from "mongoose";

export const hostelRepository = {
  findRoomById: (id: string) => HostelRoomModel.findById(id).lean(),

  createRoom: (data: Record<string, unknown>) => HostelRoomModel.create(data),

  updateRoom: (id: string, data: Record<string, unknown>) =>
    HostelRoomModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateRoomInventoryAware: (
    id: string,
    expectedOccupancy: number,
    data: Record<string, unknown>,
  ) =>
    HostelRoomModel.findOneAndUpdate(
      { _id: id, occupancy: expectedOccupancy },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  listRooms: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HostelRoomModel.find(filter)
        .sort({ hostelName: 1, roomNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HostelRoomModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  findAllocationById: (id: string, session?: ClientSession) =>
    HostelAllocationModel.findById(id)
      .session(session ?? null)
      .lean(),

  createAllocation: async (data: Record<string, unknown>, session?: ClientSession) => {
    const [allocation] = await HostelAllocationModel.create([data], { session });
    return allocation;
  },

  findActiveAllocation: (studentId: string, academicYear: string) =>
    HostelAllocationModel.findOne({ studentId, academicYear, status: "active" }).lean(),

  findAnyActiveAllocation: (studentId: string) =>
    HostelAllocationModel.findOne({ studentId, status: "active" }).lean(),

  listAllocations: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HostelAllocationModel.find(filter)
        .populate("studentId", "name email rollNumber")
        .populate(
          "roomId",
          "hostelName roomNumber roomType floor blockName hostelType capacity occupancy monthlyFee",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HostelAllocationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateAllocation: (id: string, data: Record<string, unknown>) =>
    HostelAllocationModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateRoomOccupancy: (roomId: string, delta: number) =>
    HostelRoomModel.findByIdAndUpdate(roomId, { $inc: { occupancy: delta } }, {}).lean(),

  reserveRoom: (roomId: string, session?: ClientSession) =>
    HostelRoomModel.findOneAndUpdate(
      { _id: roomId, isActive: true, $expr: { $lt: ["$occupancy", "$capacity"] } },
      { $inc: { occupancy: 1 } },
      { returnDocument: "after", session },
    ).lean(),

  releaseRoom: (roomId: string, session?: ClientSession) =>
    HostelRoomModel.findOneAndUpdate(
      { _id: roomId, occupancy: { $gt: 0 } },
      { $inc: { occupancy: -1 } },
      { returnDocument: "after", session },
    ).lean(),

  transferAllocation: (
    id: string,
    oldRoomId: string,
    newRoomId: string,
    transferredBy: string,
    session?: ClientSession,
  ) =>
    HostelAllocationModel.findOneAndUpdate(
      { _id: id, roomId: oldRoomId, status: "active" },
      {
        $set: { roomId: newRoomId },
        $push: {
          roomTransfers: {
            fromRoomId: oldRoomId,
            toRoomId: newRoomId,
            transferredAt: new Date(),
            transferredBy,
          },
        },
      },
      { returnDocument: "after", session },
    ).lean(),

  vacateAllocation: (id: string, session?: ClientSession) =>
    HostelAllocationModel.findOneAndUpdate(
      { _id: id, status: "active" },
      {
        $set: { status: "vacated", vacatingDate: new Date() },
        $unset: { activeKey: 1 },
      },
      { returnDocument: "after", session },
    ).lean(),

  // ─── Visitor Log ───────────────────────────────────────────────────────────
  createVisitor: (data: Record<string, unknown>) => {
    const { HostelVisitorModel } = require("../models/hostel.model");
    return HostelVisitorModel.create(data);
  },

  listVisitors: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const { HostelVisitorModel } = require("../models/hostel.model");
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HostelVisitorModel.find(filter)
        .populate("studentId", "name")
        .sort({ checkIn: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HostelVisitorModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  checkOutVisitor: (id: string) => {
    const { HostelVisitorModel } = require("../models/hostel.model");
    return HostelVisitorModel.findOneAndUpdate(
      { _id: id, checkOut: { $exists: false } },
      { $set: { checkOut: new Date() } },
      { returnDocument: "after" },
    ).lean();
  },

  // ─── Complaints ────────────────────────────────────────────────────────────
  createComplaint: (data: Record<string, unknown>) => {
    const { HostelComplaintModel } = require("../models/hostel.model");
    return HostelComplaintModel.create(data);
  },

  listComplaints: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const { HostelComplaintModel } = require("../models/hostel.model");
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HostelComplaintModel.find(filter)
        .populate("studentId", "name")
        .populate("assignedTo", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HostelComplaintModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateComplaint: (id: string, expectedStatus: string, data: Record<string, unknown>) => {
    const { HostelComplaintModel } = require("../models/hostel.model");
    return HostelComplaintModel.findOneAndUpdate(
      { _id: id, status: expectedStatus },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  findComplaintById: (id: string) => {
    const { HostelComplaintModel } = require("../models/hostel.model");
    return HostelComplaintModel.findById(id).lean();
  },

  // ─── Hostel Fee ────────────────────────────────────────────────────────────
  createFeeRecord: (data: Record<string, unknown>) => {
    const { HostelFeeModel } = require("../models/hostel.model");
    return HostelFeeModel.create(data);
  },

  findFeeRecordById: (id: string, session?: ClientSession) => {
    const { HostelFeeModel } = require("../models/hostel.model");
    return HostelFeeModel.findById(id)
      .session(session ?? null)
      .lean();
  },

  listFeeRecords: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const { HostelFeeModel } = require("../models/hostel.model");
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HostelFeeModel.find(filter)
        .populate("studentId", "name")
        .sort({ month: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HostelFeeModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  recordFeePayment: (
    id: string,
    expectedPaidAmount: number,
    newPaidAmount: number,
    status: "partial" | "paid" | "overdue",
    payment: Record<string, unknown>,
    session?: ClientSession,
  ) => {
    const { HostelFeeModel } = require("../models/hostel.model");
    return HostelFeeModel.findOneAndUpdate(
      {
        _id: id,
        paidAmount: expectedPaidAmount,
        status: { $in: ["unpaid", "partial", "overdue"] },
      },
      {
        $set: {
          paidAmount: newPaidAmount,
          paymentMode: payment["paymentMode"],
          receiptNo: payment["receiptNo"],
          collectedBy: payment["collectedBy"],
          paidDate: payment["paidDate"],
          status,
        },
        $push: { payments: payment },
      },
      { returnDocument: "after", session },
    ).lean();
  },
};
