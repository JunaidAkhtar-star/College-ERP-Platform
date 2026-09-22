import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { facultyWorkloadController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, HOD } = SystemRole;
const viewers = requireRoles([
  SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  HOD,
  SystemRole.FACULTY,
]);

const managers = requireRoles([
  SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  HOD,
]);

router.get("/", authenticate, viewers, facultyWorkloadController.list);
router.get(
  "/department-summary",
  authenticate,
  managers,
  facultyWorkloadController.getDepartmentSummary,
);
router.get(
  "/:id/operational-summary",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  viewers,
  facultyWorkloadController.getOperationalSummary,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  viewers,
  facultyWorkloadController.getById,
);
router.post(
  "/",
  authenticate,
  managers,
  [
    body("facultyId").isMongoId(),
    body("departmentId").isMongoId(),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("semesterType").isIn(["odd", "even"]),
  ],
  validate,
  facultyWorkloadController.create,
);
router.put("/:id", authenticate, managers, facultyWorkloadController.update);
router.post(
  "/:id/approve",
  [param("id").isMongoId()],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, SystemRole.PRINCIPAL, SystemRole.DEAN_ACADEMIC]),
  facultyWorkloadController.approve,
);

export default router;
