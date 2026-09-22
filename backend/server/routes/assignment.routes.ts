import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { assignmentController } from "../controllers";
import { SystemRole } from "../constants/roles";
import { AssignmentStatus } from "../models/assignment.model";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT } = SystemRole;
const ASSIGNMENT_READ_ROLES = [SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT];
const assignmentBodyValidation = () => [
  body("sectionId").isMongoId().withMessage("Valid section is required"),
  body("subjectId").isMongoId().withMessage("Valid subject is required"),
  body("title").isString().trim().isLength({ min: 3, max: 200 }),
  body("description").isString().trim().isLength({ min: 1, max: 20000 }),
  body("dueDate").isISO8601().withMessage("Valid due date is required"),
  body("maxMarks").isFloat({ min: 1, max: 1000 }).toFloat(),
  body("allowLateSubmission").optional().isBoolean().toBoolean(),
  body("latePenaltyPercent").optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body("attachmentUrl").optional({ nullable: true }).isURL().isLength({ max: 2000 }),
];

router.get(
  "/",
  [
    query("search").optional().isString().trim().isLength({ max: 120 }),
    query("status").optional().isIn(Object.values(AssignmentStatus)),
    query("sectionId").optional().isMongoId(),
    query("subjectId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("scope").optional().isIn(["mine", "department"]),
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(ASSIGNMENT_READ_ROLES),
  assignmentController.list,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(ASSIGNMENT_READ_ROLES),
  assignmentController.getById,
);
router.post(
  "/",
  assignmentBodyValidation(),
  validate,
  authenticate,
  requireRoles([HOD, FACULTY]),
  assignmentController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid assignment ID"), ...assignmentBodyValidation()],
  validate,
  authenticate,
  requireRoles([HOD, FACULTY]),
  assignmentController.update,
);
router.post(
  "/:id/submit",
  [
    param("id").isMongoId().withMessage("Invalid assignment ID"),
    body("fileUrl").optional().isURL().isLength({ max: 2000 }),
    body("textContent").optional().isString().trim().isLength({ min: 1, max: 20000 }),
    body().custom((value) => {
      if (!value.fileUrl && !value.textContent?.trim())
        throw new Error("File or answer text is required");
      return true;
    }),
  ],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  assignmentController.submit,
);
router.put(
  "/:id/grade/:studentId",
  [
    param("id").isMongoId().withMessage("Invalid assignment ID"),
    param("studentId").isMongoId().withMessage("Invalid student ID"),
    body("marks").isFloat({ min: 0 }).withMessage("Marks must be zero or greater"),
    body("feedback").optional().isString().trim().isLength({ max: 5000 }),
  ],
  validate,
  authenticate,
  requireRoles([HOD, FACULTY]),
  assignmentController.grade,
);
router.post(
  "/:id/publish",
  [param("id").isMongoId().withMessage("Invalid assignment ID")],
  validate,
  authenticate,
  requireRoles([HOD, FACULTY]),
  assignmentController.publish,
);
router.post(
  "/:id/close",
  [param("id").isMongoId().withMessage("Invalid assignment ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HOD, FACULTY]),
  assignmentController.close,
);

export default router;
