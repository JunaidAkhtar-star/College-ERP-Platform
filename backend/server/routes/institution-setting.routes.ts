/**
 * Institution Setting Routes
 *
 * Defines HTTP routes for managing global institution settings.
 */
import { Router } from "express";
import { institutionSettingController } from "../controllers/institution-setting.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { SystemRole } from "../constants/roles";

const router = Router();

router.get("/", authenticate, institutionSettingController.getSettings);
router.get("/public", institutionSettingController.getSettings);

router.put(
  "/",
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]),
  institutionSettingController.updateSettings,
);

router.post(
  "/complete-onboarding",
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]),
  institutionSettingController.completeOnboarding,
);

export default router;
