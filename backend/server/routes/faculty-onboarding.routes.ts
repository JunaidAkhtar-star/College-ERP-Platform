import { Router } from "express";
import { body, param } from "express-validator";
import { facultyOnboardingController } from "../controllers/faculty-onboarding.controller";
import { authenticate, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();

// ── Public: resolve invite + complete invite (no auth, token-gated) ──────────
router.get(
  "/invite/:token",
  [param("token").isString().isLength({ min: 32 }).withMessage("Invalid token")],
  validate,
  facultyOnboardingController.resolveInvite,
);

router.post(
  "/invite/complete",
  [
    body("token").isString().isLength({ min: 32 }).withMessage("Invalid token"),
    body("password").isString().isLength({ min: 8 }).withMessage("Min 8 characters"),
  ],
  validate,
  facultyOnboardingController.completeInvite,
);

// ── Admin: draft persistence ─────────────────────────────────────────────────
router.get(
  "/draft",
  authenticate,
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE),
  facultyOnboardingController.getDraft,
);

router.post(
  "/draft",
  authenticate,
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE),
  facultyOnboardingController.saveDraft,
);

router.delete(
  "/draft",
  authenticate,
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE),
  facultyOnboardingController.deleteDraft,
);

// ── Admin: create faculty account ────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE),
  [
    body("joiningType")
      .isIn(["teaching", "non_teaching", "new", "existing"])
      .withMessage("joiningType is required"),
    body("name").isString().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("roles").isArray({ min: 1 }).withMessage("At least one role is required"),
    body("departmentId").isMongoId().withMessage("Valid department is required"),
    body("profile").isObject().withMessage("Profile payload is required"),
  ],
  validate,
  facultyOnboardingController.create,
);

export default router;
