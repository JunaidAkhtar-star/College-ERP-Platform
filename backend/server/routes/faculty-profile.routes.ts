import { Router } from "express";
import { body, param } from "express-validator";
import { facultyProfileController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.HR_DEPARTMENT,
]);
const hrAdm = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.HR_DEPARTMENT,
]);

router.get("/", auth, admin, facultyProfileController.list);
router.get("/stats", auth, admin, facultyProfileController.getStats);
router.get(
  "/me",
  auth,
  requireRoles([SystemRole.FACULTY, SystemRole.HOD]),
  facultyProfileController.getMyProfile,
);
router.patch(
  "/me",
  auth,
  requireRoles([SystemRole.FACULTY, SystemRole.HOD]),
  facultyProfileController.updateMyProfile,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  facultyProfileController.getById,
);
router.post("/", auth, hrAdm, facultyProfileController.create);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  hrAdm,
  facultyProfileController.update,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  hrAdm,
  facultyProfileController.remove,
);
router.post(
  "/:id/publications",
  [
    param("id").isMongoId(),
    body("title").isString().trim().isLength({ min: 3, max: 500 }),
    body("year").isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  ],
  validate,
  auth,
  facultyProfileController.addPublication,
);
router.post(
  "/:id/trainings",
  [param("id").isMongoId(), body("fromDate").isISO8601(), body("toDate").isISO8601()],
  validate,
  auth,
  facultyProfileController.addTraining,
);
router.post(
  "/:id/salary-slip",
  [
    param("id").isMongoId(),
    body("month").isString().trim().notEmpty(),
    body("year").isInt({ min: 2000, max: 2100 }),
    body("lopDays").optional().isInt({ min: 0, max: 31 }),
  ],
  validate,
  auth,
  hrAdm,
  facultyProfileController.generateSalarySlip,
);
router.post(
  "/:id/experience-letter",
  [param("id").isMongoId(), body("dateOfRelieving").isISO8601()],
  validate,
  auth,
  hrAdm,
  facultyProfileController.generateExperienceLetter,
);

export default router;
