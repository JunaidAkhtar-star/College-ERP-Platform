import { transportRepository } from "../repositories";
import createError from "http-errors";
import mongoose from "mongoose";
import { StudentProfileModel, StudentStatus } from "../models";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { v4 as uuidv4 } from "uuid";
import { nextSeq } from "../models/counter.model";
import { generalLedgerService } from "./general-ledger.service";
import { emitTransportPosition } from "../socket/socket.gateway";

type TransportAllocation = Awaited<ReturnType<typeof transportRepository.createAllocation>>;
type ReservedRoute = NonNullable<Awaited<ReturnType<typeof transportRepository.reserveSeat>>>;

export function isTransportFeeMonthValid(month: string, academicYear: string) {
  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  const yearMatch = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!monthMatch || !yearMatch) return false;
  const year = Number(monthMatch[1]);
  const monthNumber = Number(monthMatch[2]);
  const startYear = Number(yearMatch[1]);
  const endYear = Number(yearMatch[2]);
  return endYear === startYear + 1 && (monthNumber >= 4 ? year === startYear : year === endYear);
}

export const transportService = {
  getRoutes: (filter: Record<string, unknown>, page: number, limit: number) =>
    transportRepository.listRoutes(filter, page, limit),

  getRouteById: (id: string) => transportRepository.findRouteById(id),

  addRoute: (data: Record<string, unknown>) =>
    transportRepository.createRoute({ ...data, occupiedCount: 0 }),

  updateRoute: async (id: string, data: Record<string, unknown>) => {
    const route = await transportRepository.findRouteById(id);
    if (!route) throw createError(404, "Transport route not found");
    const editable = [
      "routeNo",
      "routeName",
      "stops",
      "driverName",
      "driverPhone",
      "vehicleNo",
      "vehicleType",
      "capacity",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => editable.includes(key)),
    );
    if (data["capacity"] !== undefined && Number(data["capacity"]) < route.occupiedCount) {
      throw createError(409, `Capacity cannot be below ${route.occupiedCount} occupied seats`);
    }
    if (data["isActive"] === false && route.occupiedCount > 0) {
      throw createError(409, "A route with active passengers cannot be deactivated");
    }
    const updated = await transportRepository.updateRouteCapacityAware(
      id,
      route.occupiedCount,
      update,
    );
    if (!updated) throw createError(409, "Route occupancy changed; refresh and try again");
    return updated;
  },

  getAllocations: (filter: Record<string, unknown>, page: number, limit: number) =>
    transportRepository.listAllocations(filter, page, limit),

  getAllocationById: (id: string) => transportRepository.findAllocationById(id),

  allocate: async (
    studentId: string,
    routeId: string,
    academicYear: string,
    stopName: string,
    _monthlyFee: number,
    allocatedBy: string,
  ) => {
    if (!/^\d{4}-\d{4}$/.test(academicYear)) throw createError(400, "Invalid academic year");
    const student = await StudentProfileModel.exists({
      userId: studentId,
      status: StudentStatus.ACTIVE,
    });
    if (!student) throw createError(400, "An active student profile is required");
    if (await transportRepository.findAnyActiveAllocation(studentId)) {
      throw createError(409, "Student already has an active transport allocation");
    }
    const session = await mongoose.startSession();
    let allocation: TransportAllocation | null = null;
    let route: Awaited<ReturnType<typeof transportRepository.reserveSeat>> = null;
    try {
      await session.withTransaction(async () => {
        route = await transportRepository.reserveSeat(routeId, session);
        if (!route) throw createError(409, "Route is inactive, full, or unavailable");
        const stop = route.stops.find(
          (item) => item.stopName.trim().toLowerCase() === stopName.trim().toLowerCase(),
        );
        if (!stop) throw createError(400, "Selected stop does not belong to this route");
        allocation = await transportRepository.createAllocation(
          {
            studentId,
            routeId,
            stopName: stop.stopName,
            monthlyFee: stop.fareFromOrigin,
            academicYear,
            allocatedBy,
            status: "active",
            activeKey: studentId,
          },
          session,
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Student already has an active transport allocation");
      }
      throw error;
    } finally {
      await session.endSession();
    }
    const completed = allocation as unknown as TransportAllocation;
    const allocatedRoute = route as unknown as ReservedRoute;
    if (!completed || !allocatedRoute)
      throw createError(500, "Transport allocation transaction did not complete");
    void notifyUsers([studentId], {
      title: "Transport route allocated",
      body: `${allocatedRoute.routeNo} — ${allocatedRoute.routeName}, boarding at ${completed.stopName}.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/student/transport",
    });
    return completed;
  },

  cancel: async (allocationId: string) => {
    const session = await mongoose.startSession();
    let cancelled: Awaited<ReturnType<typeof transportRepository.cancelAllocation>> = null;
    try {
      await session.withTransaction(async () => {
        const allocation = await transportRepository.findAllocationById(allocationId, session);
        if (!allocation) throw createError(404, "Transport allocation not found");
        if (allocation.status !== "active")
          throw createError(409, "Allocation is already cancelled");
        cancelled = await transportRepository.cancelAllocation(allocationId, session);
        if (!cancelled) throw createError(409, "Allocation changed concurrently");
        const route = await transportRepository.releaseSeat(allocation.routeId.toString(), session);
        if (!route) throw createError(409, "Route occupancy is inconsistent");
      });
    } finally {
      await session.endSession();
    }
    if (!cancelled) throw createError(500, "Transport cancellation did not complete");
    return cancelled;
  },

  getMyAllocation: (studentId: string) => transportRepository.findAnyActiveAllocation(studentId),

  generateFee: async (allocationId: string, month: string, dueDateInput: string) => {
    const allocation = await transportRepository.findAllocationById(allocationId);
    if (!allocation) throw createError(404, "Transport allocation not found");
    if (!isTransportFeeMonthValid(month, allocation.academicYear)) {
      throw createError(400, "Fee month is outside the allocation academic year");
    }
    const dueDate = new Date(dueDateInput);
    if (Number.isNaN(dueDate.getTime())) throw createError(400, "Invalid transport fee due date");
    return transportRepository.createFee({
      allocationId,
      studentId: allocation.studentId,
      academicYear: allocation.academicYear,
      month,
      totalDue: allocation.monthlyFee,
      paidAmount: 0,
      dueDate,
      status: "unpaid",
    });
  },

  listFees: (filter: Record<string, unknown>, page: number, limit: number) =>
    transportRepository.listFees(filter, page, limit),

  collectFee: async (
    id: string,
    amountInput: number,
    paymentMode: "cash" | "bank_transfer" | "upi" | "dd" | "cheque",
    collectedBy: string,
  ) => {
    const amount = Math.round((Number(amountInput) + Number.EPSILON) * 100) / 100;
    if (amount <= 0) throw createError(400, "Payment amount must be positive");
    const paymentId = `TRNF-${uuidv4().split("-")[0].toUpperCase()}`;
    const session = await mongoose.startSession();
    let updated: Awaited<ReturnType<typeof transportRepository.recordFeePayment>> = null;
    let receiptNo = "";
    try {
      await session.withTransaction(async () => {
        const fee = await transportRepository.findFeeById(id, session);
        if (!fee) throw createError(404, "Transport fee record not found");
        const remaining = Math.round((fee.totalDue - fee.paidAmount + Number.EPSILON) * 100) / 100;
        if (amount > remaining) {
          throw createError(400, `Payment exceeds remaining transport fee of ₹${remaining}`);
        }
        const sequence = await nextSeq(`transport-receipt:${fee.academicYear}`);
        receiptNo = `TRN-RCP-${fee.academicYear.replace(/[^0-9]/g, "")}-${String(sequence).padStart(7, "0")}`;
        const paidDate = new Date();
        const newPaidAmount = Math.round((fee.paidAmount + amount + Number.EPSILON) * 100) / 100;
        updated = await transportRepository.recordFeePayment(
          id,
          fee.paidAmount,
          newPaidAmount,
          newPaidAmount === fee.totalDue ? "paid" : fee.dueDate < paidDate ? "overdue" : "partial",
          { paymentId, receiptNo, amount, paymentMode, paidDate, collectedBy },
          session,
        );
        if (!updated)
          throw createError(409, "Transport fee balance changed; refresh and try again");
        await generalLedgerService.postTransportFeeCollection(
          {
            transportFeeId: id,
            studentId: fee.studentId,
            paymentId,
            receiptNo,
            amount,
            paymentMode,
            paymentDate: paidDate,
            financialYear: fee.academicYear,
            postedBy: collectedBy,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (!updated) throw createError(500, "Transport fee payment did not complete");
    return { fee: updated, paymentId, receiptNo, amount };
  },

  // ─── Drivers (M41) ─────────────────────────────────────────────────────────
  createDriver: async (data: Record<string, unknown>) => {
    const licenseExpiry = new Date(String(data["licenseExpiry"]));
    if (Number.isNaN(licenseExpiry.getTime()) || licenseExpiry <= new Date()) {
      throw createError(400, "Driver licence must have a future expiry date");
    }
    if (data["assignedRoute"]) {
      const route = await transportRepository.findRouteById(String(data["assignedRoute"]));
      if (!route?.isActive)
        throw createError(400, "Driver can be assigned only to an active route");
      if (await transportRepository.findActiveDriverByRoute(String(data["assignedRoute"]))) {
        throw createError(409, "This route already has an active assigned driver");
      }
    }
    try {
      return await transportRepository.createDriver({ ...data, licenseExpiry, isActive: true });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Driver licence or route assignment already exists");
      }
      throw error;
    }
  },
  listDrivers: (filter: Record<string, unknown>, page: number, limit: number) =>
    transportRepository.listDrivers(filter, page, limit),
  getDriver: (id: string) => transportRepository.findDriverById(id),
  updateDriver: async (id: string, data: Record<string, unknown>) => {
    const existing = await transportRepository.findDriverById(id);
    if (!existing) throw createError(404, "Driver not found");
    const editable = [
      "name",
      "phone",
      "licenseNo",
      "licenseExpiry",
      "address",
      "experience",
      "photoUrl",
      "assignedRoute",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => editable.includes(key)),
    );
    if (data["isActive"] === false && existing.assignedRoute && data["assignedRoute"] !== null) {
      throw createError(409, "Unassign the driver from their route before deactivation");
    }
    if (data["licenseExpiry"] !== undefined) {
      const expiry = new Date(String(data["licenseExpiry"]));
      if (Number.isNaN(expiry.getTime()) || (data["isActive"] !== false && expiry <= new Date())) {
        throw createError(400, "An active driver licence must have a future expiry date");
      }
      update["licenseExpiry"] = expiry;
    }
    if (data["assignedRoute"]) {
      const routeId = String(data["assignedRoute"]);
      const [route, conflict] = await Promise.all([
        transportRepository.findRouteById(routeId),
        transportRepository.findActiveDriverByRoute(routeId, id),
      ]);
      if (!route?.isActive)
        throw createError(400, "Driver can be assigned only to an active route");
      if (conflict) throw createError(409, "This route already has an active assigned driver");
    }
    try {
      const updated = await transportRepository.updateDriver(id, update);
      if (!updated) throw createError(404, "Driver not found");
      return updated;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Driver licence or route assignment already exists");
      }
      throw error;
    }
  },
  deleteDriver: async (id: string) => {
    const driver = await transportRepository.deleteDriver(id);
    if (!driver) {
      const existing = await transportRepository.findDriverById(id);
      if (!existing) throw createError(404, "Driver not found");
      throw createError(409, "Unassign the driver from their route before deactivation");
    }
    return driver;
  },

  // ─── GPS ───────────────────────────────────────────────────────────────────
  startTrackingSession: async (routeId: string, userId: string) => {
    await transportRepository.expireTrackingSessions();
    const [route, driver] = await Promise.all([
      transportRepository.findRouteById(routeId),
      transportRepository.findActiveDriverByRoute(routeId),
    ]);
    if (!route?.isActive) throw createError(404, "Active transport route not found");
    if (!driver) {
      throw createError(409, "Assign an active, licensed driver before starting live tracking");
    }
    if (driver.licenseExpiry <= new Date()) {
      throw createError(409, "The assigned driver's licence has expired");
    }
    try {
      return await transportRepository.createTrackingSession(
        routeId,
        userId,
        new Date(Date.now() + 12 * 60 * 60 * 1000),
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "This vehicle is already being tracked from another device");
      }
      throw error;
    }
  },

  recordTrackingPosition: async (
    sessionId: string,
    userId: string,
    input: {
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      recordedAt: string;
    },
  ) => {
    const recordedAt = new Date(input.recordedAt);
    const clockSkew = recordedAt.getTime() - Date.now();
    if (Number.isNaN(recordedAt.getTime()) || clockSkew > 2 * 60 * 1000) {
      throw createError(400, "Invalid GPS timestamp");
    }
    if (clockSkew < -10 * 60 * 1000) throw createError(409, "GPS position is too old");
    if (input.accuracy !== undefined && input.accuracy > 500) {
      throw createError(422, "GPS accuracy is too low; wait for a better location fix");
    }
    const session = await transportRepository.acceptTrackingPosition(sessionId, userId, recordedAt);
    if (!session) throw createError(409, "Tracking session expired, stopped, or update is stale");

    const gps = {
      lat: input.lat,
      lng: input.lng,
      speed: input.speed,
      heading: input.heading,
      accuracy: input.accuracy,
      recordedAt,
    };
    const routeId = session.routeId.toString();
    const [route] = await Promise.all([
      transportRepository.updateRouteGps(routeId, gps),
      transportRepository.createTransportPosition({
        routeId,
        sessionId,
        ...gps,
      }),
    ]);
    if (!route) throw createError(404, "Transport route not found");
    emitTransportPosition(routeId, route);
    return route;
  },

  stopTrackingSession: async (sessionId: string, userId: string) => {
    const session = await transportRepository.stopTrackingSession(sessionId, userId);
    if (!session) throw createError(404, "Active tracking session not found");
    return session;
  },

  listLiveGps: async (userId: string, activeRole?: string) => {
    if (activeRole === "student") {
      const allocation = await transportRepository.findActiveAllocationRouteId(userId);
      if (!allocation) return [];
      return transportRepository.listLiveGps(allocation.routeId.toString());
    }
    return transportRepository.listLiveGps();
  },
};
