import type { Request, Response, NextFunction } from "express";
import { noticeService } from "../services";
import createError from "http-errors";
import { Module, PermissionAction } from "../constants/permissions";
import { StudentProfileModel } from "../models/student-profile.model";

const canManageNotices = (req: Request) =>
  Boolean(
    req.permissions?.some(
      (permission) =>
        permission.module === Module.NOTICE &&
        permission.actions.some((action) => action !== PermissionAction.VIEW),
    ),
  );

function idOf(value: unknown): string {
  if (typeof value === "object" && value && "_id" in value)
    return String((value as { _id: unknown })._id);
  return String(value ?? "");
}

async function assertNoticeVisible(req: Request, notice: Record<string, unknown>) {
  if (canManageNotices(req)) return;
  if (
    !notice.isPublished ||
    (notice.expiryDate && new Date(String(notice.expiryDate)) <= new Date())
  )
    throw createError(404, "Notice not found");
  const type = String(notice.noticeType);
  if (type === "global") return;
  if (type === "role_based") {
    const targetRoles = Array.isArray(notice.targetRoles) ? notice.targetRoles.map(String) : [];
    if (targetRoles.includes(String(req.activeRole))) return;
  }
  const departmentId = idOf(req.user?.department);
  if (type === "department") {
    const targets = Array.isArray(notice.targetDepartments)
      ? notice.targetDepartments.map(idOf)
      : [];
    if (departmentId && targets.includes(departmentId)) return;
  }
  if (type === "program" && req.activeRole === "student") {
    const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
      .select("program")
      .lean();
    const targets = Array.isArray(notice.targetPrograms) ? notice.targetPrograms.map(String) : [];
    if (profile?.program && targets.includes(String(profile.program))) return;
  }
  throw createError(404, "Notice not found");
}

export const noticeController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noticeType, priority, isPublished } = req.query;
      const filter: Record<string, unknown> = {};
      if (noticeType) filter.noticeType = noticeType;
      if (priority) filter.priority = priority;
      if (isPublished !== undefined) filter.isPublished = isPublished === "true";
      const result = await noticeService.getAll(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getActive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const roles = req.activeRole ? [String(req.activeRole)] : [];
      const deptId = idOf(user.department);
      const profile =
        req.activeRole === "student"
          ? await StudentProfileModel.findOne({ userId: user._id }).select("program").lean()
          : null;
      const result = await noticeService.getActiveForUser(
        roles,
        deptId ? [deptId] : [],
        profile?.program ? [String(profile.program)] : [],
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
        String(user._id),
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await noticeService.stats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await noticeService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      await assertNoticeVisible(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await noticeService.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await noticeService.update(req.params.id, {
        ...req.body,
        updatedBy: req.user!._id,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await noticeService.publish(req.params.id, String(req.user!._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await noticeService.delete(req.params.id, String(req.user!._id));
      res.json({ success: true, message: "Draft notice withdrawn" });
    } catch (err) {
      next(err);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notice = await noticeService.getById(req.params.id);
      if (!notice) throw createError(404, "Notice not found");
      await assertNoticeVisible(req, notice as unknown as Record<string, unknown>);
      await noticeService.markRead(req.params.id, req.user!._id as unknown as string);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
