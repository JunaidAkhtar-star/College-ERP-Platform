import { Router } from "express";
import { authenticate, requireRoles, ipWhitelist } from "../middlewares";
import { adminController } from "../controllers/admin.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const superAdmin = requireRoles([SystemRole.SUPER_ADMIN]);
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HR_DEPARTMENT,
]);

// Apply IP whitelisting to all admin routes (SRS §10.1)
router.use(ipWhitelist);

// Self profile
router.get("/me", authenticate, adminController.getSelf);
router.put("/me", authenticate, adminController.updateSelf);

// User management (admin)
router.get("/users", authenticate, admin, adminController.listUsers);
router.get("/users/:id", authenticate, admin, adminController.getUserById);
router.post("/users", authenticate, admin, adminController.createUser);
router.put("/users/:id", authenticate, admin, adminController.updateUser);
router.patch("/users/:id/status", authenticate, admin, adminController.setUserStatus);
router.post("/users/:id/reset-password", authenticate, superAdmin, adminController.resetPassword);

export default router;
