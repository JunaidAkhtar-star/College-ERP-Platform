import type { Request, Response, NextFunction } from "express";
import { hostelService } from "../services";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";

const HOSTEL_STAFF = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.HOSTEL_WARDEN,
]);

function assertHostelReadRole(req: Request) {
  if (req.activeRole !== SystemRole.STUDENT && !HOSTEL_STAFF.has(req.activeRole as SystemRole)) {
    throw createError(403, "Hostel records are restricted to residents and hostel staff");
  }
}

export const hostelController = {
  listRooms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hostelName, roomType, isActive } = req.query;
      const filter: Record<string, unknown> = {};
      if (hostelName) filter.hostelName = hostelName;
      if (roomType) filter.roomType = roomType;
      if (isActive !== undefined) filter.isActive = isActive === "true";
      const result = await hostelService.getRooms(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  addRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await hostelService.addRoom(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updateRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await hostelService.updateRoom(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listAllocations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, academicYear, status, roomId } = req.query;
      const filter: Record<string, unknown> = {};
      if (studentId) filter.studentId = studentId;
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;
      if (roomId) filter.roomId = roomId;
      const result = await hostelService.getAllocations(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  myAllocation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await hostelService.getMyAllocation(req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  allocate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, roomId, academicYear, ignoreWarning, ...rest } = req.body;

      if (!ignoreWarning) {
        const mismatch = await hostelService.checkAcademicYearMismatch(roomId, studentId);
        if (mismatch) {
          return res.status(200).json({
            success: false,
            warning: true,
            message:
              "This room contains students from a different academic year. Do you want to allocate anyway?",
          });
        }
      }

      const data = await hostelService.allocate(
        studentId,
        roomId,
        academicYear,
        rest,
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  reallocate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId, ignoreWarning } = req.body;
      const allocationId = req.params.id;

      const allocation = await hostelService.getAllocationById(allocationId);
      if (!allocation) throw new Error("Allocation not found");

      if (!ignoreWarning) {
        const mismatch = await hostelService.checkAcademicYearMismatch(
          roomId,
          String(allocation.studentId),
        );
        if (mismatch) {
          return res.status(200).json({
            success: false,
            warning: true,
            message:
              "This room contains students from a different academic year. Do you want to reallocate anyway?",
          });
        }
      }

      const data = await hostelService.reallocate(allocationId, roomId, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  vacate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await hostelService.vacate(req.params.id);
      res.json({ success: true, message: "Student vacated successfully" });
    } catch (err) {
      next(err);
    }
  },

  // ── Visitors ──────────────────────────────────────────────────────────────
  logVisitor: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const approvedBy = (req.user!._id as unknown as string).toString();
      const visitor = await hostelService.logVisitor({ ...req.body, approvedBy });
      res.status(201).json({ success: true, data: visitor });
    } catch (err) {
      next(err);
    }
  },
  listVisitors: async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertHostelReadRole(req);
      const { studentId, hostelName, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (req.activeRole === SystemRole.STUDENT) {
        filter.studentId = req.user!._id;
      } else if (studentId) filter.studentId = studentId;
      if (hostelName) filter.hostelName = hostelName;
      const result = await hostelService.listVisitors(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      if (req.activeRole === SystemRole.STUDENT) {
        result.data = result.data.map((visitor: Record<string, unknown>) => {
          const sanitized = { ...visitor };
          delete sanitized["idProofNo"];
          return sanitized;
        }) as typeof result.data;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
  checkOutVisitor: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const v = await hostelService.checkOutVisitor(req.params.id);
      res.json({ success: true, data: v });
    } catch (err) {
      next(err);
    }
  },

  // ── Complaints ────────────────────────────────────────────────────────────
  raiseComplaint: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = (req.user!._id as unknown as string).toString();
      const complaint = await hostelService.raiseComplaint({
        studentId,
        category: req.body.category,
        description: req.body.description,
        attachmentUrl: req.body.attachmentUrl,
      });
      res.status(201).json({ success: true, data: complaint });
    } catch (err) {
      next(err);
    }
  },
  listComplaints: async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertHostelReadRole(req);
      const { studentId, status, hostelName, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (req.activeRole === SystemRole.STUDENT) {
        filter.studentId = req.user!._id;
      } else if (studentId) filter.studentId = studentId;
      if (status) filter.status = status;
      if (hostelName) filter.hostelName = hostelName;
      const result = await hostelService.listComplaints(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
  updateComplaint: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await hostelService.updateComplaint(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Hostel Fee ────────────────────────────────────────────────────────────
  generateFeeRecord: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fee = await hostelService.generateFeeRecord(req.body);
      res.status(201).json({ success: true, data: fee });
    } catch (err) {
      next(err);
    }
  },
  listFeeRecords: async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertHostelReadRole(req);
      const { studentId, month, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (req.activeRole === SystemRole.STUDENT) {
        filter.studentId = req.user!._id;
      } else if (studentId) filter.studentId = studentId;
      if (month) filter.month = month;
      if (status) filter.status = status;
      const result = await hostelService.listFeeRecords(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
  collectFeePayment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const collectedBy = (req.user!._id as unknown as string).toString();
      const { paidAmount, paymentMode, receiptNo } = req.body;
      const data = await hostelService.collectFeePayment(
        req.params.id,
        paidAmount,
        paymentMode,
        receiptNo,
        collectedBy,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
