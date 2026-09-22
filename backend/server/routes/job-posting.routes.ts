import { Router } from "express";
import { param, body, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { jobPostingController } from "../controllers/job-posting.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL, STUDENT } = SystemRole;
const coordinatorGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL]);
const adminViewerGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL]);
const viewerGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL, STUDENT]);

router.get("/stats", authenticate, adminViewerGuard, jobPostingController.stats);

// Admin/coordinator lists (all statuses)
router.get(
  "/admin",
  authenticate,
  adminViewerGuard,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  jobPostingController.list,
);

// Student list (active only)
router.get(
  "/",
  authenticate,
  requireRoles([STUDENT]),
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  jobPostingController.studentList,
);

router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  viewerGuard,
  jobPostingController.getById,
);

router.post(
  "/",
  authenticate,
  coordinatorGuard,
  [
    body("companyName").notEmpty().withMessage("Company name required"),
    body("jobTitle").notEmpty().withMessage("Job title required"),
    body("jobType").isIn(["Full Time", "Internship", "Part Time", "Contract", "Apprenticeship"]),
    body("location").notEmpty().withMessage("Location required"),
    body("description").notEmpty().withMessage("Description required"),
    body("applicationDeadline").isISO8601().withMessage("Valid deadline required"),
    body("applyMode").isIn(["internal", "external"]),
    body("externalApplyLink")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("applyEmail").optional({ checkFalsy: true }).isEmail(),
    body("minCgpa").optional().isFloat({ min: 0, max: 10 }),
    body("maxBacklogs").optional().isInt({ min: 0 }),
    body("salaryMin").optional().isFloat({ min: 0 }),
    body("salaryMax").optional().isFloat({ min: 0 }),
  ],
  validate,
  jobPostingController.create,
);

router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  jobPostingController.update,
);

router.put(
  "/:id/publish",
  authenticate,
  coordinatorGuard,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  jobPostingController.publish,
);

router.put(
  "/:id/close",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  jobPostingController.close,
);

// Upload JD PDF
router.post(
  "/:id/jd",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  jobPostingController.uploadJD,
);

// Student: mark interest
router.post(
  "/:id/interest",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  jobPostingController.markInterest,
);
router.delete(
  "/:id/interest",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  jobPostingController.removeInterest,
);

// Student: mark applied (internal tracking)
router.post(
  "/:id/apply",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  jobPostingController.markApplied,
);

export default router;
