import { Router } from "express";
import { body, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { facultyAttendanceController } from "../controllers";
import { SystemRole } from "../constants/roles";
import { FACULTY_ATTENDANCE_STATUSES } from "../services/faculty-attendance.service";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, HR_DEPARTMENT, FACULTY } = SystemRole;

router.get(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, HR_DEPARTMENT]),
  [
    query("facultyId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("status").optional().isIn(FACULTY_ATTENDANCE_STATUSES),
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2000, max: 2100 }),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  facultyAttendanceController.list,
);
router.get(
  "/monthly-summary",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, HR_DEPARTMENT, FACULTY]),
  [
    query("facultyId").optional().isMongoId(),
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2000, max: 2100 }),
  ],
  validate,
  facultyAttendanceController.getMonthlySummary,
);
router.get(
  "/department-summary",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, HR_DEPARTMENT]),
  [
    query("departmentId").optional().isMongoId(),
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2000, max: 2100 }),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  validate,
  facultyAttendanceController.getDepartmentSummary,
);
router.post(
  "/mark",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, HR_DEPARTMENT]),
  [
    body("facultyId").isMongoId(),
    body("date").isISO8601(),
    body("status").isIn(FACULTY_ATTENDANCE_STATUSES),
    body("checkInTime")
      .optional({ values: "falsy" })
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("checkOutTime")
      .optional({ values: "falsy" })
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("remarks").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  facultyAttendanceController.mark,
);

export default router;
