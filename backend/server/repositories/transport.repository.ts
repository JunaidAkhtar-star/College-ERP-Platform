import {
  BusRouteModel,
  TransportAllocationModel,
  TransportFeeModel,
  TransportPositionModel,
  TransportTrackingSessionModel,
} from "../models";
import type { ClientSession } from "mongoose";

export const transportRepository = {
  findRouteById: (id: string) => BusRouteModel.findById(id).lean(),

  createRoute: (data: Record<string, unknown>) => BusRouteModel.create(data),

  updateRoute: (id: string, data: Record<string, unknown>) =>
    BusRouteModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateRouteCapacityAware: (
    id: string,
    expectedOccupiedCount: number,
    data: Record<string, unknown>,
  ) =>
    BusRouteModel.findOneAndUpdate(
      { _id: id, occupiedCount: expectedOccupiedCount },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  listRoutes: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      BusRouteModel.find(filter).sort({ routeNo: 1 }).skip(skip).limit(limit).lean(),
      BusRouteModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  findAllocationById: (id: string, session?: ClientSession) =>
    TransportAllocationModel.findById(id)
      .session(session ?? null)
      .lean(),

  createAllocation: async (data: Record<string, unknown>, session?: ClientSession) => {
    const [allocation] = await TransportAllocationModel.create([data], { session });
    return allocation;
  },

  findActiveAllocation: (studentId: string, academicYear: string) =>
    TransportAllocationModel.findOne({ studentId, academicYear, status: "active" }).lean(),

  findAnyActiveAllocation: (studentId: string) =>
    TransportAllocationModel.findOne({ studentId, status: "active" })
      .populate("routeId", "routeNo routeName stops vehicleNo driverName driverPhone")
      .lean(),

  findActiveAllocationRouteId: (studentId: string) =>
    TransportAllocationModel.findOne({ studentId, status: "active" }).select("routeId").lean(),

  listAllocations: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TransportAllocationModel.find(filter)
        .populate("studentId", "name email rollNumber")
        .populate("routeId", "routeNo routeName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TransportAllocationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  updateAllocation: (id: string, data: Record<string, unknown>) =>
    TransportAllocationModel.findByIdAndUpdate(id, { $set: data }).lean(),

  updateRouteOccupancy: (routeId: string, delta: number) =>
    BusRouteModel.findByIdAndUpdate(routeId, { $inc: { occupiedCount: delta } }, {}).lean(),

  reserveSeat: (routeId: string, session?: ClientSession) =>
    BusRouteModel.findOneAndUpdate(
      { _id: routeId, isActive: true, $expr: { $lt: ["$occupiedCount", "$capacity"] } },
      { $inc: { occupiedCount: 1 } },
      { returnDocument: "after", session },
    ).lean(),

  releaseSeat: (routeId: string, session?: ClientSession) =>
    BusRouteModel.findOneAndUpdate(
      { _id: routeId, occupiedCount: { $gt: 0 } },
      { $inc: { occupiedCount: -1 } },
      { returnDocument: "after", session },
    ).lean(),

  cancelAllocation: (id: string, session?: ClientSession) =>
    TransportAllocationModel.findOneAndUpdate(
      { _id: id, status: "active" },
      { $set: { status: "cancelled" }, $unset: { activeKey: 1 } },
      { returnDocument: "after", session },
    ).lean(),

  // ─── GPS ───────────────────────────────────────────────────────────────────
  updateRouteGps: (
    routeId: string,
    gps: {
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      recordedAt: Date;
    },
  ) =>
    BusRouteModel.findByIdAndUpdate(
      routeId,
      { $set: { gps: { ...gps, lastSeen: new Date() } } },
      { returnDocument: "after" },
    ).lean(),

  listLiveGps: (routeId?: string) =>
    BusRouteModel.find({
      isActive: true,
      ...(routeId ? { _id: routeId } : {}),
      "gps.lastSeen": { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    })
      .select("routeNo routeName vehicleNo driverName driverPhone gps")
      .sort({ routeNo: 1 })
      .lean(),

  createTrackingSession: (routeId: string, startedBy: string, expiresAt: Date) =>
    TransportTrackingSessionModel.create({
      routeId,
      startedBy,
      status: "active",
      activeRouteKey: routeId,
      startedAt: new Date(),
      expiresAt,
    }),

  expireTrackingSessions: () =>
    TransportTrackingSessionModel.updateMany(
      {
        status: "active",
        $or: [
          { expiresAt: { $lte: new Date() } },
          { lastSeenAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } },
          {
            lastSeenAt: { $exists: false },
            startedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
          },
        ],
      },
      { $set: { status: "expired", stoppedAt: new Date() }, $unset: { activeRouteKey: 1 } },
    ),

  acceptTrackingPosition: (sessionId: string, startedBy: string, recordedAt: Date) =>
    TransportTrackingSessionModel.findOneAndUpdate(
      {
        _id: sessionId,
        startedBy,
        status: "active",
        expiresAt: { $gt: new Date() },
        $or: [{ lastRecordedAt: { $exists: false } }, { lastRecordedAt: { $lt: recordedAt } }],
      },
      { $set: { lastRecordedAt: recordedAt, lastSeenAt: new Date() } },
      { returnDocument: "after" },
    ).lean(),

  stopTrackingSession: (sessionId: string, startedBy: string) =>
    TransportTrackingSessionModel.findOneAndUpdate(
      { _id: sessionId, startedBy, status: "active" },
      {
        $set: { status: "stopped", stoppedAt: new Date() },
        $unset: { activeRouteKey: 1 },
      },
      { returnDocument: "after" },
    ).lean(),

  createTransportPosition: (data: {
    routeId: string;
    sessionId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    recordedAt: Date;
  }) => TransportPositionModel.create({ ...data, receivedAt: new Date() }),

  createFee: (data: Record<string, unknown>) => TransportFeeModel.create(data),

  findFeeById: (id: string, session?: ClientSession) =>
    TransportFeeModel.findById(id)
      .session(session ?? null)
      .lean(),

  listFees: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      TransportFeeModel.find(filter)
        .populate("studentId", "name email")
        .populate("allocationId", "routeId stopName academicYear")
        .sort({ month: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      TransportFeeModel.countDocuments(filter),
    ]);
    return { data, total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };
  },

  recordFeePayment: (
    id: string,
    expectedPaidAmount: number,
    newPaidAmount: number,
    status: "partial" | "paid" | "overdue",
    payment: Record<string, unknown>,
    session?: ClientSession,
  ) =>
    TransportFeeModel.findOneAndUpdate(
      {
        _id: id,
        paidAmount: expectedPaidAmount,
        status: { $in: ["unpaid", "partial", "overdue"] },
      },
      {
        $set: { paidAmount: newPaidAmount, status },
        $push: { payments: payment },
      },
      { returnDocument: "after", session },
    ).lean(),

  // ─── Drivers (M41) ─────────────────────────────────────────────────────────
  createDriver: (data: Record<string, unknown>) => {
    const { DriverModel } = require("../models/transport.model");
    return DriverModel.create(data);
  },
  listDrivers: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const { DriverModel } = require("../models/transport.model");
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      DriverModel.find(filter)
        .populate("assignedRoute", "routeNo routeName")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DriverModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },
  findDriverById: (id: string) => {
    const { DriverModel } = require("../models/transport.model");
    return DriverModel.findById(id).populate("assignedRoute", "routeNo routeName").lean();
  },
  findActiveDriverByRoute: (routeId: string, excludeId?: string) => {
    const { DriverModel } = require("../models/transport.model");
    return DriverModel.findOne({
      assignedRoute: routeId,
      isActive: true,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean();
  },
  updateDriver: (id: string, data: Record<string, unknown>) => {
    const { DriverModel } = require("../models/transport.model");
    return DriverModel.findByIdAndUpdate(id, { $set: data }).lean();
  },
  deleteDriver: (id: string) => {
    const { DriverModel } = require("../models/transport.model");
    return DriverModel.findOneAndUpdate(
      { _id: id, $or: [{ assignedRoute: { $exists: false } }, { assignedRoute: null }] },
      { $set: { isActive: false } },
      { returnDocument: "after" },
    ).lean();
  },
};
