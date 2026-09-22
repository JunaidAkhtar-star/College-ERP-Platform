import { Router } from "express";
import { param, body } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { paymentSettingsController } from "../controllers/payment-settings.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ACCOUNTS_DEPARTMENT, PRINCIPAL } = SystemRole;

// Anyone authenticated can see payment details (students need it to pay fees)
router.get("/active", authenticate, paymentSettingsController.getActive);

// Admin-only: full list
router.get(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, ACCOUNTS_DEPARTMENT, PRINCIPAL]),
  paymentSettingsController.getAll,
);

// Create / update settings (Super Admin only)
router.post(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN]),
  [body("institutionName").notEmpty().withMessage("Institution name is required")],
  validate,
  paymentSettingsController.upsert,
);

// Upload QR code
router.post(
  "/:id/qr",
  authenticate,
  requireRoles([SUPER_ADMIN, ACCOUNTS_DEPARTMENT]),
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  paymentSettingsController.uploadQr,
);

// Activate a settings record
router.put(
  "/:id/activate",
  authenticate,
  requireRoles([SUPER_ADMIN]),
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  paymentSettingsController.activate,
);

export default router;
