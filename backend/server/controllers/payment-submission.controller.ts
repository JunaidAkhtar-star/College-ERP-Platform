import type { Request, Response, NextFunction } from "express";
import { paymentSubmissionService } from "../services/payment-submission.service";
import { userRepository } from "../repositories/user.repository";
import { paymentSubmissionRepository } from "../repositories/payment-submission.repository";
import type { UploadedFile } from "express-fileupload";

export const paymentSubmissionController = {
  // ── Student endpoints ────────────────────────────────────────────────────

  /** POST /fee/submissions — student submits payment proof */
  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const screenshotFile = req.files?.screenshot as UploadedFile | undefined;
      const data = await paymentSubmissionService.submit(
        {
          ...req.body,
          studentId: req.user!._id.toString(),
        },
        screenshotFile,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /fee/submissions/:id/resubmit — student resubmits after rejection */
  resubmit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const screenshotFile = req.files?.screenshot as UploadedFile | undefined;
      const data = await paymentSubmissionService.resubmit(
        req.params["id"]!,
        req.user!._id.toString(),
        req.body,
        screenshotFile,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /fee/submissions — student's own submissions */
  mySubmissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSubmissionService.getByStudent(req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /fee/submissions/:id — get single submission (student or accounts) */
  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isStudent = req.activeRole === "student";
      const data = await paymentSubmissionService.getById(
        req.params["id"]!,
        isStudent ? req.user!._id.toString() : undefined,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /fee/submissions/record/:feeRecordId — all submissions for a fee record */
  getByFeeRecord: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isStudent = req.activeRole === "student";
      const data = await paymentSubmissionService.getByFeeRecord(
        req.params["feeRecordId"]!,
        isStudent ? req.user!._id.toString() : undefined,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Accounts team endpoints ──────────────────────────────────────────────

  /** GET /accounts/payment-submissions — list with filters */
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, academicYear, program } = req.query;
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (academicYear) filter.academicYear = academicYear;
      if (program) filter.program = program;
      const data = await paymentSubmissionService.list(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /accounts/payment-submissions/:id/review — mark under review */
  markUnderReview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSubmissionService.markUnderReview(
        req.params["id"]!,
        req.user!._id.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /accounts/payment-submissions/:id/approve — approve + record payment */
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const receiptFile = req.files?.receipt as UploadedFile | undefined;
      const body = { ...req.body };
      if (!body.studentEmail || !body.studentName) {
        const sub = await paymentSubmissionRepository.findById(req.params["id"]!);
        if (sub) {
          const student = await userRepository.findById(sub.studentId.toString());
          if (student) {
            if (!body.studentEmail) body.studentEmail = student.email;
            if (!body.studentName) body.studentName = sub.studentName ?? student.name;
          }
        }
      }
      const result = await paymentSubmissionService.approve(
        req.params["id"]!,
        req.user!._id.toString(),
        req.user!.name,
        body,
        receiptFile,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  retryReceipt: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const receiptFile = req.files?.receipt as UploadedFile | undefined;
      const result = await paymentSubmissionService.generateOfficialReceipt(
        req.params["id"]!,
        req.user!.name,
        receiptFile,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /accounts/payment-submissions/:id/reject — reject submission */
  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason, requireResubmit } = req.body;
      const data = await paymentSubmissionService.reject(
        req.params["id"]!,
        req.user!._id.toString(),
        reason,
        requireResubmit !== false,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /accounts/payment-submissions/counts — status counts for dashboard */
  getCounts: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSubmissionService.getCounts();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
