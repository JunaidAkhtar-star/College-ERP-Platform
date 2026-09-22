import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { curriculumController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, DEAN_ACADEMIC } = SystemRole;

router.get("/", authenticate, curriculumController.list);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  curriculumController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, DEAN_ACADEMIC]),
  curriculumController.create,
);
router.put(
  "/:id",
  authenticate,
  requireRoles([SUPER_ADMIN, DEAN_ACADEMIC]),
  curriculumController.update,
);
router.post(
  "/:id/semester-subjects",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("semesterNo").isInt({ min: 1 }).withMessage("Valid semester required"),
    body("subjectId").isMongoId().withMessage("Valid subject required"),
  ],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, DEAN_ACADEMIC]),
  curriculumController.addSubjectToSemester,
);
router.delete(
  "/:id/semester-subjects/:semesterNo/:subjectId",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    param("semesterNo").isInt({ min: 1 }).withMessage("Valid semester required"),
    param("subjectId").isMongoId().withMessage("Valid subject required"),
  ],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, DEAN_ACADEMIC]),
  curriculumController.removeSubjectFromSemester,
);

export default router;
