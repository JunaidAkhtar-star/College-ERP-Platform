import type { Request, Response, NextFunction } from "express";
import { meetingService } from "../services";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";
import { StudentProfileModel } from "../models/student-profile.model";
import { getDepartmentScope } from "../utils/ownership.util";

function idOf(value: unknown): string {
  if (!value) return "";
  return String((value as { _id?: unknown })._id || value);
}

async function assertMeetingAccess(req: Request, meeting: Record<string, unknown>) {
  const userId = req.user!._id.toString();
  const roles = [String(req.activeRole)];
  if (roles.includes(SystemRole.SUPER_ADMIN) || roles.includes(SystemRole.PRINCIPAL)) return;
  if (idOf(meeting["conductedBy"]) === userId || idOf(meeting["createdBy"]) === userId) return;
  const invitees = (meeting["invitees"] as unknown[] | undefined) ?? [];
  if (invitees.some((value) => idOf(value) === userId)) return;

  if (roles.includes(SystemRole.STUDENT) && meeting["meetingType"] === "student") {
    const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
      .select("department currentYear")
      .lean();
    const departments = (meeting["targetDepartments"] as unknown[] | undefined) ?? [];
    const years = (meeting["targetYears"] as number[] | undefined) ?? [];
    const departmentAllowed =
      departments.length === 0 ||
      departments.some((value) => idOf(value) === idOf(profile?.department));
    const yearAllowed = years.length === 0 || years.includes(profile?.currentYear ?? -1);
    if (profile && departmentAllowed && yearAllowed) return;
  }
  throw createError(403, "You are not a participant in this meeting");
}

function canManageMeeting(req: Request, meeting: { conductedBy?: unknown; createdBy?: unknown }) {
  const role = String(req.activeRole);
  const userId = String(req.user!._id);
  return (
    [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL].includes(role as SystemRole) ||
    idOf(meeting.conductedBy) === userId ||
    idOf(meeting.createdBy) === userId
  );
}

export const meetingController = {
  usage: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await meetingService.usage() });
    } catch (err) {
      next(err);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { meetingType, status, conductedBy, departmentId } = req.query;
      const filter: Record<string, unknown> = {};
      if (meetingType) filter.meetingType = meetingType;
      if (status) filter.status = status;
      if (conductedBy) filter.conductedBy = conductedBy;
      if (departmentId) filter.department = departmentId;
      const scopedDepartment = await getDepartmentScope(req);
      if (scopedDepartment) {
        if (departmentId && idOf(departmentId) !== scopedDepartment) {
          throw createError(403, "You can access only your department meetings");
        }
        filter.$or = [
          { department: scopedDepartment },
          { targetDepartments: scopedDepartment },
          { conductedBy: req.user!._id },
          { createdBy: req.user!._id },
        ];
        delete filter.department;
      }
      const result = await meetingService.getAll(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /** Faculty: meetings where the current user is an invitee */
  myMeetings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const result = await meetingService.getMyMeetings(
        userId,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
        req.query.status as "scheduled" | "ongoing" | "completed" | "cancelled" | undefined,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /** Student: meetings targeted to their department + year */
  studentMeetings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
        .select("department currentYear")
        .lean();
      if (!profile) throw createError(403, "An active student profile is required");
      const result = await meetingService.getStudentMeetings(
        profile.department ? profile.department.toString() : "",
        profile.currentYear,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
        req.query.status as "scheduled" | "ongoing" | "completed" | "cancelled" | undefined,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  upcomingMeeting: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as unknown as string;
      const roles = [String(req.activeRole)];
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const data = await meetingService.getUpcomingMeeting(userId, roles);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await meetingService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Meeting not found" });
        return;
      }
      await assertMeetingAccess(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const departmentId = await getDepartmentScope(req);
      const targetDepartments = (req.body.targetDepartments as unknown[] | undefined) ?? [];
      if (departmentId && targetDepartments.some((target) => idOf(target) !== departmentId)) {
        throw createError(403, "A HOD can target only their own department");
      }

      const data = await meetingService.create(
        {
          ...req.body,
          conductedBy: user._id,
          ...(departmentId ? { department: departmentId } : {}),
        },
        user._id as unknown as string,
        (user as unknown as Record<string, unknown>).name as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) {
        res.status(404).json({ success: false, message: "Meeting not found" });
        return;
      }
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const isAuthorized = canManageMeeting(req, meeting);

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to update this meeting",
        });
        return;
      }

      const data = await meetingService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) {
        res.status(404).json({ success: false, message: "Meeting not found" });
        return;
      }
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const isAuthorized = canManageMeeting(req, meeting);

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to change the status",
        });
        return;
      }

      const data = await meetingService.updateStatus(req.params.id, status);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  submitConcludingRemarks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { remarks } = req.body;
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) {
        res.status(404).json({ success: false, message: "Meeting not found" });
        return;
      }
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const isAuthorized = canManageMeeting(req, meeting);

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to submit remarks",
        });
        return;
      }

      const data = await meetingService.submitConcludingRemarks(
        req.params.id,
        remarks,
        String(user._id),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  reviewMinutes: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await meetingService.reviewMinutes(
        req.params.id,
        String(req.user!._id),
        req.body.decision,
        req.body.note,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  recordingConsent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) throw createError(404, "Meeting not found");
      await assertMeetingAccess(req, meeting as unknown as Record<string, unknown>);
      const data = await meetingService.consentToRecording(req.params.id, String(req.user!._id));
      res.json({ success: true, data, message: "Recording consent recorded" });
    } catch (err) {
      next(err);
    }
  },

  markAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) throw createError(404, "Meeting not found");
      await assertMeetingAccess(req, meeting as unknown as Record<string, unknown>);
      const data = await meetingService.markAttendance(req.params.id, userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  deletionImpact: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) throw createError(404, "Meeting not found");
      if (!canManageMeeting(req, meeting))
        throw createError(403, "Meeting delete permission required");
      res.json({ success: true, data: await meetingService.deletionImpact(req.params.id) });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.getById(req.params.id);
      if (!meeting) {
        res.status(404).json({ success: false, message: "Meeting not found" });
        return;
      }
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const isAuthorized = canManageMeeting(req, meeting);

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to delete this meeting",
        });
        return;
      }

      const data = await meetingService.delete(req.params.id, String(user._id));
      res.json({ success: true, data, message: "Meeting permanently deleted" });
    } catch (err) {
      next(err);
    }
  },
};
