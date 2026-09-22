import { Router } from "express";
import { param } from "express-validator";
import { departmentController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const adminRoles = [SystemRole.SUPER_ADMIN, SystemRole.DEAN_ACADEMIC];

router.get("/", authenticate, departmentController.getAll);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  departmentController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.DEAN_ACADEMIC]),
  departmentController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(adminRoles),
  departmentController.update,
);
router.delete(
  "/:id",
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN]),
  departmentController.deactivate,
);

export default router;
