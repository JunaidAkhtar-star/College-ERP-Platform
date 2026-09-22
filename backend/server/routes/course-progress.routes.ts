import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { courseProgressController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY } = SystemRole;
const READ_ROLES = [SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY];

router.get(
  "/",
  [
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("subjectId").optional().isMongoId(),
    query("facultyId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("isComplete").optional().isBoolean(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  courseProgressController.list,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid course-progress ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  courseProgressController.getById,
);
router.post(
  "/:id/topics",
  [
    param("id").isMongoId().withMessage("Invalid course-progress ID"),
    body("date").matches(/^\d{4}-\d{2}-\d{2}$/),
    body("unitNo").isInt({ min: 1, max: 20 }).toInt(),
    body("plannedTopic").isString().trim().isLength({ min: 1, max: 1000 }),
    body("topicCovered").optional().isString().trim().isLength({ max: 2000 }),
    body("attendanceRecordIds").optional().isArray({ max: 20 }),
    body("attendanceRecordIds.*").optional().isMongoId(),
    body("teachingMethod").optional().isString().trim().isLength({ max: 500 }),
    body("remarks").optional().isString().trim().isLength({ max: 2000 }),
  ],
  validate,
  authenticate,
  requireRoles([FACULTY]),
  courseProgressController.addTopic,
);

export default router;
