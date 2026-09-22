import { Router } from "express";
import { body, param } from "express-validator";
import type { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import { authenticate, requirePermission, validate } from "../middlewares";
import { grievanceController } from "../controllers/grievance.controller";
import { SystemRole } from "../constants/roles";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.GRIEVANCE, PermissionAction.VIEW);
const canCreate = requirePermission(Module.GRIEVANCE, PermissionAction.CREATE);
const canEdit = requirePermission(Module.GRIEVANCE, PermissionAction.EDIT);

const activeBaseRole = (req: Request): string => req.role?.baseRole ?? req.activeRole ?? "";
const studentOnly = (req: Request, _res: Response, next: NextFunction) =>
  activeBaseRole(req) === SystemRole.STUDENT
    ? next()
    : next(createError(403, "This grievance action is available only to students"));
const staffOnly = (req: Request, _res: Response, next: NextFunction) =>
  activeBaseRole(req) !== SystemRole.STUDENT
    ? next()
    : next(createError(403, "This grievance action requires staff authority"));

// ── Student: file + track own grievances ─────────────────────────────────────

router.post(
  "/",
  authenticate,
  canCreate,
  studentOnly,
  [
    body("type")
      .isIn([
        "academic",
        "examination",
        "faculty",
        "facility",
        "hostel",
        "transport",
        "fee",
        "scholarship",
        "library",
        "ragging",
        "harassment",
        "other",
      ])
      .withMessage("Grievance type is invalid"),
    body("title").trim().isLength({ min: 5, max: 255 }).withMessage("Title must be 5–255 chars"),
    body("description")
      .trim()
      .isLength({ min: 20, max: 5000 })
      .withMessage("Description must be 20–5000 chars"),
  ],
  validate,
  grievanceController.submit,
);

router.get("/mine", authenticate, canView, studentOnly, grievanceController.listMine);

router.get(
  "/ref/:ref",
  authenticate,
  canView,
  [param("ref").notEmpty()],
  validate,
  grievanceController.getByRef,
);

router.patch(
  "/:id/close",
  authenticate,
  canEdit,
  studentOnly,
  [param("id").isMongoId()],
  validate,
  grievanceController.close,
);

router.patch(
  "/:id/rate",
  authenticate,
  canEdit,
  studentOnly,
  [
    param("id").isMongoId(),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1–5"),
  ],
  validate,
  grievanceController.rate,
);

router.patch(
  "/:id/appeal",
  authenticate,
  canEdit,
  studentOnly,
  [param("id").isMongoId(), body("reason").trim().isLength({ min: 20, max: 2000 })],
  validate,
  grievanceController.appeal,
);

// ── Staff: review + respond ───────────────────────────────────────────────────

router.get("/stats", authenticate, canView, grievanceController.stats);

router.get("/authorities", authenticate, canEdit, staffOnly, grievanceController.authorities);

router.get("/", authenticate, canView, staffOnly, grievanceController.list);

router.get(
  "/:id",
  authenticate,
  canView,
  [param("id").isMongoId()],
  validate,
  grievanceController.getById,
);

router.patch(
  "/:id/acknowledge",
  authenticate,
  canEdit,
  staffOnly,
  [param("id").isMongoId()],
  validate,
  grievanceController.acknowledge,
);

router.patch(
  "/:id/respond",
  authenticate,
  canEdit,
  staffOnly,
  [
    param("id").isMongoId(),
    body("response").trim().isLength({ min: 10 }).withMessage("Response must be at least 10 chars"),
  ],
  validate,
  grievanceController.respond,
);

router.patch(
  "/:id/escalate",
  authenticate,
  canEdit,
  staffOnly,
  [
    param("id").isMongoId(),
    body("escalatedToId").isMongoId().withMessage("escalatedToId must be a valid ID"),
    body("note").notEmpty().withMessage("Escalation note is required"),
  ],
  validate,
  grievanceController.escalate,
);

export default router;
