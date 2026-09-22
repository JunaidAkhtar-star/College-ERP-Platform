import type { Request, Response, NextFunction } from "express";
import { academicCalendarService } from "../services";
import { StudentProfileModel } from "../models/student-profile.model";
import { SystemRole } from "../constants/roles";

async function visibleDepartment(req: Request) {
  if (req.activeRole === SystemRole.STUDENT) {
    const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
      .select("department")
      .lean();
    return profile?.department?.toString();
  }
  return req.user?.department ? String(req.user.department) : undefined;
}

export const academicCalendarController = {
  hierarchyContext: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await visibleDepartment(req);
      const data = await academicCalendarService.getHierarchyContext(
        req.activeRole,
        departmentId,
        req.user?._id?.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  visible: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await visibleDepartment(req);
      const { targetUserId, targetDepartmentId, scope } = req.query;
      const data = await academicCalendarService.getVisible(
        req.activeRole,
        departmentId,
        req.user?._id?.toString(),
        {
          targetUserId: targetUserId ? String(targetUserId) : undefined,
          targetDepartmentId: targetDepartmentId ? String(targetDepartmentId) : undefined,
          scope: scope as "self" | "department" | "faculty" | "mentee" | undefined,
        },
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  savePersonalEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.savePersonalEvent(
        req.user!._id.toString(),
        req.body,
        req.params.id,
      );
      res.status(req.params.id ? 200 : 201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  deletePersonalEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await academicCalendarService.deletePersonalEvent(req.user!._id.toString(), req.params.id);
      res.json({ success: true, message: "Personal event deleted" });
    } catch (err) {
      next(err);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, semesterType } = req.query;
      const filter: Record<string, unknown> = {};
      if (academicYear) filter.academicYear = academicYear;
      if (semesterType) filter.semesterType = semesterType;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const result = await academicCalendarService.getAll(filter, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.create(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.update(
        req.params.id,
        req.body,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  addEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.addEvent(
        req.params.id,
        req.body,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  removeEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.removeEvent(
        req.params.id,
        req.params.eventId,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await academicCalendarService.publish(req.params.id, String(req.user?._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
