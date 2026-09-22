import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { sectionController } from "../controllers";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.SECTION_MANAGEMENT, PermissionAction.VIEW);
const canCreate = requirePermission(Module.SECTION_MANAGEMENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.SECTION_MANAGEMENT, PermissionAction.EDIT);
const canApprove = requirePermission(Module.SECTION_MANAGEMENT, PermissionAction.APPROVE);

router.get("/", authenticate, canView, sectionController.list);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canView,
  sectionController.getById,
);
router.post(
  "/",
  [
    body("academicYear").notEmpty().withMessage("Academic year required"),
    body("batchId").isMongoId().withMessage("Valid batch required"),
    body("semesterNo").isInt({ min: 1, max: 12 }),
    body("sectionName").notEmpty().withMessage("Section name required"),
    body("capacity").isInt({ min: 1 }),
  ],
  validate,
  authenticate,
  canCreate,
  sectionController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canEdit,
  sectionController.update,
);
router.post(
  "/:id/approve",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canApprove,
  sectionController.approve,
);

export default router;
