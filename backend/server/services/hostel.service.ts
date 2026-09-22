import { hostelRepository } from "../repositories";
import { notifyUsers, notifyByPermission } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { Module, PermissionAction } from "../constants/permissions";
import createError from "http-errors";
import mongoose from "mongoose";
import { StudentProfileModel, StudentStatus } from "../models";
import { v4 as uuidv4 } from "uuid";
import { nextSeq } from "../models/counter.model";
import { generalLedgerService } from "./general-ledger.service";

type CreatedAllocation = Awaited<ReturnType<typeof hostelRepository.createAllocation>>;
type ReservedRoom = NonNullable<Awaited<ReturnType<typeof hostelRepository.reserveRoom>>>;
type TransferredAllocation = NonNullable<
  Awaited<ReturnType<typeof hostelRepository.transferAllocation>>
>;

export function isEligibleForHostelType(
  gender: "male" | "female" | "other",
  hostelType: "boys" | "girls" | "mixed",
) {
  return (
    hostelType === "mixed" || (hostelType === "boys" ? gender === "male" : gender === "female")
  );
}

export function isMonthInAcademicYear(month: string, academicYear: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  const academicMatch = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!match || !academicMatch) return false;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const startYear = Number(academicMatch[1]);
  const endYear = Number(academicMatch[2]);
  return endYear === startYear + 1 && (monthNumber >= 4 ? year === startYear : year === endYear);
}

export const hostelService = {
  getRooms: (filter: Record<string, unknown>, page: number, limit: number) =>
    hostelRepository.listRooms(filter, page, limit),

  getRoomById: (id: string) => hostelRepository.findRoomById(id),

  addRoom: (data: Record<string, unknown>) =>
    hostelRepository.createRoom({ ...data, occupancy: 0 }),

  updateRoom: async (id: string, data: Record<string, unknown>) => {
    const room = await hostelRepository.findRoomById(id);
    if (!room) throw createError(404, "Room not found");
    const editable = [
      "hostelName",
      "roomNumber",
      "blockName",
      "hostelType",
      "roomType",
      "floor",
      "capacity",
      "facilities",
      "monthlyFee",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => editable.includes(key)),
    );
    if (data["capacity"] !== undefined && Number(data["capacity"]) < room.occupancy) {
      throw createError(409, `Capacity cannot be below current occupancy (${room.occupancy})`);
    }
    if (data["isActive"] === false && room.occupancy > 0) {
      throw createError(409, "An occupied room cannot be deactivated");
    }
    const updated = await hostelRepository.updateRoomInventoryAware(id, room.occupancy, update);
    if (!updated) throw createError(409, "Room occupancy changed; refresh and try again");
    return updated;
  },

  getAllocations: (filter: Record<string, unknown>, page: number, limit: number) =>
    hostelRepository.listAllocations(filter, page, limit),

  getAllocationById: (id: string) => hostelRepository.findAllocationById(id),

  getMyAllocation: (studentId: string) => hostelRepository.findAnyActiveAllocation(studentId),

  allocate: async (
    studentId: string,
    roomId: string,
    academicYear: string,
    data: Record<string, unknown>,
    allocatedBy: string,
  ) => {
    if (!/^\d{4}-\d{4}$/.test(academicYear)) throw createError(400, "Invalid academic year");
    const student = await StudentProfileModel.findOne({
      userId: studentId,
      status: StudentStatus.ACTIVE,
    })
      .select("gender")
      .lean();
    if (!student) throw createError(400, "An active student profile is required");
    if (await hostelRepository.findAnyActiveAllocation(studentId)) {
      throw createError(409, "Student already has an active hostel allocation");
    }

    const session = await mongoose.startSession();
    let allocation: Awaited<ReturnType<typeof hostelRepository.createAllocation>> | null = null;
    let room: Awaited<ReturnType<typeof hostelRepository.reserveRoom>> = null;
    try {
      await session.withTransaction(async () => {
        room = await hostelRepository.reserveRoom(roomId, session);
        if (!room) throw createError(409, "Room is inactive, full, or unavailable");
        if (!isEligibleForHostelType(student.gender, room.hostelType)) {
          throw createError(409, "Student is not eligible for this hostel type");
        }
        allocation = await hostelRepository.createAllocation(
          {
            studentId,
            roomId,
            academicYear,
            allocatedBy,
            allocationDate: new Date(),
            monthlyFee: room.monthlyFee,
            messFee: Math.max(0, Number(data["messFee"]) || 0),
            depositPaid: 0,
            remarks: data["remarks"],
            status: "active",
            activeKey: studentId,
          },
          session,
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Student already has an active hostel allocation");
      }
      throw error;
    } finally {
      await session.endSession();
    }
    const completedAllocation = allocation as unknown as CreatedAllocation;
    const allocatedRoom = room as unknown as ReservedRoom;
    if (!completedAllocation || !allocatedRoom)
      throw createError(500, "Hostel allocation transaction did not complete");
    void notifyUsers([studentId], {
      title: "Hostel room allocated",
      body: `Room ${allocatedRoom.roomNumber ?? ""} (${allocatedRoom.hostelName ?? ""}) has been allocated to you for ${academicYear}.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/student/hostel",
      withEmail: true,
      emailTemplate: EmailTemplate.HOSTEL_ALLOCATION,
    });
    return completedAllocation;
  },

  checkAcademicYearMismatch: async (roomId: string, studentId: string) => {
    const { HostelAllocationModel } = await import("../models/hostel.model");
    const studentProfile = await StudentProfileModel.findOne({ userId: studentId })
      .select("currentYear")
      .lean();
    if (!studentProfile) throw createError(400, "Student profile not found");
    const otherAllocations = await HostelAllocationModel.find({
      roomId,
      status: "active",
      studentId: { $ne: studentId },
    })
      .select("studentId")
      .lean();

    if (!otherAllocations.length) return false;
    return Boolean(
      await StudentProfileModel.exists({
        userId: { $in: otherAllocations.map((allocation) => allocation.studentId) },
        currentYear: { $ne: studentProfile.currentYear },
      }),
    );
  },

  reallocate: async (allocationId: string, newRoomId: string, transferredBy: string) => {
    const existing = await hostelRepository.findAllocationById(allocationId);
    if (!existing) throw createError(404, "Allocation not found");
    if (existing.status !== "active")
      throw createError(409, "Only active allocations can transfer");
    const oldRoomId = existing.roomId;
    if (String(oldRoomId) === String(newRoomId)) {
      return existing;
    }
    const student = await StudentProfileModel.findOne({ userId: existing.studentId })
      .select("gender")
      .lean();
    if (!student) throw createError(400, "Student profile not found");
    const session = await mongoose.startSession();
    let transferred: Awaited<ReturnType<typeof hostelRepository.transferAllocation>> = null;
    let newRoom: Awaited<ReturnType<typeof hostelRepository.reserveRoom>> = null;
    try {
      await session.withTransaction(async () => {
        newRoom = await hostelRepository.reserveRoom(newRoomId, session);
        if (!newRoom) throw createError(409, "New room is inactive, full, or unavailable");
        if (!isEligibleForHostelType(student.gender, newRoom.hostelType)) {
          throw createError(409, "Student is not eligible for the new hostel type");
        }
        const released = await hostelRepository.releaseRoom(oldRoomId.toString(), session);
        if (!released) throw createError(409, "Current room occupancy is inconsistent");
        transferred = await hostelRepository.transferAllocation(
          allocationId,
          oldRoomId.toString(),
          newRoomId,
          transferredBy,
          session,
        );
        if (!transferred) throw createError(409, "Allocation changed concurrently");
      });
    } finally {
      await session.endSession();
    }
    const completed = transferred as unknown as TransferredAllocation;
    const destination = newRoom as unknown as ReservedRoom;
    if (!completed || !destination) throw createError(500, "Room transfer did not complete");
    void notifyUsers([completed.studentId.toString()], {
      title: "Hostel room reassigned",
      body: `Your room has been reassigned to Room ${destination.roomNumber ?? ""} (${destination.hostelName ?? ""}).`,
      type: NotificationType.INFO,
      actionUrl: "/student/hostel",
    });

    return completed;
  },

  vacate: async (allocationId: string) => {
    const session = await mongoose.startSession();
    let vacated: Awaited<ReturnType<typeof hostelRepository.vacateAllocation>> = null;
    try {
      await session.withTransaction(async () => {
        const allocation = await hostelRepository.findAllocationById(allocationId, session);
        if (!allocation) throw createError(404, "Allocation not found");
        if (allocation.status !== "active")
          throw createError(409, "Allocation is already finalized");
        vacated = await hostelRepository.vacateAllocation(allocationId, session);
        if (!vacated) throw createError(409, "Allocation changed concurrently");
        const released = await hostelRepository.releaseRoom(allocation.roomId.toString(), session);
        if (!released) throw createError(409, "Room occupancy is inconsistent");
      });
    } finally {
      await session.endSession();
    }
    if (!vacated) throw createError(500, "Vacating transaction did not complete");
    return vacated;
  },

  // ─── Visitor Log ────────────────────────────────────────────────────────
  logVisitor: async (data: Record<string, unknown>) => {
    const studentId = String(data["studentId"] ?? "");
    const allocation = await hostelRepository.findAnyActiveAllocation(studentId);
    if (!allocation)
      throw createError(409, "Visitor host does not have an active hostel allocation");
    const [room, student] = await Promise.all([
      hostelRepository.findRoomById(allocation.roomId.toString()),
      StudentProfileModel.findOne({ userId: studentId })
        .select("firstName middleName lastName")
        .lean(),
    ]);
    if (!room || !student) throw createError(409, "Hostel resident data is incomplete");
    return hostelRepository.createVisitor({
      studentId,
      studentName: [student.firstName, student.middleName, student.lastName]
        .filter(Boolean)
        .join(" "),
      hostelName: room.hostelName,
      roomNo: room.roomNumber,
      visitorName: data["visitorName"],
      visitorPhone: data["visitorPhone"],
      relation: data["relation"],
      purpose: data["purpose"],
      idProofType: data["idProofType"],
      idProofNo: data["idProofNo"],
      approvedBy: data["approvedBy"],
      checkIn: new Date(),
    });
  },
  listVisitors: (filter: Record<string, unknown>, page: number, limit: number) =>
    hostelRepository.listVisitors(filter, page, limit),
  checkOutVisitor: async (id: string) => {
    const visitor = await hostelRepository.checkOutVisitor(id);
    if (!visitor) throw createError(409, "Visitor is already checked out or does not exist");
    return visitor;
  },

  // ─── Complaints ──────────────────────────────────────────────────────────
  raiseComplaint: async (data: Record<string, unknown>) => {
    const studentId = String(data["studentId"] ?? "");
    const allocation = await hostelRepository.findAnyActiveAllocation(studentId);
    if (!allocation) throw createError(409, "Only an active hostel resident can raise a complaint");
    const room = await hostelRepository.findRoomById(allocation.roomId.toString());
    if (!room) throw createError(409, "Allocated hostel room no longer exists");
    const complaint = await hostelRepository.createComplaint({
      ...data,
      roomNo: room.roomNumber,
      hostelName: room.hostelName,
      status: "open",
    });
    void notifyByPermission(Module.HOSTEL, PermissionAction.EDIT, {
      title: "New hostel complaint",
      body: `${(data as { title?: string }).title ?? "A complaint"} from ${(data as { studentName?: string }).studentName ?? "a student"}.`,
      type: NotificationType.WARNING,
      actionUrl: "/warden/hostel/complaints",
    });
    return complaint;
  },
  listComplaints: (filter: Record<string, unknown>, page: number, limit: number) =>
    hostelRepository.listComplaints(filter, page, limit),
  updateComplaint: async (id: string, data: Record<string, unknown>) => {
    const complaint = await hostelRepository.findComplaintById(id);
    if (!complaint) throw createError(404, "Hostel complaint not found");
    if (complaint.status === "closed")
      throw createError(409, "Closed complaints cannot be changed");
    const status = String(data["status"] ?? complaint.status);
    const transitions: Record<string, string[]> = {
      open: ["open", "in_progress", "resolved", "closed"],
      in_progress: ["in_progress", "resolved", "closed"],
      resolved: ["resolved", "in_progress", "closed"],
    };
    if (!transitions[complaint.status]?.includes(status)) {
      throw createError(409, `Complaint cannot transition from ${complaint.status} to ${status}`);
    }
    if (status === "resolved" && !String(data["resolution"] ?? complaint.resolution ?? "").trim()) {
      throw createError(400, "A resolution note is required to resolve a complaint");
    }
    const update = {
      status,
      ...(data["assignedTo"] ? { assignedTo: data["assignedTo"] } : {}),
      ...(data["resolution"] !== undefined ? { resolution: data["resolution"] } : {}),
      ...(status === "resolved" ? { resolvedAt: new Date() } : {}),
    };
    const updated = await hostelRepository.updateComplaint(id, complaint.status, update);
    if (!updated) throw createError(409, "Complaint changed concurrently; refresh and try again");
    if (updated?.studentId && (data.status || data.resolution)) {
      void notifyUsers([updated.studentId as unknown as string], {
        title: "Hostel complaint update",
        body: `Your complaint has been updated${data.status ? ` to '${data.status}'` : ""}.`,
        type: NotificationType.INFO,
        actionUrl: "/student/hostel",
      });
    }
    return updated;
  },

  // ─── Hostel Fee ──────────────────────────────────────────────────────────
  generateFeeRecord: async (data: Record<string, unknown>) => {
    const allocationId = String(data["allocationId"] ?? "");
    const allocation = await hostelRepository.findAllocationById(allocationId);
    if (!allocation) throw createError(404, "Hostel allocation not found");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(data["month"] ?? ""))) {
      throw createError(400, "Month must use YYYY-MM format");
    }
    if (!isMonthInAcademicYear(String(data["month"]), allocation.academicYear)) {
      throw createError(400, "Fee month is outside the allocation academic year");
    }
    const dueDate = new Date(String(data["dueDate"]));
    if (Number.isNaN(dueDate.getTime())) throw createError(400, "Invalid hostel fee due date");
    const monthlyFee = allocation.monthlyFee;
    const messFee = allocation.messFee ?? 0;
    const otherCharges = Math.max(0, Number(data["otherCharges"]) || 0);
    return hostelRepository.createFeeRecord({
      allocationId,
      studentId: allocation.studentId,
      academicYear: allocation.academicYear,
      month: data["month"],
      monthlyFee,
      messFee,
      otherCharges,
      totalDue: monthlyFee + messFee + otherCharges,
      paidAmount: 0,
      dueDate,
      status: "unpaid",
    });
  },
  listFeeRecords: (filter: Record<string, unknown>, page: number, limit: number) =>
    hostelRepository.listFeeRecords(filter, page, limit),
  collectFeePayment: async (
    id: string,
    paidAmount: number,
    paymentMode: "cash" | "online" | "bank_transfer" | "upi" | "dd" | "cheque",
    _receiptNo: string | undefined,
    collectedBy: string,
  ) => {
    const amount = Math.round((Number(paidAmount) + Number.EPSILON) * 100) / 100;
    if (amount <= 0) throw createError(400, "Payment amount must be positive");
    const session = await mongoose.startSession();
    const paymentId = `HSTF-${uuidv4().split("-")[0].toUpperCase()}`;
    let updated: Awaited<ReturnType<typeof hostelRepository.recordFeePayment>> = null;
    let receiptNo = "";
    try {
      await session.withTransaction(async () => {
        const fee = await hostelRepository.findFeeRecordById(id, session);
        if (!fee) throw createError(404, "Hostel fee record not found");
        const remaining = Math.round((fee.totalDue - fee.paidAmount + Number.EPSILON) * 100) / 100;
        if (amount > remaining) {
          throw createError(400, `Payment exceeds remaining hostel fee of ₹${remaining}`);
        }
        const sequence = await nextSeq(`hostel-receipt:${fee.academicYear}`);
        receiptNo = `HST-RCP-${fee.academicYear.replace(/[^0-9]/g, "")}-${String(sequence).padStart(7, "0")}`;
        const newPaidAmount = Math.round((fee.paidAmount + amount + Number.EPSILON) * 100) / 100;
        const paidDate = new Date();
        updated = await hostelRepository.recordFeePayment(
          id,
          fee.paidAmount,
          newPaidAmount,
          newPaidAmount === fee.totalDue ? "paid" : fee.dueDate < paidDate ? "overdue" : "partial",
          { paymentId, amount, paymentMode, receiptNo, paidDate, collectedBy },
          session,
        );
        if (!updated) throw createError(409, "Hostel fee balance changed; refresh and try again");
        await generalLedgerService.postHostelFeeCollection(
          {
            hostelFeeId: id,
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
    if (!updated) throw createError(500, "Hostel fee payment did not complete");
    return { fee: updated, paymentId, receiptNo, amount };
  },
};
