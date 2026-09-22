import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { eventController } from "../controllers";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canCreate = requirePermission(Module.EVENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.EVENT, PermissionAction.EDIT);
const canApprove = requirePermission(Module.EVENT, PermissionAction.APPROVE);

router.get("/", authenticate, eventController.list);
router.get("/stats", authenticate, eventController.stats);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  eventController.getById,
);
router.post(
  "/",
  authenticate,
  canCreate,
  [
    body("title").isString().trim().isLength({ min: 3, max: 255 }),
    body("startDate").isISO8601(),
    body("endDate").isISO8601(),
    body("targetAudience").isArray({ min: 1 }),
    body("description").isString().trim().isLength({ min: 1, max: 10000 }),
    body("venue").isString().trim().isLength({ min: 1, max: 500 }),
    body("eventType").isIn([
      "workshop",
      "seminar",
      "cultural",
      "sports",
      "technical",
      "placement",
      "other",
    ]),
    body("targetAudience.*").isIn(["all", "student", "faculty"]),
    body("organizingDepartment").optional().isMongoId(),
    body("coordinators").optional().isArray({ max: 100 }),
    body("coordinators.*").optional().isMongoId(),
    body("maxRegistrations").optional().isInt({ min: 1 }),
  ],
  validate,
  eventController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId()],
  validate,
  authenticate,
  canEdit,
  [
    body("title").optional().isString().trim().isLength({ min: 3, max: 255 }),
    body("description").optional().isString().trim().isLength({ min: 1, max: 10000 }),
    body("venue").optional().isString().trim().isLength({ min: 1, max: 500 }),
    body("startDate").optional().isISO8601(),
    body("endDate").optional().isISO8601(),
    body("eventType")
      .optional()
      .isIn(["workshop", "seminar", "cultural", "sports", "technical", "placement", "other"]),
    body("targetAudience").optional().isArray({ min: 1 }),
    body("targetAudience.*").optional().isIn(["all", "student", "faculty"]),
    body("organizingDepartment").optional().isMongoId(),
    body("coordinators").optional().isArray({ max: 100 }),
    body("coordinators.*").optional().isMongoId(),
    body("maxRegistrations").optional().isInt({ min: 1 }),
  ],
  validate,
  eventController.update,
);
router.post(
  "/:id/publish",
  [param("id").isMongoId()],
  validate,
  authenticate,
  canApprove,
  eventController.publish,
);
router.post(
  "/:id/cancel",
  authenticate,
  canEdit,
  [param("id").isMongoId(), body("reason").isString().trim().isLength({ min: 3, max: 1000 })],
  validate,
  eventController.cancel,
);
router.post(
  "/:id/register",
  [param("id").isMongoId()],
  validate,
  authenticate,
  eventController.register,
);
router.post(
  "/:id/attendance",
  [param("id").isMongoId(), body("userId").isMongoId()],
  validate,
  authenticate,
  canEdit,
  eventController.markAttendance,
);

export default router;
