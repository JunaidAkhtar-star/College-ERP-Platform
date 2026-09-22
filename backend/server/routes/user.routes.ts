import { Router } from "express";
import { body, param } from "express-validator";
import { adminController } from "../controllers/admin.controller";
import { authenticate, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Self-service (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/me", adminController.getSelf);

router.patch(
  "/me",
  [
    body("name").optional().trim().notEmpty().isLength({ max: 255 }),
    body("phone").optional({ values: "falsy" }).isMobilePhone("any"),
    body("bloodGroup")
      .optional({ values: "falsy" })
      .isIn(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    body("emergencyContact.name").optional().notEmpty(),
    body("emergencyContact.phone").optional().isMobilePhone("any"),
    body("emergencyContact.relationship").optional().notEmpty(),
  ],
  validate,
  adminController.updateSelf,
);

// Avatar upload — multipart form field "avatar"
router.patch("/me/avatar", adminController.updateSelfAvatar);

// ─────────────────────────────────────────────────────────────────────────────
// Governed user management
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE),
  [
    body("name").notEmpty().withMessage("Name is required").trim(),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password")
      .optional()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("roles").isArray({ min: 1 }).withMessage("At least one role is required"),
    body("department").optional().isMongoId(),
  ],
  validate,
  adminController.createUser,
);

router.get(
  "/",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.VIEW),
  adminController.listUsers,
);

router.get(
  "/summary",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.VIEW),
  adminController.getUserDirectorySummary,
);

router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid user ID")],
  validate,
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.VIEW),
  adminController.getUserById,
);

router.get(
  "/:id/access",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.APPROVE),
  [param("id").isMongoId()],
  validate,
  adminController.getUserAccess,
);

router.post(
  "/:id/revoke-sessions",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.APPROVE),
  [param("id").isMongoId()],
  validate,
  adminController.revokeUserSessions,
);

router.patch(
  "/:id",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.EDIT),
  [
    param("id").isMongoId(),
    body("name").optional().notEmpty().trim(),
    body("phone").optional({ values: "falsy" }).isMobilePhone("any"),
    body("status")
      .optional()
      .isIn(["pending_verification", "active", "inactive", "suspended", "blocked"]),
    body("roles").optional().isArray({ min: 1 }),
    body("department").optional().isMongoId(),
  ],
  validate,
  adminController.updateUser,
);

router.patch(
  "/:id/status",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.EDIT),
  [
    param("id").isMongoId(),
    body("status")
      .isIn(["pending_verification", "active", "inactive", "suspended", "blocked"])
      .withMessage("Invalid status"),
    body("reason").trim().isLength({ min: 3, max: 500 }).withMessage("Reason is required"),
  ],
  validate,
  adminController.setUserStatus,
);

router.post(
  "/:id/reset-password",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.APPROVE),
  [param("id").isMongoId(), body("sendEmail").optional().isBoolean()],
  validate,
  adminController.resetPassword,
);

router.delete(
  "/:id/data",
  requirePermission(Module.USER_MANAGEMENT, PermissionAction.DELETE),
  [param("id").isMongoId().withMessage("Invalid user ID")],
  validate,
  adminController.eraseUserData,
);

export default router;
