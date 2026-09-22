import type { RequestHandler } from "express";
import { admissionService } from "../services/admission.service";
import { responseUtil } from "../utils/response.util";
import createError, { BadRequest } from "http-errors";
import type { UploadedFile } from "express-fileupload";
import { parsePagination } from "../utils/pagination.util";

export const admissionController: Record<string, RequestHandler> = {
  async listAdmissionPrograms(_req, res, next) {
    try {
      responseUtil.success(res, await admissionService.listAdmissionPrograms());
    } catch (err) {
      next(err);
    }
  },
  async listSeatMatrix(req, res, next) {
    try {
      const rows = await admissionService.listSeatMatrix(String(req.query.academicYear));
      responseUtil.success(res, rows);
    } catch (err) {
      next(err);
    }
  },

  async upsertSeatMatrix(req, res, next) {
    try {
      const row = await admissionService.upsertSeatMatrix(req.body, req.user!);
      responseUtil.success(res, row, "Seat matrix updated");
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/apply — public route */
  async applyOnline(req, res, next) {
    try {
      const application = await admissionService.submitApplication(
        req.body,
        String(req.body.academicYear),
      );
      responseUtil.created(res, application, "Application submitted successfully");
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/initiate — admission cell creates a draft + applicant credentials */
  async initiateApplication(req, res, next) {
    try {
      const result = await admissionService.initiateApplication(req.body, req.user!, req);
      responseUtil.created(res, result, "Application initiated. Credentials emailed to applicant.");
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/my-application — applicant fetches their own draft */
  async getMyApplication(req, res, next) {
    try {
      const application = await admissionService.getMyApplication(req.user!._id);
      responseUtil.success(res, application);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/my-application — applicant updates their draft */
  async updateMyApplication(req, res, next) {
    try {
      const application = await admissionService.updateMyApplication(req.user!._id, req.body);
      responseUtil.success(res, application, "Application updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id — staff updates application form by ID */
  async updateApplication(req, res, next) {
    try {
      const application = await admissionService.updateApplicationById(req.params.id, req.body);
      responseUtil.success(res, application, "Application form updated");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /admission/applications/:id — staff permanently deletes application, user, and docs */
  async deleteApplication(req, res, next) {
    try {
      const result = await admissionService.deleteApplication(req.params.id);
      responseUtil.success(res, result, "Application deleted permanently");
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/my-application/submit — applicant submits their draft */
  async submitMyApplication(req, res, next) {
    try {
      const application = await admissionService.submitMyApplication(req.user!._id);
      responseUtil.success(res, application, "Application submitted");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/my-application/payment — applicant updates payment details */
  async updateMyPaymentInfo(req, res, next) {
    try {
      const screenshot = req.files?.screenshot;
      if (Array.isArray(screenshot)) {
        throw new BadRequest("A single 'screenshot' file is allowed");
      }
      const application = await admissionService.updateMyPaymentInfo(
        req.user!._id,
        req.body,
        screenshot,
      );
      responseUtil.success(res, application, "Payment details submitted for verification");
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/my-application/documents/:docType — applicant uploads a single doc */
  async uploadMyDocument(req, res, next) {
    try {
      const file = req.files?.document;
      if (!file || Array.isArray(file)) {
        throw new BadRequest("A single 'document' file is required");
      }
      const item = await admissionService.uploadMyDocument(req.user!._id, req.params.docType, file);
      responseUtil.success(res, item, "Document uploaded");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /admission/my-application/documents/:docType?publicId=... */
  async deleteMyDocument(req, res, next) {
    try {
      const publicId =
        typeof req.query.publicId === "string" && req.query.publicId.length
          ? req.query.publicId
          : undefined;
      const result = await admissionService.deleteMyDocument(
        req.user!._id,
        req.params.docType,
        publicId,
      );
      responseUtil.success(res, result, "Document removed");
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/status/:applicationNumber — public */
  async checkStatus(req, res, next) {
    try {
      const application = await admissionService.getByApplicationNumber(
        req.params.applicationNumber,
      );
      // Return only status-level info publicly
      responseUtil.success(res, {
        applicationNumber: application.applicationNumber,
        status: application.status,
        allocatedProgram: application.allocatedProgram,
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/applications — admission cell */
  async listApplications(req, res, next) {
    try {
      const query = parsePagination(req.query as Record<string, unknown>);
      const filter: Record<string, unknown> = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.query.program) filter.allocatedProgram = req.query.program;
      const result = await admissionService.listApplications(query, filter);
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/applications/:id */
  async getApplication(req, res, next) {
    try {
      const application = await admissionService.getApplication(req.params.id);
      responseUtil.success(res, application);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/start-review — AO/AOO moves SUBMITTED → UNDER_REVIEW */
  async startReview(req, res, next) {
    try {
      const application = await admissionService.startReview(req.params.id, req.user!, req);
      responseUtil.success(res, application, "Review started");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/documents/:docType/review */
  async reviewDocument(req, res, next) {
    try {
      const { action, reason, originalSubmitted, photocopySubmitted } = req.body as {
        action: "verify" | "reject" | "set-original" | "request";
        reason?: string;
        originalSubmitted?: boolean;
        photocopySubmitted?: boolean;
      };
      const item = await admissionService.reviewDocument(
        req.params.id,
        req.params.docType,
        action,
        reason,
        req.user!,
        req,
        originalSubmitted,
        photocopySubmitted,
      );
      responseUtil.success(
        res,
        item,
        action === "verify"
          ? "Document verified"
          : action === "reject"
            ? "Document rejected"
            : action === "request"
              ? "Document requested"
              : "Original flag updated",
      );
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/applications/:id/documents/:docType — verifier uploads document */
  async uploadApplicationDocument(req, res, next) {
    try {
      const file = req.files?.document;
      if (!file || Array.isArray(file)) {
        throw new BadRequest("A single 'document' file is required");
      }
      const item = await admissionService.uploadApplicationDocument(
        req.params.id,
        req.params.docType,
        file,
      );
      responseUtil.success(res, item, "Document uploaded");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /admission/applications/:id/documents/:docType — verifier deletes document file */
  async deleteApplicationDocument(req, res, next) {
    try {
      const publicId =
        typeof req.query.publicId === "string" && req.query.publicId.length
          ? req.query.publicId
          : undefined;
      const result = await admissionService.deleteApplicationDocument(
        req.params.id,
        req.params.docType,
        publicId,
      );
      responseUtil.success(res, result, "Document removed");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/booking-payment — verifier updates booking payment details */
  async updateBookingPayment(req, res, next) {
    try {
      const application = await admissionService.updateBookingPayment(
        req.params.id,
        req.body,
        req.user!,
        req,
      );
      responseUtil.success(res, application, "Booking payment details updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/payment — verifier/admin updates payment details */
  async updatePaymentInfo(req, res, next) {
    try {
      const screenshot = req.files?.screenshot;
      if (Array.isArray(screenshot)) {
        throw new BadRequest("A single 'screenshot' file is allowed");
      }
      const application = await admissionService.updatePaymentInfo(
        req.params.id,
        req.body,
        screenshot,
        req.user!,
        req,
      );
      responseUtil.success(res, application, "Payment details updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/payment/review — verify or reject payment */
  async reviewPaymentInfo(req, res, next) {
    try {
      const { action, remarks } = req.body as {
        action: "approve" | "reject";
        remarks?: string;
      };
      const application = await admissionService.reviewPaymentInfo(
        req.params.id,
        action,
        remarks,
        req.user!,
        req,
      );
      responseUtil.success(
        res,
        application,
        action === "approve" ? "Payment verified" : "Payment rejected",
      );
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/decide — AO/AOO approves or rejects the application */
  async decideApplication(req, res, next) {
    try {
      const { decision, remarks } = req.body as {
        decision: "approved" | "rejected";
        remarks: string;
      };
      const application = await admissionService.decideApplication(
        req.params.id,
        decision,
        remarks,
        req.user!,
        req,
      );
      responseUtil.success(res, application, `Application ${decision}`);
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/applications/:id/enroll */
  async confirmEnrollment(req, res, next) {
    try {
      const application = await admissionService.confirmEnrollment(req.params.id, req.user!, req);
      responseUtil.success(res, application, "Enrollment confirmed");
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/dashboard */
  async getDashboard(req, res, next) {
    try {
      const stats = await admissionService.getDashboardStats(String(req.query.academicYear));
      responseUtil.success(res, stats);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admission/applications/:id/payment — Accounts section records booking payment */
  async recordPayment(req, res, next) {
    try {
      const application = await admissionService.recordPayment(
        req.params.id,
        req.body,
        req.user!,
        req,
      );
      responseUtil.success(res, application, "Payment details recorded");
    } catch (err) {
      next(err);
    }
  },

  /** GET /admission/bulk-import/template — downloads a CSV template */
  async getBulkImportTemplate(_req, res, next) {
    try {
      const csv = admissionService.getBulkImportTemplate();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=admission-bulk-import-template.csv`,
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },

  /** POST /admission/bulk-import?academicYear=YYYY-YY — multipart "file" */
  async bulkImport(req, res, next) {
    try {
      const file = req.files?.file as UploadedFile | undefined;
      if (!file) {
        throw createError(400, "CSV file is required (field name: file)");
      }
      const academicYear = String(req.query.academicYear);
      const result = await admissionService.bulkImportApplications(file, academicYear);
      responseUtil.success(
        res,
        result,
        `Imported ${result.created} of ${result.total} applications`,
      );
    } catch (err) {
      next(err);
    }
  },

  async updateMyOnboarding(req, res, next) {
    try {
      const { onboardStatus, transportOption } = req.body;
      const application = await admissionService.updateOnboarding(
        undefined,
        req.user?._id,
        onboardStatus,
        transportOption,
      );
      responseUtil.success(res, application, "Onboarding choice updated");
    } catch (err) {
      next(err);
    }
  },

  async updateOnboarding(req, res, next) {
    try {
      const { onboardStatus, transportOption } = req.body;
      const application = await admissionService.updateOnboarding(
        req.params.id,
        undefined,
        onboardStatus,
        transportOption,
      );
      responseUtil.success(res, application, "Onboarding choice updated");
    } catch (err) {
      next(err);
    }
  },
};
