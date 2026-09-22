import { Router } from "express";
import { body, param, query } from "express-validator";
import { attendanceController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";
import { AttendanceStatus, ClassType } from "../models/attendance.model";

const router = Router();
const auth = authenticate;
const faculty = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.FACULTY,
  SystemRole.HOD,
]);
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
]);
const shortageReader = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
]);
const correctionReviewer = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
]);
const recordReader = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.FACULTY,
  SystemRole.STUDENT,
]);
const studentSummaryReader = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.FACULTY,
]);

router.post(
  "/",
  auth,
  faculty,
  [
    body("sectionId").optional().isMongoId().withMessage("Valid section is required"),
    body("timetableId").optional().isMongoId(),
    body("timetableSlotId").optional().isMongoId(),
    body("subjectId").isMongoId(),
    body("classType").optional().isIn(Object.values(ClassType)),
    body("date").isISO8601(),
    body("startTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("endTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("periodNumber").isInt({ min: 1, max: 8 }),
    body("entries").isArray({ min: 1, max: 300 }),
    body("entries.*.studentId").isMongoId(),
    body("entries.*.status").isIn(Object.values(AttendanceStatus)),
    body("entries.*.remarks").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  attendanceController.markAttendance,
);
router.get(
  "/",
  auth,
  faculty,
  [
    query("date").optional().isISO8601(),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    query("facultyId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("scope").optional().isString(),
    query("subjectId").optional().isMongoId(),
    query("sectionId").optional().isMongoId(),
  ],
  validate,
  attendanceController.getByFacultyDate,
);
router.get(
  "/shortage",
  auth,
  shortageReader,
  [
    query("semester").isInt({ min: 1, max: 10 }),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  attendanceController.getShortageList,
);
router.get("/corrections", auth, correctionReviewer, attendanceController.getPendingCorrections);
router.post("/lock", auth, admin, attendanceController.lockOldRecords);
router.post(
  "/lock-semester",
  auth,
  admin,
  [body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/)],
  validate,
  attendanceController.lockSemesterAttendance,
);
router.get(
  "/subject/:subjectId",
  [
    param("subjectId").isMongoId().withMessage("Invalid ID"),
    query("from").isISO8601(),
    query("to").isISO8601(),
  ],
  validate,
  auth,
  faculty,
  attendanceController.getBySubject,
);
router.get(
  "/student/:studentId/summary",
  [
    param("studentId").isMongoId().withMessage("Invalid ID"),
    query("semester").isInt({ min: 1, max: 10 }),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  auth,
  studentSummaryReader,
  attendanceController.getStudentSummary,
);
router.get(
  "/my/summary",
  auth,
  requireRoles([SystemRole.STUDENT]),
  [
    query("semester").isInt({ min: 1, max: 10 }),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  attendanceController.getStudentSummary,
);
router.get(
  "/my/records",
  auth,
  requireRoles([SystemRole.STUDENT]),
  [query("from").isISO8601(), query("to").isISO8601()],
  validate,
  attendanceController.getMyRecords,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  recordReader,
  attendanceController.getRecord,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  attendanceController.editAttendance,
);
router.post(
  "/:id/correction",
  auth,
  requireRoles([SystemRole.STUDENT]),
  [
    param("id").isMongoId(),
    body("requestedStatus").isIn(Object.values(AttendanceStatus)),
    body("reason").trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  attendanceController.requestCorrection,
);
router.put(
  "/:id/correction/:idx/approve",
  [param("id").isMongoId().withMessage("Invalid ID"), param("idx").isInt({ min: 0, max: 1000 })],
  validate,
  auth,
  correctionReviewer,
  attendanceController.approveCorrection,
);
router.put(
  "/:id/correction/:idx/reject",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    param("idx").isInt({ min: 0, max: 1000 }),
    body("reason").trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  auth,
  correctionReviewer,
  attendanceController.rejectCorrection,
);

export default router;
