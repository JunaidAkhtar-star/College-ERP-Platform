import { Router } from "express";
import { body, param } from "express-validator";
import { counselingController } from "../controllers/counseling.controller";
import { authenticate, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { CounselingType } from "../models/counseling-session.model";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.COUNSELING, PermissionAction.VIEW);
const canCreate = requirePermission(Module.COUNSELING, PermissionAction.CREATE);
const canEdit = requirePermission(Module.COUNSELING, PermissionAction.EDIT);

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Schedule a new counseling session (Faculty/Mentor/HOD/Admin)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/sessions",
  canCreate,
  [
    body("studentId").isMongoId().withMessage("Valid student ID required"),
    body("type").isIn(Object.values(CounselingType)).withMessage("Invalid counseling type"),
    body("scheduledAt").isISO8601().withMessage("Valid date-time required"),
    body("mode").isIn(["in_person", "online", "phone"]).withMessage("Invalid mode"),
    body("issueDescription").notEmpty().withMessage("Issue description is required"),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester").optional().isInt({ min: 1, max: 8 }),
  ],
  validate,
  counselingController.scheduleSession,
);

// ─────────────────────────────────────────────────────────────────────────────
// List all sessions (HOD / Admin)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/sessions", canView, counselingController.listSessions);

// ─────────────────────────────────────────────────────────────────────────────
// Stats (counselor dashboard)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/stats", canView, counselingController.getStats);

// ─────────────────────────────────────────────────────────────────────────────
// Student-specific sessions
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/students/:studentId/sessions",
  canView,
  [param("studentId").isMongoId()],
  validate,
  counselingController.getStudentSessions,
);

// ─────────────────────────────────────────────────────────────────────────────
// Single session operations
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/sessions/:id",
  canView,
  [param("id").isMongoId()],
  validate,
  counselingController.getSession,
);

router.patch(
  "/sessions/:id/conduct",
  [param("id").isMongoId()],
  validate,
  canEdit,
  counselingController.conductSession,
);

router.patch(
  "/sessions/:id/cancel",
  [param("id").isMongoId()],
  validate,
  canEdit,
  counselingController.cancelSession,
);

router.patch(
  "/sessions/:id/follow-up/:index/complete",
  [param("id").isMongoId(), param("index").isInt({ min: 0 })],
  validate,
  canEdit,
  counselingController.completeFollowUp,
);

export default router;
