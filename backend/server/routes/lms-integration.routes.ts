import { Router } from "express";
import { body, param, query } from "express-validator";
import { SystemRole } from "../constants/roles";
import { lmsIntegrationController } from "../controllers/lms-integration.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const managers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
]);
const reviewers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.FACULTY,
  SystemRole.EXAMINATION_CELL,
]);
const profileRules = [
  body("name").trim().isLength({ min: 2, max: 120 }),
  body("connectorId").isMongoId(),
  body("academicYear").trim().isLength({ min: 4, max: 20 }),
  body("departmentIds").optional().isArray({ max: 100 }),
  body("departmentIds.*").optional().isMongoId(),
  body("directions.courses").isIn(["export", "disabled"]),
  body("directions.rosters").isIn(["export", "disabled"]),
  body("directions.assignments").isIn(["export", "disabled"]),
  body("directions.grades").isIn(["import", "export", "bidirectional", "disabled"]),
  body("enabled").isBoolean(),
  body("syncSchedule").optional().isIn(["manual", "hourly", "daily"]),
  body("lti.issuer")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true }),
  body("lti.authorizationUrl")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true }),
  body("lti.tokenUrl")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true }),
  body("lti.jwksUrl")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true }),
];
router.use(authenticate);
router.get("/metadata", managers, lmsIntegrationController.metadata);
router.get("/profiles", managers, lmsIntegrationController.profiles);
router.post("/profiles", managers, profileRules, validate, lmsIntegrationController.save);
router.put(
  "/profiles/:id",
  managers,
  [param("id").isMongoId(), ...profileRules],
  validate,
  lmsIntegrationController.save,
);
router.get(
  "/runs",
  managers,
  [query("profileId").optional().isMongoId()],
  validate,
  lmsIntegrationController.runs,
);
router.post(
  "/profiles/:id/sync",
  managers,
  [
    param("id").isMongoId(),
    body("scope").isIn(["courses", "rosters", "assignments", "grades", "full"]),
    body("idempotencyKey").matches(/^[A-Za-z0-9._:-]{12,200}$/),
  ],
  validate,
  lmsIntegrationController.sync,
);
router.post(
  "/runs/:id/retry",
  managers,
  [param("id").isMongoId()],
  validate,
  lmsIntegrationController.retry,
);
router.post(
  "/profiles/:id/grades/import",
  managers,
  [
    param("id").isMongoId(),
    body("records").isArray({ min: 1, max: 1000 }),
    body("records.*.externalGradeId").trim().isLength({ min: 1, max: 300 }),
    body("records.*.assignmentExternalId").trim().isLength({ min: 1, max: 300 }),
    body("records.*.userExternalId").trim().isLength({ min: 1, max: 300 }),
    body("records.*.score").isFloat({ min: 0 }),
    body("records.*.maximumScore").isFloat({ gt: 0 }),
  ],
  validate,
  lmsIntegrationController.importGrades,
);
router.get("/grades/pending", reviewers, lmsIntegrationController.pendingGrades);
router.get(
  "/courses",
  managers,
  [
    query("profileId").optional().isMongoId(),
    query("search").optional().trim().isLength({ max: 120 }),
  ],
  validate,
  lmsIntegrationController.courses,
);
router.post(
  "/profiles/:id/courses/import",
  managers,
  [
    param("id").isMongoId(),
    body("records").isArray({ min: 1, max: 1000 }),
    body("records.*.externalCourseId").trim().isLength({ min: 1, max: 300 }),
    body("records.*.title").trim().isLength({ min: 2, max: 300 }),
    body("records.*.courseUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("records.*.skills").optional().isArray({ max: 100 }),
    body("records.*.durationHours").optional().isFloat({ min: 0, max: 100000 }),
    body("records.*.certificateAvailable").optional().isBoolean(),
  ],
  validate,
  lmsIntegrationController.importCourses,
);
router.post(
  "/profiles/:id/courses/sync",
  managers,
  [param("id").isMongoId()],
  validate,
  lmsIntegrationController.syncCourses,
);
router.post(
  "/courses/:id/assign",
  managers,
  [
    param("id").isMongoId(),
    body("studentIds").isArray({ min: 1, max: 500 }),
    body("studentIds.*").isMongoId(),
  ],
  validate,
  lmsIntegrationController.assignCourse,
);
router.get(
  "/enrollments",
  reviewers,
  [query("studentId").optional().isMongoId(), query("courseId").optional().isMongoId()],
  validate,
  lmsIntegrationController.enrollments,
);
router.post(
  "/profiles/:id/progress/import",
  managers,
  [
    param("id").isMongoId(),
    body("records").isArray({ min: 1, max: 1000 }),
    body("records.*.externalCourseId").trim().isLength({ min: 1, max: 300 }),
    body("records.*.studentId").isMongoId(),
    body("records.*.progressPercent").isFloat({ min: 0, max: 100 }),
    body("records.*.learningHours").optional().isFloat({ min: 0, max: 100000 }),
    body("records.*.credential.credentialUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("records.*.credential.verificationUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  lmsIntegrationController.importProgress,
);
router.post(
  "/profiles/:id/progress/sync",
  managers,
  [param("id").isMongoId()],
  validate,
  lmsIntegrationController.syncProgress,
);
router.get(
  "/credentials",
  reviewers,
  [query("studentId").optional().isMongoId()],
  validate,
  lmsIntegrationController.credentials,
);
router.get("/credentials/me", lmsIntegrationController.myCredentials);
router.post(
  "/grades/:id/review",
  reviewers,
  [
    param("id").isMongoId(),
    body("decision").isIn(["apply", "reject"]),
    body("reason").optional().trim().isLength({ max: 2000 }),
  ],
  validate,
  lmsIntegrationController.reviewGrade,
);
export default router;
