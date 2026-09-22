import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { roleController } from "../controllers/role.controller";
import { ALL_ROLES, SystemRole } from "../constants/roles";

const router = Router();
const superAdmin = requireRoles([SystemRole.SUPER_ADMIN]);
const adminView = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL]);

router.get("/", authenticate, adminView, roleController.list);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  adminView,
  roleController.getById,
);
router.post(
  "/",
  authenticate,
  superAdmin,
  [
    body("displayName").isString().trim().isLength({ min: 2, max: 100 }),
    body("baseRole").isIn(ALL_ROLES).withMessage("A valid base system role is required"),
    body("description").optional().isString().trim().isLength({ max: 500 }),
    body("permissions").optional().isArray(),
    body("allowedNavItems").optional().isArray(),
  ],
  validate,
  roleController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  superAdmin,
  roleController.update,
);
router.put(
  "/:id/permissions",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  superAdmin,
  roleController.updatePermissions,
);
router.put(
  "/:id/nav-items",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  superAdmin,
  roleController.updateNavItems,
);
router.patch(
  "/:id/toggle",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  superAdmin,
  roleController.toggleActive,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  superAdmin,
  roleController.delete,
);
router.put(
  "/:id/users/:userId",
  [
    param("id").isMongoId().withMessage("Invalid role ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
    body("assigned").isBoolean().withMessage("assigned must be a boolean"),
  ],
  validate,
  authenticate,
  superAdmin,
  roleController.assignUser,
);

export default router;
