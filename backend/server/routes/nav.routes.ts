import { Router } from "express";
import { navController } from "../controllers/nav.controller";
import { authenticate, requirePermission } from "../middlewares";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const auth = authenticate;

// Current user's role-filtered nav tree.
router.get("/me", auth, navController.me);

// Admin CRUD.
router.get(
  "/",
  auth,
  requirePermission(Module.ROLE_MANAGEMENT, PermissionAction.VIEW),
  navController.list,
);
router.post(
  "/",
  auth,
  requirePermission(Module.ROLE_MANAGEMENT, PermissionAction.CREATE),
  navController.create,
);
router.post(
  "/reorder",
  auth,
  requirePermission(Module.ROLE_MANAGEMENT, PermissionAction.EDIT),
  navController.reorder,
);
router.put(
  "/:id",
  auth,
  requirePermission(Module.ROLE_MANAGEMENT, PermissionAction.EDIT),
  navController.update,
);
router.delete(
  "/:id",
  auth,
  requirePermission(Module.ROLE_MANAGEMENT, PermissionAction.DELETE),
  navController.remove,
);

export default router;
