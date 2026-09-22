import type { Request, Response, NextFunction } from "express";
import { mentorService } from "../services";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";

function idOf(value: unknown) {
  if (typeof value === "object" && value && "_id" in value)
    return String((value as { _id: unknown })._id);
  return String(value ?? "");
}

async function assertMentorAccess(req: Request, mentor: Record<string, unknown>) {
  await assertDepartmentAccess(req, mentor.departmentId);
  if (req.activeRole === SystemRole.FACULTY && idOf(mentor.facultyId) !== req.user!._id.toString())
    throw createError(403, "Faculty can access only their own mentoring records");
  if (req.activeRole === SystemRole.STUDENT) {
    const mentees = Array.isArray(mentor.menteeIds) ? mentor.menteeIds : [];
    if (!mentees.some((student) => idOf(student) === req.user!._id.toString()))
      throw createError(404, "Mentoring record not found");
  }
}

export const mentorController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, academicYear, departmentId } = req.query;
      const filter: Record<string, unknown> = {};
      if (facultyId) filter.facultyId = facultyId;
      if (academicYear) filter.academicYear = academicYear;
      if (departmentId) filter.departmentId = departmentId;
      if (req.activeRole === SystemRole.FACULTY) filter.facultyId = req.user!._id;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await mentorService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await mentorService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      await assertMentorAccess(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  myMentor: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear } = req.query;
      const data = await mentorService.getMentorForStudent(
        req.user!._id as unknown as string,
        academicYear as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertDepartmentAccess(req, req.body.departmentId);
      const data = await mentorService.create({
        ...req.body,
        facultyId: req.body.facultyId || req.user!._id,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  assignMentee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentor = await mentorService.getById(req.params.id);
      if (!mentor) throw createError(404, "Mentor assignment not found");
      await assertMentorAccess(req, mentor as unknown as Record<string, unknown>);
      const { studentId } = req.body;
      const data = await mentorService.assignMentee(req.params.id, studentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  syncMentees: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentor = await mentorService.getById(req.params.id);
      if (!mentor) throw createError(404, "Mentor assignment not found");
      await assertMentorAccess(req, mentor as unknown as Record<string, unknown>);
      const data = await mentorService.syncMentees(req.params.id, req.body.studentIds);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  logMeeting: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await mentorService.logMeeting(req.params.id, req.body, String(req.user!._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
