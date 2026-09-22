import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { lessonPlanController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY } = SystemRole;
const READ_ROLES = [SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY];
const REVIEW_ROLES = [SUPER_ADMIN, DEAN_ACADEMIC, HOD];
const lessonPlanValidation = () => [
  body("sectionId").isMongoId().withMessage("Valid section is required"),
  body("subjectId").isMongoId().withMessage("Valid subject is required"),
  body("unitPlans").isArray({ min: 1, max: 20 }),
  body("unitPlans.*.unitNo").isInt({ min: 1, max: 20 }).toInt(),
  body("unitPlans.*.unitTitle").isString().trim().isLength({ min: 2, max: 500 }),
  body("unitPlans.*.plannedTopics").isArray({ min: 1, max: 100 }),
  body("unitPlans.*.plannedClasses").isInt({ min: 1, max: 500 }).toInt(),
  body("unitPlans.*.plannedStartDate").isISO8601(),
  body("unitPlans.*.plannedEndDate").isISO8601(),
  body("unitPlans.*.coMappings").isArray({ min: 1, max: 20 }),
];

router.get(
  "/",
  [
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("subjectId").optional().isMongoId(),
    query("facultyId").optional().isMongoId(),
    query("status").optional().isIn(["draft", "submitted", "approved", "rejected"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  lessonPlanController.list,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid lesson-plan ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  lessonPlanController.getById,
);
router.post(
  "/",
  lessonPlanValidation(),
  validate,
  authenticate,
  requireRoles([FACULTY]),
  lessonPlanController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid lesson-plan ID"), ...lessonPlanValidation()],
  validate,
  authenticate,
  requireRoles([FACULTY]),
  lessonPlanController.update,
);
router.patch(
  "/:id/submit",
  [param("id").isMongoId().withMessage("Invalid lesson-plan ID")],
  validate,
  authenticate,
  requireRoles([FACULTY]),
  lessonPlanController.submit,
);
router.patch(
  "/:id/approve",
  [param("id").isMongoId().withMessage("Invalid lesson-plan ID")],
  validate,
  authenticate,
  requireRoles(REVIEW_ROLES),
  lessonPlanController.approve,
);
router.patch(
  "/:id/reject",
  [
    param("id").isMongoId().withMessage("Invalid lesson-plan ID"),
    body("remark").isString().trim().isLength({ min: 3, max: 2000 }),
  ],
  validate,
  authenticate,
  requireRoles(REVIEW_ROLES),
  lessonPlanController.reject,
);

export default router;
