import type { Request, Response, NextFunction } from "express";
import { eventService } from "../services";
import { EMPLOYEE_ROLES, SystemRole } from "../constants/roles";
import { getDepartmentScope } from "../utils/ownership.util";
import { StudentProfileModel } from "../models/student-profile.model";
import createError from "http-errors";
import { EventModel } from "../models/event.model";

const globalEventRoles = new Set([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
]);
const idOf = (value: unknown) => String((value as { _id?: unknown })?._id ?? value ?? "");

async function eventDepartment(req: Request) {
  if (req.activeRole === SystemRole.STUDENT) {
    const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
      .select("department")
      .lean();
    return profile?.department?.toString();
  }
  return getDepartmentScope(req);
}

async function listScope(req: Request) {
  const role = req.activeRole as SystemRole;
  const userId = String(req.user!._id);
  if (globalEventRoles.has(role)) return {};
  const departmentId = await eventDepartment(req);
  if (role === SystemRole.HOD) {
    if (!departmentId) throw createError(403, "Department ownership is required");
    return { $or: [{ organizingDepartment: departmentId }, { createdBy: userId }] };
  }
  const audience =
    role === SystemRole.STUDENT ? "student" : EMPLOYEE_ROLES.includes(role) ? "faculty" : undefined;
  const published = {
    isPublished: true,
    targetAudience: { $in: audience ? ["all", audience] : ["all"] },
    $and: [
      {
        $or: [
          { organizingDepartment: { $exists: false } },
          ...(departmentId ? [{ organizingDepartment: departmentId }] : []),
        ],
      },
    ],
  };
  if (role === SystemRole.FACULTY) {
    return { $or: [{ createdBy: userId }, { coordinators: userId }, published] };
  }
  return published;
}

function canManageEvent(req: Request, event: Record<string, unknown>) {
  const role = req.activeRole as SystemRole;
  const userId = String(req.user!._id);
  if (globalEventRoles.has(role)) return true;
  if (idOf(event.createdBy) === userId) return true;
  return ((event.coordinators as unknown[] | undefined) ?? []).some((id) => idOf(id) === userId);
}

export const eventController = {
  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventService.stats(await listScope(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventType, isPublished, departmentId } = req.query;
      const filter: Record<string, unknown> = {};
      if (eventType) filter.eventType = eventType;
      if (isPublished !== undefined) filter.isPublished = isPublished === "true";
      if (departmentId) filter.organizingDepartment = departmentId;
      const scope = await listScope(req);
      const result = await eventService.getAll(
        { ...filter, ...scope },
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      const own = await EventModel.find({
        _id: { $in: result.data.map((event) => event._id) },
        "registrations.userId": req.user!._id,
      })
        .select("_id registrations")
        .lean();
      const ownByEvent = new Map(
        own.map((event) => [
          event._id.toString(),
          event.registrations.find((entry) => idOf(entry.userId) === String(req.user!._id)),
        ]),
      );
      res.json({
        success: true,
        ...result,
        data: result.data.map((event) => ({
          ...event,
          myRegistration: ownByEvent.get(event._id.toString()),
          isRegistered: ownByEvent.has(event._id.toString()),
        })),
      });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      const scoped = await eventService.getAll(
        { _id: req.params.id, ...(await listScope(req)) },
        1,
        1,
      );
      if (!scoped.data.length) throw createError(404, "Event not found or access denied");
      const ownRegistration = data.registrations?.find(
        (entry) => idOf(entry.userId) === String(req.user!._id),
      );
      if (canManageEvent(req, data as unknown as Record<string, unknown>)) {
        res.json({
          success: true,
          data: {
            ...data,
            myRegistration: ownRegistration,
            isRegistered: Boolean(ownRegistration),
          },
        });
        return;
      }
      res.json({
        success: true,
        data: {
          ...data,
          registrations: undefined,
          myRegistration: ownRegistration,
          isRegistered: Boolean(ownRegistration),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const requestedDepartment = req.body.organizingDepartment;
      if (departmentId && requestedDepartment && String(requestedDepartment) !== departmentId) {
        throw createError(403, "You can organize events only for your department");
      }
      const data = await eventService.create(
        { ...req.body, ...(departmentId ? { organizingDepartment: departmentId } : {}) },
        req.user?._id.toString() || "",
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await eventService.getById(req.params.id);
      if (!current || !canManageEvent(req, current as unknown as Record<string, unknown>)) {
        throw createError(
          403,
          "Only the event owner, coordinator, or institution manager can edit it",
        );
      }
      const data = await eventService.update(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await eventService.getById(req.params.id);
      if (!current) throw createError(404, "Event not found");
      const departmentId = await getDepartmentScope(req);
      if (departmentId && idOf(current.organizingDepartment) !== departmentId) {
        throw createError(403, "HODs can publish only their department events");
      }
      const data = await eventService.publish(req.params.id, req.user?._id.toString() || "");
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await eventService.getById(req.params.id);
      if (!current || !canManageEvent(req, current as unknown as Record<string, unknown>)) {
        throw createError(
          403,
          "Only an event owner, coordinator, or institution manager can cancel it",
        );
      }
      const data = await eventService.cancel(
        req.params.id,
        String(req.body.reason ?? ""),
        req.user!._id.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await eventService.register(
        req.params.id,
        req.user!._id as unknown as string,
        String(req.activeRole),
        await eventDepartment(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  markAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      const current = await eventService.getById(req.params.id);
      if (!current || !canManageEvent(req, current as unknown as Record<string, unknown>)) {
        throw createError(
          403,
          "Only an event owner, coordinator, or institution manager can mark attendance",
        );
      }
      await eventService.markAttendance(
        req.params.id,
        userId || (req.user!._id as unknown as string),
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
