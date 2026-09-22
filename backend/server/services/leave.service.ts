import { leaveRepository } from "../repositories";
import { notifyUsers, notifyByPermission } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { Module, PermissionAction } from "../constants/permissions";
import createError from "http-errors";
import mongoose from "mongoose";
import { LeaveBalanceModel, LeaveRequestModel, PayslipModel } from "../models";
import { formatIndiaDate } from "../utils/date.util";

export function academicYearForDate(date: Date) {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

export function periodMonths(fromDate: Date, toDate: Date) {
  const months: Array<{ month: number; year: number }> = [];
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cursor <= end) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export const leaveService = {
  getRequests: (filter: Record<string, unknown>, page: number, limit: number) =>
    leaveRepository.listRequests(filter, page, limit),

  getRequestById: (id: string) => leaveRepository.findRequestById(id),

  getBalance: (employeeId: string, academicYear: string) =>
    leaveRepository.findBalance(employeeId, academicYear),

  apply: async (data: Record<string, unknown>) => {
    const fromDate = new Date(String(data["fromDate"]));
    const toDate = new Date(String(data["toDate"]));
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      toDate.getTime() < fromDate.getTime()
    ) {
      throw createError(400, "Leave dates are invalid");
    }
    const calculatedDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (Number(data["totalDays"]) !== calculatedDays) {
      throw createError(400, `totalDays must match the selected date range (${calculatedDays})`);
    }
    const overlapping = await LeaveRequestModel.exists({
      employeeId: String(data["employeeId"]),
      status: { $in: ["pending", "approved"] },
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate },
    });
    if (overlapping) throw createError(409, "An active leave request already overlaps these dates");
    const request = await leaveRepository.createRequest(data);
    // Notify anyone with permission to approve employee/leave records,
    // scoped to the applicant's department (typically the HOD).
    void notifyByPermission(Module.EMPLOYEE, PermissionAction.APPROVE, {
      departmentId: data.departmentId as string,
      title: "New leave request awaiting your approval",
      body: `${(data as { employeeName?: string }).employeeName ?? "An employee"} applied for ${(data as { leaveType?: string }).leaveType ?? "leave"} (${(data as { totalDays?: number }).totalDays ?? "?"} day(s)).`,
      type: NotificationType.INFO,
      actionUrl: "/hod/leave",
    });
    return request;
  },

  hodApprove: async (id: string, hodId: string) => {
    const updated = await leaveRepository.transitionRequest(
      id,
      { status: "pending", hodApproval: "pending" },
      {
        hodApproval: "approved",
        hodApprovedBy: hodId,
        hodApprovedAt: new Date(),
        adminApproval: "pending",
      },
    );
    if (!updated) throw createError(409, "Leave request is no longer awaiting HOD approval");
    if (updated) {
      // Escalate to institution-wide approvers (no department scope).
      void notifyByPermission(Module.EMPLOYEE, PermissionAction.APPROVE, {
        title: "Leave request needs final approval",
        body: `A leave request has been approved by HOD and is awaiting your final approval.`,
        type: NotificationType.INFO,
        actionUrl: "/super_admin/leave",
      });
      void notifyUsers([updated.employeeId], {
        title: "HOD approved your leave request",
        body: "Your leave is now pending final approval from the admin office.",
        type: NotificationType.INFO,
        actionUrl: "/faculty/leave",
      });
    }
    return updated;
  },

  hodReject: async (id: string, hodId: string, reason: string) => {
    const updated = await leaveRepository.transitionRequest(
      id,
      { status: "pending", hodApproval: "pending" },
      {
        hodApproval: "rejected",
        hodApprovedBy: hodId,
        hodApprovedAt: new Date(),
        status: "rejected",
        rejectionReason: reason,
      },
    );
    if (!updated) throw createError(409, "Leave request is no longer awaiting HOD approval");
    if (updated) {
      void notifyUsers([updated.employeeId], {
        title: "Your leave request was rejected",
        body: `HOD rejected your leave request. Reason: ${reason || "Not provided"}.`,
        type: NotificationType.WARNING,
        actionUrl: "/faculty/leave",
        withEmail: true,
        emailTemplate: EmailTemplate.LEAVE_UPDATE,
      });
    }
    return updated;
  },

  adminApprove: async (id: string, adminId: string) => {
    const req = await leaveRepository.findRequestById(id);
    if (!req) throw createError(404, "Leave request not found");
    if (req.hodApproval !== "approved" || req.status !== "pending") {
      throw createError(409, "Final approval requires a pending HOD-approved request");
    }
    const fromDate = new Date(req.fromDate);
    const toDate = new Date(req.toDate);
    const session = await mongoose.startSession();
    let approved: Awaited<ReturnType<typeof leaveRepository.transitionRequest>> = null;
    try {
      await session.withTransaction(async () => {
        if (req.leaveType === "loss_of_pay") {
          const paidPayroll = await PayslipModel.exists({
            employeeId: req.employeeId,
            isPaid: true,
            $or: periodMonths(fromDate, toDate).map(({ month, year }) => ({ month, year })),
          }).session(session);
          if (paidPayroll) {
            throw createError(
              409,
              "Cannot approve loss-of-pay leave after affected payroll is paid",
            );
          }
        } else if (["casual", "sick", "earned", "on_duty"].includes(req.leaveType)) {
          const academicYear = academicYearForDate(fromDate);
          await LeaveBalanceModel.updateOne(
            { employeeId: req.employeeId, academicYear },
            { $setOnInsert: { employeeId: req.employeeId, academicYear } },
            { upsert: true, session, setDefaultsOnInsert: true },
          );
          const balance = await leaveRepository.decrementBalance(
            req.employeeId.toString(),
            academicYear,
            req.leaveType,
            req.totalDays,
            session,
          );
          if (!balance) throw createError(409, "Insufficient leave balance for this request");
        }
        approved = await leaveRepository.transitionRequest(
          id,
          { status: "pending", hodApproval: "approved", adminApproval: "pending" },
          {
            adminApproval: "approved",
            adminApprovedBy: adminId,
            adminApprovedAt: new Date(),
            status: "approved",
          },
          session,
        );
        if (!approved) throw createError(409, "Leave request was already finalized");
      });
    } finally {
      await session.endSession();
    }
    void notifyUsers([req.employeeId], {
      title: "Your leave request was approved",
      body: `Your ${req.leaveType} leave for ${req.totalDays} day(s) starting ${formatIndiaDate(req.fromDate)} has been approved.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/faculty/leave",
      withEmail: true,
      emailTemplate: EmailTemplate.LEAVE_UPDATE,
    });
    return approved;
  },

  adminReject: async (id: string, adminId: string, reason: string) => {
    const updated = await leaveRepository.transitionRequest(
      id,
      { status: "pending", hodApproval: "approved", adminApproval: "pending" },
      {
        adminApproval: "rejected",
        adminApprovedBy: adminId,
        adminApprovedAt: new Date(),
        status: "rejected",
        rejectionReason: reason,
      },
    );
    if (!updated) throw createError(409, "Leave request is not awaiting final approval");
    if (updated) {
      void notifyUsers([updated.employeeId], {
        title: "Your leave request was rejected",
        body: `Admin rejected your leave request. Reason: ${reason || "Not provided"}.`,
        type: NotificationType.WARNING,
        actionUrl: "/faculty/leave",
        withEmail: true,
        emailTemplate: EmailTemplate.LEAVE_UPDATE,
      });
    }
    return updated;
  },

  cancel: async (id: string, employeeId: string) => {
    const cancelled = await leaveRepository.transitionRequest(
      id,
      { employeeId, status: "pending", hodApproval: "pending" },
      { status: "cancelled" },
    );
    if (!cancelled) throw createError(409, "Only your own unreviewed leave can be cancelled");
    return cancelled;
  },
};
