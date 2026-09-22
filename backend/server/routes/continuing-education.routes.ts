import { Router } from "express";
import { body, param } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { continuingEducationController } from "../controllers/continuing-education.controller";
import { authenticate, requirePermission, validate } from "../middlewares";
const router = Router();
const canCreate = requirePermission(Module.CURRICULUM, PermissionAction.CREATE);
const canEdit = requirePermission(Module.CURRICULUM, PermissionAction.EDIT);
const canApprove = requirePermission(Module.CURRICULUM, PermissionAction.APPROVE);
router.get(
  "/credentials/:code/verify",
  [param("code").trim().isLength({ min: 8, max: 100 })],
  validate,
  continuingEducationController.verify,
);
router.use(authenticate, requirePermission(Module.CURRICULUM, PermissionAction.VIEW));
router.get("/dashboard", continuingEducationController.dashboard);
router.get("/offerings", continuingEducationController.offerings);
router.post(
  "/offerings",
  canCreate,
  [
    body("code").trim().isLength({ min: 2, max: 30 }),
    body("title").trim().isLength({ min: 2, max: 200 }),
    body("description").trim().isLength({ min: 5, max: 3000 }),
    body("deliveryMode").isIn(["in_person", "online", "hybrid"]),
    body("durationHours").isFloat({ gt: 0 }),
    body("fee").isFloat({ min: 0 }),
    body("credentialType").isIn(["certificate", "badge", "microcredential", "non_credit"]),
    body("learningOutcomes").isArray({ min: 1, max: 50 }),
  ],
  validate,
  continuingEducationController.createOffering,
);
router.get("/cohorts", continuingEducationController.cohorts);
router.post(
  "/cohorts",
  canCreate,
  [
    body("offeringId").isMongoId(),
    body("code").trim().isLength({ min: 2, max: 40 }),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
    body("enrollmentOpensAt").isISO8601(),
    body("enrollmentClosesAt").isISO8601(),
    body("capacity").isInt({ min: 1, max: 100000 }),
    body("instructorId").isMongoId(),
    body("campusId").optional({ checkFalsy: true }).isMongoId(),
  ],
  validate,
  continuingEducationController.createCohort,
);
router.get("/enrollments", continuingEducationController.enrollments);
router.post(
  "/enrollments",
  canCreate,
  [
    body("cohortId").isMongoId(),
    body("learnerId").optional({ checkFalsy: true }).isMongoId(),
    body("learnerName").trim().isLength({ min: 2, max: 160 }),
    body("learnerEmail").isEmail(),
  ],
  validate,
  continuingEducationController.enroll,
);
router.patch(
  "/enrollments/:id/progress",
  canEdit,
  [
    param("id").isMongoId(),
    body("attendancePercent").isFloat({ min: 0, max: 100 }),
    body("assessmentScore").optional().isFloat({ min: 0, max: 100 }),
    body("paymentStatus").optional().isIn(["not_required", "pending", "paid", "refunded"]),
  ],
  validate,
  continuingEducationController.progress,
);
router.post(
  "/enrollments/:id/complete",
  canApprove,
  [
    param("id").isMongoId(),
    body("outcome").isIn(["completed", "failed"]),
    body("attendanceThreshold").isFloat({ min: 0, max: 100 }),
    body("scoreThreshold").optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  continuingEducationController.complete,
);
export default router;
