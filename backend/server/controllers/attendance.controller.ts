import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import createError from "http-errors";
import { attendanceService } from "../services";
import { SystemRole } from "../constants/roles";
import {
  assertDepartmentAccess,
  applyDepartmentScope,
  getDepartmentScope,
} from "../utils/ownership.util";
import { StudentProfileModel } from "../models/student-profile.model";

export const attendanceController = {
  markAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allowedDepartmentId = await getDepartmentScope(req);
      const isLeadership = [
        SystemRole.HOD,
        SystemRole.SUPER_ADMIN,
        SystemRole.ADMIN,
        SystemRole.PRINCIPAL,
        SystemRole.DEAN_ACADEMIC,
      ].includes(req.activeRole as SystemRole);
      const data = await attendanceService.markAttendance({
        ...req.body,
        facultyId: req.body.facultyId || req.user?._id.toString(),
        requireAssignedSlot: req.activeRole === SystemRole.FACULTY,
        allowedDepartmentId,
        allowLateOverride: isLeadership,
      });
      const isNew =
        data &&
        "createdAt" in data &&
        "updatedAt" in data &&
        String(data.createdAt) === String(data.updatedAt);
      res.status(isNew ? 201 : 200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  editAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await attendanceService.getRecord(req.params["id"]!);
      await assertDepartmentAccess(req, record.departmentId);
      const data = await attendanceService.editAttendance(
        req.params["id"]!,
        req.body.entries,
        req.user?._id.toString() || "admin",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getRecord: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await attendanceService.getRecord(req.params["id"]!);
      if (req.activeRole === SystemRole.STUDENT) {
        const ownId = req.user!._id.toString();
        const ownEntry = data.entries.find((entry) => entry.studentId.toString() === ownId);
        if (!ownEntry) throw createError(403, "You can view only your own attendance");
        res.json({
          success: true,
          data: {
            ...data,
            entries: [ownEntry],
            correctionRequests: data.correctionRequests?.filter(
              (request) => request.studentId.toString() === ownId,
            ),
          },
        });
        return;
      }
      if (
        req.activeRole === SystemRole.FACULTY &&
        data.facultyId.toString() !== req.user!._id.toString()
      ) {
        throw createError(403, "Faculty can view only their own attendance records");
      }
      await assertDepartmentAccess(req, data.departmentId);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getByFacultyDate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        date,
        from,
        to,
        facultyId: queryFacultyId,
        departmentId: queryDeptId,
        scope,
        subjectId,
        sectionId,
      } = req.query as Record<string, string>;
      const activeRole = req.activeRole;
      const userDeptId = await getDepartmentScope(req);

      let facultyId: string | undefined;
      let departmentId: string | undefined;

      if (activeRole === SystemRole.FACULTY) {
        facultyId = req.user!._id.toString();
      } else if (activeRole === SystemRole.HOD) {
        if (scope === "my") {
          facultyId = req.user!._id.toString();
          departmentId = undefined;
        } else if (queryFacultyId) {
          facultyId = queryFacultyId;
          departmentId = queryDeptId || userDeptId || undefined;
        } else if (queryDeptId) {
          departmentId = queryDeptId;
        } else {
          departmentId = undefined;
          facultyId = undefined;
        }
      } else if (
        [
          SystemRole.SUPER_ADMIN,
          SystemRole.ADMIN,
          SystemRole.PRINCIPAL,
          SystemRole.DEAN_ACADEMIC,
        ].includes(activeRole as SystemRole)
      ) {
        if (scope === "my") {
          facultyId = req.user!._id.toString();
        } else if (queryFacultyId) {
          facultyId = queryFacultyId;
        }
        if (queryDeptId) {
          departmentId = queryDeptId;
        } else if (userDeptId) {
          departmentId = userDeptId;
        }
      } else {
        facultyId = req.user?._id.toString();
      }

      const data = await attendanceService.getAttendanceRecords({
        departmentId,
        facultyId,
        date,
        from,
        to,
        subjectId,
        sectionId,
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getMyRecords: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const data = await attendanceService.getStudentRecords(req.user!._id.toString(), from, to);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getBySubject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const scope: Record<string, unknown> = {};
      if (req.activeRole === SystemRole.FACULTY) scope.facultyId = req.user!._id;
      const data = await attendanceService.getBySubject(req.params["subjectId"]!, from, to, scope);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getStudentSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.query as Record<string, string>;
      const rawStudentId = req.params["studentId"] || req.user?._id.toString() || "";
      const isOwn = rawStudentId === req.user?._id.toString();
      if (req.activeRole === SystemRole.STUDENT && !isOwn) {
        throw createError(403, "Students can view only their own attendance summary");
      }
      let studentUserId = rawStudentId;
      if (!isOwn && req.activeRole !== SystemRole.SUPER_ADMIN) {
        const studentObjId = Types.ObjectId.isValid(rawStudentId)
          ? new Types.ObjectId(rawStudentId)
          : null;
        const profile = await StudentProfileModel.findOne({
          $or: [
            ...(studentObjId ? [{ userId: studentObjId }, { _id: studentObjId }] : []),
            { rollNumber: rawStudentId },
          ],
        })
          .select("userId department")
          .lean();
        if (!profile) throw createError(404, "Student profile not found");
        studentUserId = profile.userId ? String(profile.userId) : rawStudentId;
        await assertDepartmentAccess(req, profile.department);
      }
      const data = await attendanceService.getStudentSummary(
        studentUserId,
        Number(semester),
        academicYear,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getShortageList: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.query as Record<string, string>;
      const userDeptId = await getDepartmentScope(req);
      const queryDeptId = req.query["departmentId"] as string | undefined;
      const departmentId =
        queryDeptId || (req.activeRole === SystemRole.HOD ? userDeptId : undefined);
      const data = await attendanceService.getShortageList(
        Number(semester),
        academicYear,
        departmentId,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getPendingCorrections: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = await applyDepartmentScope(req, {});
      const data = await attendanceService.getPendingCorrections(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  lockOldRecords: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await attendanceService.lockOldRecords();
      res.json({ success: true, message: "Old records locked" });
    } catch (e) {
      next(e);
    }
  },

  requestCorrection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestedBy = (req.user!._id as unknown as string).toString();
      const data = await attendanceService.requestCorrection({
        ...req.body,
        recordId: req.params["id"]!,
        studentId: requestedBy,
        requestedBy,
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  approveCorrection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const approvedBy = (req.user!._id as unknown as string).toString();
      const record = await attendanceService.getRecord(req.params.id);
      await assertDepartmentAccess(req, record.departmentId);
      const data = await attendanceService.approveCorrection(
        req.params.id,
        Number(req.params.idx),
        approvedBy,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  rejectCorrection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewedBy = req.user!._id.toString();
      const record = await attendanceService.getRecord(req.params.id);
      await assertDepartmentAccess(req, record.departmentId);
      const data = await attendanceService.rejectCorrection(
        req.params.id,
        Number(req.params.idx),
        reviewedBy,
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  /** Semester-end lock (SRS §8.2) — permanently lock all records for given academic year */
  lockSemesterAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear } = req.body as { academicYear: string };
      if (!academicYear) {
        res.status(400).json({ success: false, error: { message: "academicYear is required" } });
        return;
      }
      const result = await attendanceService.lockSemesterAttendance(academicYear);
      res.json({ success: true, message: `Attendance locked for ${academicYear}`, data: result });
    } catch (e) {
      next(e);
    }
  },
};
