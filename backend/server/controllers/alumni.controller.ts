import type { Request, Response, NextFunction } from "express";
import { alumniService } from "../services";

export const alumniController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { program, branch, passoutYear, isVerified, isPlaced, search } = req.query;
      const filter: Record<string, unknown> = {};
      if (program) filter.program = program;
      if (branch) filter.branch = branch;
      if (passoutYear) filter.passoutYear = Number(passoutYear);
      if (isVerified !== undefined) filter.isVerified = isVerified === "true";
      if (isPlaced !== undefined) filter.isPlaced = isPlaced === "true";
      if (search) {
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { fullName: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
          { rollNumber: { $regex: escaped, $options: "i" } },
          { currentEmployer: { $regex: escaped, $options: "i" } },
        ];
      }
      const result = await alumniService.getAll(
        filter,
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
      const data = await alumniService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  graduationCandidates: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await alumniService.getGraduationCandidates(
        Number(req.query.page) || 1,
        Number(req.query.limit) || 25,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  graduateStudent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.graduateStudent(
        req.params.studentProfileId,
        String(req.user?._id),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.update(req.params.id, req.body, String(req.user?._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  verify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.verify(req.params.id, String(req.user?._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  verifyCareerOutcome: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.verifyCareerOutcome(req.params.id, String(req.user?._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.getStatsByYear();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listEngagements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.listEngagements(
        req.query.status as "planned" | "completed" | "cancelled" | undefined,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  createEngagement: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.createEngagement(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  closeEngagement: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.closeEngagement(
        req.params.id,
        req.body.status,
        req.body.outcome,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Donations (M43) ──────────────────────────────────────────────────────────────
  createDonation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const donation = await alumniService.createDonation(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data: donation });
    } catch (err) {
      next(err);
    }
  },
  listDonations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alumniId, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (alumniId) filter.alumniId = alumniId;
      if (status) filter.status = status;
      const result = await alumniService.listDonations(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
  confirmDonation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const confirmedBy = String(req.user?._id);
      const data = await alumniService.confirmDonation(req.params.id, confirmedBy);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  failDonation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.failDonation(
        req.params.id,
        String(req.user?._id),
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  donationStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await alumniService.donationStats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
