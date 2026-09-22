import { Router } from "express";
import { body, param } from "express-validator";
import { subjectController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const deptAdmin = [
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.HOD,
  SystemRole.DEAN_ACADEMIC,
];
const sysAdmin = [SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL, SystemRole.DEAN_ACADEMIC];

router.get("/", authenticate, subjectController.getAll);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  subjectController.getById,
);
router.post("/", authenticate, requireRoles(deptAdmin), subjectController.create);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(deptAdmin),
  subjectController.update,
);
router.patch(
  "/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("isActive").isBoolean().withMessage("Valid subject status is required"),
  ],
  validate,
  authenticate,
  requireRoles(sysAdmin),
  subjectController.setStatus,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(sysAdmin),
  subjectController.deactivate,
);

export default router;
