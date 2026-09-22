import { Router } from "express";
import { body, param } from "express-validator";
import { assessmentPolicyController } from "../controllers/assessment-policy.controller";
import { authenticate, requirePermission, validate } from "../middlewares";
import { Module, PermissionAction } from "../constants/permissions";
const router = Router();
const id = [param("id").isMongoId().withMessage("Invalid policy ID")];
router.get(
  "/",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.VIEW),
  assessmentPolicyController.list,
);
router.get(
  "/:id",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.VIEW),
  assessmentPolicyController.get,
);
router.post(
  "/",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.CREATE),
  [
    body("name").trim().notEmpty(),
    body("code").trim().notEmpty(),
    body("version").isInt({ min: 1 }),
    body("maximumMarks").isFloat({ gt: 0 }),
    body("effectiveFrom").isISO8601(),
    body("components").isArray({ min: 1 }),
  ],
  validate,
  assessmentPolicyController.create,
);
router.put(
  "/:id",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.EDIT),
  assessmentPolicyController.update,
);
router.post(
  "/:id/publish",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.APPROVE),
  assessmentPolicyController.publish,
);
router.post(
  "/:id/retire",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.APPROVE),
  assessmentPolicyController.retire,
);
router.post(
  "/:id/clone",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.CREATE),
  assessmentPolicyController.clone,
);
router.post(
  "/:id/preview",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.VIEW),
  assessmentPolicyController.preview,
);
export default router;
