import { Router } from "express";
import { body } from "express-validator";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { authLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();

// Apply strict rate limit to all auth endpoints
router.use(authLimiter);

router.get("/context", authenticate, authController.context);

// Tenant-scoped public account activation. Keeping this under the core auth
// family prevents a student's invitation from requiring the HR entitlement.
router.get("/invite/:token", authController.resolveInvite);
router.post(
  "/invite/complete",
  [
    body("token")
      .isHexadecimal()
      .isLength({ min: 64, max: 64 })
      .withMessage("Invite token is invalid"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  authController.completeInvite,
);

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("identifier")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 254 })
      .withMessage("Valid login ID is required"),
    body("email")
      .if(body("identifier").not().exists())
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  authController.login,
);

// ── POST /api/v1/auth/refresh-token ──────────────────────────────────────────
router.post(
  "/refresh-token",
  [body("refreshToken").notEmpty().withMessage("Refresh token is required")],
  validate,
  authController.refreshToken,
);

router.post(
  "/switch-role",
  authenticate,
  [
    body("role")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-z0-9_]+$|^[a-f0-9]{24}$/i)
      .withMessage("A valid assigned role is required"),
  ],
  validate,
  authController.switchRole,
);

// ── POST /api/v1/auth/forgot-password ─────────────────────────────────────────
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required").normalizeEmail()],
  validate,
  authController.forgotPassword,
);

// ── POST /api/v1/auth/reset-password ──────────────────────────────────────────
router.post(
  "/reset-password",
  [
    body("email").isEmail().normalizeEmail(),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain an uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain a number"),
  ],
  validate,
  authController.resetPassword,
);

// ── POST /api/v1/auth/verify-email ────────────────────────────────────────────
router.post(
  "/verify-email",
  [
    body("email").isEmail().normalizeEmail(),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  ],
  validate,
  authController.verifyEmail,
);

// ── POST /api/v1/auth/change-password (authenticated) ─────────────────────────
router.post(
  "/change-password",
  authenticate,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Must contain uppercase")
      .matches(/[0-9]/)
      .withMessage("Must contain a number"),
  ],
  validate,
  authController.changePassword,
);

// ── MFA / TOTP ────────────────────────────────────────────────────────────────
router.post(
  "/mfa/login-verify",
  [
    body("mfaToken").notEmpty(),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Code must be 6 digits"),
  ],
  validate,
  authController.mfaLoginVerify,
);
router.post("/mfa/setup", authenticate, authController.mfaSetup);
router.post(
  "/mfa/verify",
  authenticate,
  [body("token").isLength({ min: 6, max: 6 })],
  validate,
  authController.mfaVerify,
);
router.post(
  "/mfa/disable",
  authenticate,
  [body("token").isLength({ min: 6, max: 6 })],
  validate,
  authController.mfaDisable,
);

// ── Session Management (M1) ───────────────────────────────────────────────────
router.get("/sessions", authenticate, authController.listSessions);
router.delete("/sessions", authenticate, authController.revokeAllSessions);
router.delete("/sessions/:jti", authenticate, authController.revokeSession);

// ── Mobile MPIN (server-side sync) ───────────────────────────────────────────
router.post(
  "/mpin/setup",
  authenticate,
  [
    body("mpinHash")
      .notEmpty()
      .withMessage("mpinHash is required")
      .isLength({ min: 10 })
      .withMessage("mpinHash must be a valid bcrypt hash"),
  ],
  validate,
  authController.mpinSetup,
);

router.delete("/mpin", authenticate, authController.mpinClear);

export default router;
