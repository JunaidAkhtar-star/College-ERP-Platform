import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { timetableController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT, PARENT } = SystemRole;
const TIMETABLE_EDITORS = [SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD];
const TIMETABLE_APPROVERS = [SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC];
const TIMETABLE_VIEWERS = [...TIMETABLE_EDITORS, FACULTY, STUDENT, PARENT];
const timetableBodyValidation = () => [
  body("sectionId").optional().isMongoId().withMessage("Valid section is required"),
  body("semesterType").isIn(["odd", "even"]),
  body("scheduleStartTime")
    .optional()
    .matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body("scheduleEndTime")
    .optional()
    .matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body("branches").optional().isArray(),
  body("branches.*").optional().isString().trim(),
  body("branchDepartmentIds").optional().isArray(),
  body("branchDepartmentIds.*").optional().isMongoId(),
  body("slots").isArray({ max: 100 }),
  body("slots.*.day").isIn(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
  body("slots.*.periodNo").isInt({ min: 1, max: 10 }),
  body("slots.*.startTime").matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body("slots.*.endTime").matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body("slots.*.slotKind").optional().isIn(["teaching", "break", "activity"]),
  body("slots.*.title").optional().isString().trim().isLength({ max: 120 }),
  body("slots.*.subjectId").optional().isMongoId(),
  body("slots.*.facultyId").optional().isMongoId(),
  body("slots.*.roomId").optional().isMongoId(),
  body("slots.*.roomNo").optional().isString().trim().isLength({ max: 50 }),
  body("slots.*.classType").isIn(["theory", "lab", "tutorial"]),
  body("slots.*.labBatch").optional().isString().trim().isLength({ max: 30 }),
  body("slots.*.branches").optional().isArray(),
  body("slots.*.isCombined").optional().isBoolean(),
  body("slots.*.branch").optional({ values: "null" }).isString().trim().isLength({ max: 30 }),
  body("slots.*.branchDepartmentId").optional({ values: "null" }).isMongoId(),
  body("slots.*.branchDepartmentIds").optional().isArray(),
  body("slots.*.branchDepartmentIds.*").optional().isMongoId(),
  body("title").optional().isString().trim().isLength({ max: 160 }),
  body("effectiveFrom").optional({ values: "falsy" }).isISO8601({ strict: true }),
  body("effectiveTo").optional({ values: "falsy" }).isISO8601({ strict: true }),
  body("documentNo").optional().isString().trim().isLength({ max: 80 }),
];

router.get(
  "/",
  [
    query("semesterType").optional().isIn(["odd", "even"]),
    query("semester").optional().isInt({ min: 1, max: 12 }),
    query("sectionId").optional().isMongoId(),
    query("curriculumId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_VIEWERS),
  timetableController.list,
);
router.get(
  "/class",
  [
    query("semesterType").isIn(["odd", "even"]),
    query("sectionId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("semester").optional().isInt({ min: 1, max: 12 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_VIEWERS),
  timetableController.getForClass,
);
router.get(
  "/faculty",
  [
    query("facultyId").optional().isMongoId(),
    query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("semesterType").isIn(["odd", "even"]),
  ],
  validate,
  authenticate,
  requireRoles([...TIMETABLE_EDITORS, FACULTY]),
  timetableController.getFacultyTimetable,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(TIMETABLE_VIEWERS),
  timetableController.getById,
);
router.post(
  "/",
  timetableBodyValidation(),
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.create,
);
router.post(
  "/batch",
  [
    body("sectionIds").optional().isArray({ max: 50 }),
    body("sectionIds.*").optional().isMongoId(),
    body("directScopes").optional().isArray({ max: 50 }),
    body("directScopes.*.academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("directScopes.*.curriculumId").optional().isMongoId(),
    body("directScopes.*.departmentId").optional().isMongoId(),
    body("directScopes.*.program").optional().isString().trim().notEmpty(),
    body("directScopes.*.semester").optional().isInt({ min: 1, max: 12 }),
    body("directScopes.*.semesterType").optional().isIn(["odd", "even"]),
    body("directScopes.*.branchDepartmentIds").optional().isArray(),
    body("directScopes.*.branchDepartmentIds.*").optional().isMongoId(),
    body("title").optional().isString().trim().isLength({ max: 160 }),
    body("effectiveFrom").optional({ values: "falsy" }).isISO8601({ strict: true }),
    body("effectiveTo").optional({ values: "falsy" }).isISO8601({ strict: true }),
    body("documentNo").optional().isString().trim().isLength({ max: 80 }),
    body("scheduleStartTime")
      .optional()
      .matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    body("scheduleEndTime")
      .optional()
      .matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.createBatch,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID"), ...timetableBodyValidation()],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.update,
);
router.patch(
  "/:id/publication-details",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("title").optional().isString().trim().isLength({ max: 160 }),
    body("effectiveFrom").optional({ values: "falsy" }).isISO8601({ strict: true }),
    body("effectiveTo").optional({ values: "falsy" }).isISO8601({ strict: true }),
    body("documentNo").optional().isString().trim().isLength({ max: 80 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.updatePublicationDetails,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.remove,
);
router.post(
  "/:id/validate-publish",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(TIMETABLE_APPROVERS),
  timetableController.validateForPublish,
);
router.post(
  "/:id/approve",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(TIMETABLE_APPROVERS),
  timetableController.approve,
);
router.post(
  "/:id/archive",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(TIMETABLE_APPROVERS),
  timetableController.archive,
);
router.post(
  "/:id/substitute",
  [
    param("id").isMongoId(),
    body("slotIndex").isInt({ min: 0 }),
    body("substituteFacultyId").isMongoId(),
    body("date").isISO8601({ strict: true }),
    body("reason").isString().trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.assignSubstitute,
);
router.post(
  "/:id/substitute/:substituteEntryId/cancel",
  [
    param("id").isMongoId(),
    param("substituteEntryId").isMongoId(),
    body("reason").isString().trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.cancelSubstitute,
);
router.get(
  "/:id/class-operations",
  [param("id").isMongoId()],
  validate,
  authenticate,
  requireRoles(TIMETABLE_VIEWERS),
  timetableController.listClassOperations,
);
router.post(
  "/:id/extra-class",
  [
    param("id").isMongoId(),
    body("subjectId").isMongoId(),
    body("facultyId").isMongoId(),
    body("roomId").optional({ values: "falsy" }).isMongoId(),
    body("roomNo").optional().isString().trim().isLength({ max: 40 }),
    body("date").isISO8601({ strict: true }),
    body("startTime").matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    body("endTime").matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    body("branchDepartmentIds").optional().isArray({ min: 1 }),
    body("branchDepartmentIds.*").optional().isMongoId(),
    body("reason").isString().trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.createExtraClass,
);
router.post(
  "/:id/extra-class/:operationId/cancel",
  [
    param("id").isMongoId(),
    param("operationId").isMongoId(),
    body("reason").isString().trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  authenticate,
  requireRoles(TIMETABLE_EDITORS),
  timetableController.cancelExtraClass,
);

export default router;
