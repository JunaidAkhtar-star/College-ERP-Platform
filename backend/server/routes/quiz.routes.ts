import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { quizController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT, EXAMINATION_CELL } =
  SystemRole;
const READ_ROLES = [
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  DEAN_ACADEMIC,
  HOD,
  FACULTY,
  STUDENT,
  EXAMINATION_CELL,
];
const MANAGE_ROLES = [SUPER_ADMIN, HOD, FACULTY];
const AUTHOR_ROLES = [FACULTY];
const quizBodyValidation = () => [
  body("sectionId").isMongoId().withMessage("Valid section is required"),
  body("subjectId").isMongoId().withMessage("Valid subject is required"),
  body("title").isString().trim().isLength({ min: 3, max: 200 }),
  body("description").optional().isString().trim().isLength({ max: 20000 }),
  body("quizType").isIn(["scheduled", "surprise"]),
  body("durationMinutes").isInt({ min: 1, max: 480 }).toInt(),
  body("startDateTime").isISO8601(),
  body("endDateTime").isISO8601(),
  body("shuffleQuestions").optional().isBoolean().toBoolean(),
  body("shuffleOptions").optional().isBoolean().toBoolean(),
  body("showResultImmediately").optional().isBoolean().toBoolean(),
  body("proctoringEnabled").optional().isBoolean().toBoolean(),
  body("questions").isArray({ min: 1, max: 200 }),
];

router.get(
  "/",
  [
    query("subjectId").optional().isMongoId(),
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("quizType").optional().isIn(["scheduled", "surprise"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  quizController.list,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  quizController.getById,
);
router.post(
  "/",
  quizBodyValidation(),
  validate,
  authenticate,
  requireRoles(AUTHOR_ROLES),
  quizController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID"), ...quizBodyValidation()],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  quizController.update,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid quiz ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  quizController.deleteDraft,
);
router.post(
  "/:id/start",
  [param("id").isMongoId().withMessage("Invalid quiz ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  quizController.start,
);
router.post(
  "/:id/submit",
  [
    param("id").isMongoId().withMessage("Invalid quiz ID"),
    body("answers").isArray({ max: 200 }),
    body("answers.*.questionId").isMongoId(),
    body("answers.*.selectedOption").optional().isInt({ min: 0, max: 9 }).toInt(),
    body("answers.*.textAnswer").optional().isString().trim().isLength({ max: 5000 }),
  ],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  quizController.submit,
);
router.patch(
  "/:id/answers",
  [
    param("id").isMongoId().withMessage("Invalid quiz ID"),
    body("revision").isInt({ min: 1 }).toInt(),
    body("answers").isArray({ max: 200 }),
    body("answers.*.questionId").isMongoId(),
    body("answers.*.selectedOption").optional().isInt({ min: 0, max: 9 }).toInt(),
    body("answers.*.textAnswer").optional().isString().trim().isLength({ max: 5000 }),
  ],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  quizController.saveAnswers,
);
router.get(
  "/:id/my-attempt",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  quizController.myAttempt,
);

router.post(
  "/:id/publish",
  [param("id").isMongoId().withMessage("Invalid quiz ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  quizController.publish,
);
router.post(
  "/:id/close",
  [param("id").isMongoId().withMessage("Invalid quiz ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  quizController.close,
);

// ── Proctoring ─────────────────────────────────────────────────────────────────
router.post(
  "/:id/proctor-event",
  authenticate,
  requireRoles([STUDENT]),
  [
    param("id").isMongoId().withMessage("Invalid quiz ID"),
    body("eventType")
      .isIn(["tab_switch", "fullscreen_exit", "copy_paste", "suspicious_activity", "screenshot"])
      .withMessage("Invalid event type"),
  ],
  validate,
  quizController.recordProctoringEvent,
);

router.get(
  "/:id/proctor-log",
  authenticate,
  requireRoles(MANAGE_ROLES),
  [param("id").isMongoId().withMessage("Invalid quiz ID")],
  validate,
  quizController.getProctoringLog,
);

export default router;
