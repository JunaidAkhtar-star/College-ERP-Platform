import createError from "http-errors";
import { GatePassModel, StudentOutingPassModel } from "../models/gatepass.model";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { nextSeq } from "../models/counter.model";
import { UserModel } from "../models/user.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";

export function formatGatePassNumber(year: number, sequence: number) {
  if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(sequence) || sequence < 1) {
    throw createError(400, "Invalid gate-pass sequence");
  }
  return `GP-${year}-${String(sequence).padStart(4, "0")}`;
}

export const gatepassService = {
  /** Check-in a new visitor and issue a gate pass */
  checkIn: async (data: {
    visitorName: string;
    visitorPhone: string;
    purpose: string;
    hostId: string;
    vehicleNumber?: string;
    remarks?: string;
  }) => {
    // Generate sequential pass number: GP-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const hostExists = await UserModel.exists({ _id: data.hostId, isActive: true });
    if (!hostExists) throw createError(400, "Visitor host must be an active user");
    const seq = await nextSeq(`gate-pass:${currentYear}`);
    const passNumber = formatGatePassNumber(currentYear, seq);

    const pass = await GatePassModel.create({
      ...data,
      passNumber,
      status: "checked_in",
      checkInTime: new Date(),
    });

    // Notify the host user asynchronously
    setImmediate(() => {
      void notifyUsers([data.hostId], {
        title: "Visitor Checked In",
        body: `${data.visitorName} has checked in at the gate to meet you for: ${data.purpose}.`,
        type: NotificationType.INFO,
        actionUrl: "/gate-pass",
      }).catch((err) => console.error("[GatePass Service] Host notify failed", err));
    });

    return pass;
  },

  /** Check-out a visitor */
  checkOut: async (id: string) => {
    const pass = await GatePassModel.findOneAndUpdate(
      { _id: id, status: "checked_in" },
      { $set: { status: "checked_out", checkOutTime: new Date() } },
      { returnDocument: "after" },
    );
    if (!pass) {
      const exists = await GatePassModel.exists({ _id: id });
      if (!exists) throw createError(404, "Gate pass not found");
      throw createError(409, "Visitor is already checked out");
    }
    return pass;
  },

  /** Retrieve all gate passes with filter options */
  getAll: async (filter: { status?: "checked_in" | "checked_out"; hostId?: string } = {}) => {
    const query: { status?: "checked_in" | "checked_out"; hostId?: string } = {};
    if (filter.status) query.status = filter.status;
    if (filter.hostId) query.hostId = filter.hostId;

    return GatePassModel.find(query)
      .populate("hostId", "name email department")
      .sort({ createdAt: -1 })
      .lean();
  },

  applyForOuting: async (
    studentId: string,
    data: {
      reason: string;
      destination: string;
      departureAt: string;
      expectedReturnAt: string;
      emergencyContact: string;
    },
  ) => {
    const profile = await StudentProfileModel.exists({
      userId: studentId,
      status: StudentStatus.ACTIVE,
    });
    if (!profile) throw createError(403, "Only an active student can apply for an outing pass");
    const departureAt = new Date(data.departureAt);
    const expectedReturnAt = new Date(data.expectedReturnAt);
    if (expectedReturnAt <= departureAt) {
      throw createError(400, "Expected return must be after departure");
    }
    const currentYear = new Date().getFullYear();
    const sequence = await nextSeq(`student-outing:${currentYear}`);
    return StudentOutingPassModel.create({
      ...data,
      studentId,
      departureAt,
      expectedReturnAt,
      outingNumber: `OUT-${currentYear}-${String(sequence).padStart(4, "0")}`,
    });
  },

  listOutings: async (studentId?: string) =>
    StudentOutingPassModel.find(studentId ? { studentId } : {})
      .populate("studentId", "name email phone")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .lean(),

  decideOuting: async (
    id: string,
    reviewerId: string,
    decision: "approve" | "reject",
    reviewNotes?: string,
  ) => {
    const outing = await StudentOutingPassModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: decision === "approve" ? "approved" : "rejected",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      },
      { returnDocument: "after" },
    );
    if (!outing) throw createError(409, "Only a pending outing request can be reviewed");
    return outing;
  },

  recordOutingMovement: async (id: string, movement: "exit" | "return") => {
    const expectedStatus = movement === "exit" ? "approved" : "outside";
    const nextStatus = movement === "exit" ? "outside" : "returned";
    const timeField = movement === "exit" ? "exitedAt" : "returnedAt";
    const outing = await StudentOutingPassModel.findOneAndUpdate(
      { _id: id, status: expectedStatus },
      { $set: { status: nextStatus, [timeField]: new Date() } },
      { returnDocument: "after" },
    );
    if (!outing) throw createError(409, `Pass is not ready to record ${movement}`);
    return outing;
  },

  cancelOuting: async (id: string, studentId: string) => {
    const outing = await StudentOutingPassModel.findOneAndUpdate(
      { _id: id, studentId, status: "pending" },
      { $set: { status: "cancelled" } },
      { returnDocument: "after" },
    );
    if (!outing) throw createError(409, "Only your own pending request can be cancelled");
    return outing;
  },
};
