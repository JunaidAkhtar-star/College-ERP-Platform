import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { semesterRegistrationController } from "../controllers/semester-registration.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, STUDENT } = SystemRole;

const staff = requireRoles([SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD]);

// ── Student ───────────────────────────────────────────────────────────────────

router.get(
  "/context",
  authenticate,
  requireRoles([STUDENT]),
  [
    query("academicYear").matches(/^\d{4}-\d{2}$/),
    query("targetSemester").optional().isInt({ min: 1, max: 10 }),
  ],
  validate,
  semesterRegistrationController.getContext,
);

router.post(
  "/",
  authenticate,
  requireRoles([STUDENT]),
  [
    body("rollNumber").optional().notEmpty(),
    body("studentName").optional().notEmpty(),
    body("program").optional().notEmpty(),
    body("branch").optional().notEmpty(),
    body("departmentId").optional().isMongoId(),
    body("targetSemester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("registeredSubjects").optional().isArray(),
    body("registeredSubjects.*.subjectId").isMongoId(),
    body("registeredSubjects.*.isBacklog").optional().isBoolean(),
    body("submit").optional().isBoolean(),
  ],
  validate,
  semesterRegistrationController.register,
);

router.get("/mine", authenticate, requireRoles([STUDENT]), semesterRegistrationController.getMine);

router.get(
  "/mine/:semester",
  authenticate,
  requireRoles([STUDENT]),
  [param("semester").isInt({ min: 1, max: 10 }), query("academicYear").matches(/^\d{4}-\d{2}$/)],
  validate,
  semesterRegistrationController.getMySemester,
);

router.patch(
  "/mine/:id/withdraw",
  authenticate,
  requireRoles([STUDENT]),
  [param("id").isMongoId()],
  validate,
  semesterRegistrationController.withdraw,
);

// ── Staff ─────────────────────────────────────────────────────────────────────

router.get("/stats", authenticate, staff, semesterRegistrationController.stats);

router.get("/windows", authenticate, staff, semesterRegistrationController.listWindows);

router.put(
  "/windows",
  authenticate,
  staff,
  [
    body("departmentId").isMongoId(),
    body("targetSemester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("opensAt").isISO8601(),
    body("closesAt").isISO8601(),
    body("addDropEndsAt").isISO8601(),
    body("minCredits").isFloat({ min: 0, max: 60 }),
    body("maxCredits").isFloat({ min: 1, max: 60 }),
    body("requireFeeClearance").optional().isBoolean(),
    body("allowBacklogs").optional().isBoolean(),
    body("maxBacklogSubjects").optional().isInt({ min: 0, max: 20 }),
    body("isActive").optional().isBoolean(),
  ],
  validate,
  semesterRegistrationController.configureWindow,
);

router.get("/", authenticate, staff, semesterRegistrationController.list);

router.patch(
  "/:id/approve",
  authenticate,
  staff,
  [param("id").isMongoId()],
  validate,
  semesterRegistrationController.approve,
);

router.patch(
  "/:id/reject",
  authenticate,
  staff,
  [param("id").isMongoId(), body("remarks").trim().isLength({ min: 5, max: 1000 })],
  validate,
  semesterRegistrationController.reject,
);

router.post(
  "/bulk-approve",
  authenticate,
  staff,
  [
    body("departmentId").isMongoId(),
    body("targetSemester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
  ],
  validate,
  semesterRegistrationController.bulkApprove,
);

router.post(
  "/freeze",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL, HOD, DEAN_ACADEMIC]),
  [
    body("departmentId").isMongoId(),
    body("targetSemester").isInt({ min: 1, max: 10 }),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
  ],
  validate,
  semesterRegistrationController.freeze,
);

export default router;
