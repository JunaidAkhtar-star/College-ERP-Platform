import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { Module, PermissionAction } from "../constants/permissions";
import { assessmentGradebookController as c } from "../controllers/assessment-gradebook.controller";
const r = Router();
const id = [param("id").isMongoId()];
r.get(
  "/activities",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.VIEW),
  c.activities,
);
r.post(
  "/activities",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.CREATE),
  [
    body("policyId").isMongoId(),
    body("subjectId").isMongoId(),
    body("componentKey").trim().notEmpty(),
    body("semester").isInt({ min: 1 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("sequence").isInt({ min: 1 }),
    body("title").trim().notEmpty(),
    body("scheduledAt").isISO8601(),
    body("maximumMarks").isFloat({ gt: 0 }),
  ],
  validate,
  c.createActivity,
);
r.put(
  "/activities/:id",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.EDIT),
  c.updateActivity,
);
r.get(
  "/ledgers",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.VIEW),
  c.ledgers,
);
r.post(
  "/scores",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.EDIT),
  [
    body("policyId").isMongoId(),
    body("studentId").isMongoId(),
    body("subjectId").isMongoId(),
    body("componentKey").trim().notEmpty(),
    body("semester").isInt({ min: 1 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("rawMarks").isFloat({ min: 0 }),
  ],
  validate,
  c.record,
);
r.post(
  "/scores/bulk",
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.EDIT),
  [
    body("scores").isArray({ min: 1, max: 500 }),
    body("scores.*.policyId").isMongoId(),
    body("scores.*.studentId").isMongoId(),
    body("scores.*.subjectId").isMongoId(),
    body("scores.*.componentKey").trim().notEmpty(),
    body("scores.*.semester").isInt({ min: 1 }),
    body("scores.*.academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("scores.*.rawMarks").isFloat({ min: 0 }),
  ],
  validate,
  c.bulkRecord,
);
r.post(
  "/ledgers/:id/submit",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.EDIT),
  c.submit,
);
r.post(
  "/ledgers/:id/verify",
  id,
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.APPROVE),
  c.verify,
);
r.post(
  "/ledgers/:id/return",
  id,
  body("note").trim().isLength({ min: 5, max: 1000 }),
  validate,
  authenticate,
  requirePermission(Module.INTERNAL_ASSESSMENT, PermissionAction.APPROVE),
  c.returnForCorrection,
);
r.post(
  "/ledgers/:id/freeze",
  id,
  validate,
  authenticate,
  requirePermission(Module.RESULT, PermissionAction.APPROVE),
  c.freeze,
);
export default r;
