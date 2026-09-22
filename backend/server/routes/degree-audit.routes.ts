import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { degreeAuditController } from "../controllers/degree-audit.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, EXAMINATION_CELL, STUDENT } =
  SystemRole;
const staff = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  DEAN_ACADEMIC,
  HOD,
  FACULTY,
  EXAMINATION_CELL,
]);
const plannerRoles = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  DEAN_ACADEMIC,
  HOD,
  FACULTY,
  EXAMINATION_CELL,
  STUDENT,
]);
const reviewers = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  DEAN_ACADEMIC,
  HOD,
  EXAMINATION_CELL,
]);

const planValidation = [
  body("goalGraduationTerm").optional().trim().isLength({ max: 80 }),
  body("notes").optional().trim().isLength({ max: 3000 }),
  body("submit").optional().isBoolean(),
  body("items").isArray({ max: 300 }),
  body("items.*.subjectId").isMongoId(),
  body("items.*.plannedSemester").isInt({ min: 1, max: 20 }),
];

router.get("/mine", authenticate, requireRoles([STUDENT]), degreeAuditController.mine);
router.get(
  "/students/:studentProfileId",
  authenticate,
  staff,
  [param("studentProfileId").isMongoId()],
  validate,
  degreeAuditController.student,
);
router.put(
  "/students/:studentProfileId/plan",
  authenticate,
  plannerRoles,
  [param("studentProfileId").isMongoId(), ...planValidation],
  validate,
  degreeAuditController.savePlan,
);
router.patch(
  "/students/:studentProfileId/plan/review",
  authenticate,
  reviewers,
  [
    param("studentProfileId").isMongoId(),
    body("decision").isIn(["approved", "returned"]),
    body("remarks").optional().trim().isLength({ min: 5, max: 2000 }),
  ],
  validate,
  degreeAuditController.reviewPlan,
);
router.post(
  "/transfer-credits",
  authenticate,
  plannerRoles,
  [
    body("studentProfileId").optional().isMongoId(),
    body("externalInstitution").trim().isLength({ min: 2, max: 240 }),
    body("externalProgramme").trim().isLength({ min: 2, max: 180 }),
    body("transcriptDocumentId").optional().isMongoId(),
    body("referenceNumber").trim().isLength({ min: 2, max: 80 }),
    body("submit").optional().isBoolean(),
    body("courses").isArray({ min: 1, max: 100 }),
    body("courses.*.externalCourseCode").trim().isLength({ min: 1, max: 40 }),
    body("courses.*.externalCourseName").trim().isLength({ min: 2, max: 180 }),
    body("courses.*.externalCredits").isFloat({ min: 0, max: 30 }),
    body("courses.*.grade").optional().trim().isLength({ max: 20 }),
    body("courses.*.targetSubjectId").optional().isMongoId(),
  ],
  validate,
  degreeAuditController.createTransfer,
);
router.patch(
  "/transfer-credits/:id/review",
  authenticate,
  reviewers,
  [
    param("id").isMongoId(),
    body("remarks").optional().trim().isLength({ min: 5, max: 2000 }),
    body("courses").isArray({ min: 1, max: 100 }),
    body("courses.*.courseId").isMongoId(),
    body("courses.*.decision").isIn(["approved", "rejected"]),
    body("courses.*.approvedCredits").isFloat({ min: 0, max: 30 }),
    body("courses.*.remarks").optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  degreeAuditController.reviewTransfer,
);

export default router;
