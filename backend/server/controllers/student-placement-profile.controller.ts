import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { studentPlacementProfileService } from "../services/student-placement-profile.service";

export const studentPlacementProfileController = {
  myProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.getMyProfile(
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.createProfile(
        (req.user!._id as unknown as string).toString(),
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.updateProfile(
        (req.user!._id as unknown as string).toString(),
        req.body,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  adminUpdate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.adminUpdate(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  uploadResume: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.resume as UploadedFile | undefined;
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: { message: "Resume file required (field: resume)" } });
      const data = await studentPlacementProfileService.uploadResume(
        (req.user!._id as unknown as string).toString(),
        file,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = "1", limit = "20", ...query } = req.query as Record<string, string>;
      const result = await studentPlacementProfileService.list(query, +page, +limit);
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.getStats(req.query.batch as string);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  myApplications: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentPlacementProfileService.getMyApplications(
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  recalculateEligibility: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const data = await studentPlacementProfileService.recalculateEligibility(studentId, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};
