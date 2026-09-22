import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { mentorController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT } = SystemRole;

router.get(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY]),
  mentorController.list,
);
router.get("/my", authenticate, requireRoles([STUDENT]), mentorController.myMentor);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT]),
  mentorController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC, HOD]),
  [
    body("facultyId").isMongoId(),
    body("departmentId").isMongoId(),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("maxMentees").isInt({ min: 1, max: 100 }),
  ],
  validate,
  mentorController.create,
);
router.post(
  "/:id/mentee",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC, HOD]),
  [param("id").isMongoId(), body("studentId").isMongoId()],
  validate,
  mentorController.assignMentee,
);
router.put(
  "/:id/mentees",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC, HOD]),
  [
    param("id").isMongoId(),
    body("studentIds").isArray({ max: 100 }),
    body("studentIds.*").isMongoId(),
  ],
  validate,
  mentorController.syncMentees,
);
router.post(
  "/:id/meetings",
  authenticate,
  requireRoles([FACULTY]),
  [
    param("id").isMongoId(),
    body("studentId").isMongoId(),
    body("date").isISO8601(),
    body("type").isIn(["academic", "personal", "parent", "career", "disciplinary"]),
    body("agenda").isString().trim().isLength({ min: 3, max: 300 }),
    body("notes").isString().trim().isLength({ min: 3, max: 2000 }),
    body("nextActionDate").optional({ values: "falsy" }).isISO8601(),
  ],
  validate,
  mentorController.logMeeting,
);

export default router;
