import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { batchController } from "../controllers";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.BATCH_MANAGEMENT, PermissionAction.VIEW);
const canCreate = requirePermission(Module.BATCH_MANAGEMENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.BATCH_MANAGEMENT, PermissionAction.EDIT);

router.get("/", authenticate, canView, batchController.list);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canView,
  batchController.getById,
);
router.post(
  "/",
  [
    body("curriculumId").isMongoId().withMessage("Valid curriculum required"),
    body("departmentId").isMongoId().withMessage("Valid department required"),
    body("admissionYear").isInt({ min: 2000, max: 2100 }),
    body("intake").optional().isInt({ min: 1 }),
    body("status").not().exists().withMessage("New batches always start as Planned"),
  ],
  validate,
  authenticate,
  canCreate,
  batchController.create,
);
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("intake").optional().isInt({ min: 1 }),
    body("status").optional().isIn(["Planned", "Active", "Passed Out", "Archived"]),
  ],
  validate,
  authenticate,
  canEdit,
  batchController.update,
);

export default router;
