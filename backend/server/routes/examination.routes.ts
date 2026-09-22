import { Router } from "express";
import { body, param, query } from "express-validator";
import { examinationController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.EXAMINATION_CELL,
]);
const staff = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.FACULTY,
  SystemRole.HOD,
  SystemRole.EXAMINATION_CELL,
]);
const resultViewer = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.EXAMINATION_CELL,
]);
const studentRecordViewer = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.FACULTY,
  SystemRole.HOD,
  SystemRole.EXAMINATION_CELL,
  SystemRole.STUDENT,
]);
const markEditor = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.EXAMINATION_CELL,
  SystemRole.FACULTY,
]);

// Schedules
router.get("/schedules", auth, staff, examinationController.listSchedules);
router.get(
  "/schedules/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  staff,
  examinationController.getSchedule,
);
router.post("/schedules", auth, admin, examinationController.createSchedule);
router.put(
  "/schedules/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  examinationController.updateSchedule,
);

// Hall Ticket
router.post("/hall-ticket", auth, admin, examinationController.generateHallTicket);

// Marks
router.post(
  "/marks",
  auth,
  markEditor,
  [
    body().custom((value) => {
      const marks = Array.isArray(value) ? value : value?.marks;
      if (!Array.isArray(marks) || marks.length < 1 || marks.length > 300) {
        throw new Error("marks must contain between 1 and 300 records");
      }
      for (const mark of marks) {
        if (
          !mark.studentId ||
          !mark.subjectId ||
          !mark.examType ||
          !Number.isInteger(Number(mark.semester)) ||
          !/^\d{4}-(?:\d{2}|\d{4})$/.test(String(mark.academicYear || ""))
        ) {
          throw new Error(
            "Each marks record requires student, subject, exam type, semester and year",
          );
        }
      }
      return true;
    }),
  ],
  validate,
  examinationController.enterMarks,
);
router.get(
  "/marks/pending-verification",
  auth,
  admin,
  [
    query("scheduleId").optional().isMongoId(),
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  examinationController.listPendingMarkVerification,
);
router.post(
  "/marks/verify",
  auth,
  admin,
  [body("markIds").isArray({ min: 1, max: 300 }), body("markIds.*").isMongoId()],
  validate,
  examinationController.verifyMarks,
);
router.get(
  "/attempts",
  auth,
  requireRoles([
    SystemRole.SUPER_ADMIN,
    SystemRole.PRINCIPAL,
    SystemRole.FACULTY,
    SystemRole.HOD,
    SystemRole.EXAMINATION_CELL,
    SystemRole.STUDENT,
  ]),
  examinationController.listAttempts,
);
router.get(
  "/marks/student/:studentId",
  [
    param("studentId").isMongoId().withMessage("Invalid ID"),
    query("semester").isInt({ min: 1, max: 10 }),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  auth,
  studentRecordViewer,
  examinationController.getStudentMarks,
);

// Results
router.post(
  "/results/compile",
  auth,
  admin,
  [
    body("studentId").isMongoId(),
    body("semester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  examinationController.compileSemesterResult,
);
router.post(
  "/results/publish",
  auth,
  admin,
  [
    body("semester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  examinationController.publishResults,
);
router.get("/results", auth, resultViewer, examinationController.listResults);
router.get("/results/ranklist", auth, resultViewer, examinationController.getRanklist);
router.get(
  "/results/student/:studentId",
  [param("studentId").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  studentRecordViewer,
  examinationController.getStudentResults,
);
router.get(
  "/results/student/:studentId/semester",
  [
    param("studentId").isMongoId().withMessage("Invalid ID"),
    query("semester").isInt({ min: 1, max: 10 }),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  auth,
  studentRecordViewer,
  examinationController.getResult,
);
router.post("/schedules/:id/seating", auth, admin, examinationController.generateSeatingPlan);

// ── Recheck / Revaluation (M20) ─────────────────────────────────────────────
router.post(
  "/recheck",
  auth,
  requireRoles([SystemRole.STUDENT]),
  [
    body("semester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("subjectCode").trim().isLength({ min: 1, max: 30 }),
    body("requestType").isIn(["recheck", "revaluation"]),
    body("reason").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  examinationController.submitRecheck,
);
router.get(
  "/recheck/my",
  auth,
  requireRoles([SystemRole.STUDENT]),
  examinationController.listMyRecheckRequests,
);
router.get("/recheck", auth, staff, examinationController.listRecheckRequests);
router.put(
  "/recheck/:id/review",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("status").isIn(["marks_updated", "no_change", "rejected"]),
    body("revisedMarks").optional().isFloat({ min: 0 }),
    body("reviewNotes").trim().isLength({ min: 5, max: 1000 }),
  ],
  validate,
  auth,
  admin,
  examinationController.reviewRecheck,
);
router.put(
  "/recheck/:id/fee-paid",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  examinationController.markRecheckFeePaid,
);

// ── Marksheet & Transcript PDF ──────────────────────────────────────────────
// These routes generate and stream a PDF; no JSON wrapper.
// Must be declared BEFORE the generic /results/student/:studentId route that
// captures trailing path segments, hence the explicit order here.
router.get(
  "/results/student/:studentId/marksheet",
  [param("studentId").isMongoId().withMessage("Invalid student ID")],
  validate,
  auth,
  studentRecordViewer,
  examinationController.downloadMarksheet,
);

router.get(
  "/results/student/:studentId/transcript",
  [param("studentId").isMongoId().withMessage("Invalid student ID")],
  validate,
  auth,
  studentRecordViewer,
  examinationController.downloadTranscript,
);

export default router;
