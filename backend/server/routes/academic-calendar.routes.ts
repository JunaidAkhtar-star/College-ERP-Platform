import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { academicCalendarController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC } = SystemRole;
const calendarReaders = [SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC];

router.get("/hierarchy-context", authenticate, academicCalendarController.hierarchyContext);
router.get("/visible", authenticate, academicCalendarController.visible);
const personalEventValidation = [
  body("title").trim().isLength({ min: 1, max: 200 }),
  body("description").optional().trim().isLength({ max: 5000 }),
  body("startDate").isISO8601(),
  body("endDate").isISO8601(),
  body("allDay").optional().isBoolean(),
  body("location").optional().trim().isLength({ max: 500 }),
  body("color").optional().isIn(["blue", "green", "amber", "rose", "violet"]),
  body("recurrence").optional().isIn(["none", "daily", "weekly", "monthly"]),
  body("recurrenceUntil").optional({ nullable: true }).isISO8601(),
  body("reminderMinutes").optional().isArray({ max: 5 }),
  body("reminderMinutes.*").isInt({ min: 0, max: 10080 }),
];
router.post(
  "/personal-events",
  authenticate,
  personalEventValidation,
  validate,
  academicCalendarController.savePersonalEvent,
);
router.put(
  "/personal-events/:id",
  authenticate,
  [param("id").isMongoId(), ...personalEventValidation],
  validate,
  academicCalendarController.savePersonalEvent,
);
router.delete(
  "/personal-events/:id",
  authenticate,
  [param("id").isMongoId()],
  validate,
  academicCalendarController.deletePersonalEvent,
);
router.get(
  "/",
  authenticate,
  requireRoles(calendarReaders),
  [
    query("academicYear")
      .optional()
      .matches(/^\d{4}-\d{2}$/),
    query("semesterType").optional().isIn(["odd", "even"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  academicCalendarController.list,
);
router.get(
  "/:id",
  authenticate,
  requireRoles(calendarReaders),
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  academicCalendarController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC]),
  [
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("semesterType").isIn(["odd", "even"]),
    body("semesterStartDate").isISO8601(),
    body("semesterEndDate").isISO8601(),
  ],
  validate,
  academicCalendarController.create,
);
router.put(
  "/:id",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC]),
  [
    param("id").isMongoId(),
    body("academicYear")
      .optional()
      .matches(/^\d{4}-\d{2}$/),
    body("semesterType").optional().isIn(["odd", "even"]),
    body("semesterStartDate").optional().isISO8601(),
    body("semesterEndDate").optional().isISO8601(),
    body("events").optional().isArray({ max: 500 }),
  ],
  validate,
  academicCalendarController.update,
);
router.post(
  "/:id/events",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC]),
  [
    param("id").isMongoId(),
    body("title").trim().isLength({ min: 1, max: 200 }),
    body("description").optional().trim().isLength({ max: 5000 }),
    body("startDate").isISO8601(),
    body("endDate").isISO8601(),
    body("category").isIn([
      "holiday",
      "internal_exam",
      "university_exam",
      "cultural",
      "sports",
      "technical",
      "other",
    ]),
    body("affectedRoles").optional().isArray({ max: 100 }),
    body("departmentId").optional().isMongoId(),
    body("isRecurring").optional().isBoolean(),
  ],
  validate,
  academicCalendarController.addEvent,
);
router.delete(
  "/:id/events/:eventId",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, DEAN_ACADEMIC]),
  [param("id").isMongoId(), param("eventId").isMongoId()],
  validate,
  academicCalendarController.removeEvent,
);

router.put(
  "/:id/publish",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL]),
  [param("id").isMongoId()],
  validate,
  academicCalendarController.publish,
);

export default router;
