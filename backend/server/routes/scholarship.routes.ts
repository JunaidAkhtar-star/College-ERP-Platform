import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { scholarshipController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, SCHOLARSHIP_CELL, STUDENT, ACCOUNTS_DEPARTMENT } = SystemRole;

router.get(
  "/schemes",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL, SCHOLARSHIP_CELL, STUDENT, ACCOUNTS_DEPARTMENT]),
  scholarshipController.listSchemes,
);
router.post(
  "/schemes",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL]),
  [
    body("name").trim().isLength({ min: 2, max: 200 }),
    body("scholarshipType").isIn(["government", "institutional", "private", "merit", "need_based"]),
    body("awardingBody").trim().isLength({ min: 2, max: 200 }),
    body("academicYear").trim().isLength({ min: 4, max: 20 }),
    body("benefitMode").isIn(["fee_credit", "bank_transfer"]),
    body("applicationStart").isISO8601(),
    body("applicationEnd").isISO8601(),
    body("budgetAmount").isFloat({ gt: 0 }),
    body("maxAwardAmount").isFloat({ gt: 0 }),
  ],
  validate,
  scholarshipController.createScheme,
);

router.get(
  "/",
  authenticate,
  requireRoles([
    SUPER_ADMIN,
    PRINCIPAL,
    SCHOLARSHIP_CELL,
    ACCOUNTS_DEPARTMENT,
    SystemRole.ADMINISTRATION_OFFICE,
  ]),
  scholarshipController.list,
);
router.get("/my", authenticate, requireRoles([STUDENT]), scholarshipController.listMine);
router.get(
  "/summary",
  authenticate,
  requireRoles([
    SUPER_ADMIN,
    PRINCIPAL,
    SCHOLARSHIP_CELL,
    ACCOUNTS_DEPARTMENT,
    SystemRole.ADMINISTRATION_OFFICE,
  ]),
  scholarshipController.getSummary,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([
    SUPER_ADMIN,
    PRINCIPAL,
    SCHOLARSHIP_CELL,
    ACCOUNTS_DEPARTMENT,
    STUDENT,
    SystemRole.ADMINISTRATION_OFFICE,
  ]),
  scholarshipController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles([STUDENT]),
  [
    body("schemeId").isMongoId().withMessage("Valid scholarship scheme required"),
    body("amount").isFloat({ gt: 0 }).withMessage("Requested amount must be greater than zero"),
    body("documents").optional().isArray({ max: 20 }),
  ],
  validate,
  scholarshipController.apply,
);
router.put(
  "/:id/review",
  authenticate,
  requireRoles([SCHOLARSHIP_CELL]),
  [param("id").isMongoId().withMessage("Invalid ID"), body("remarks").optional().isString()],
  validate,
  scholarshipController.review,
);
router.put(
  "/:id/approve",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL]),
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("amount").optional().isFloat({ gt: 0 }),
    body("remarks").optional().isString(),
  ],
  validate,
  scholarshipController.approve,
);
router.put(
  "/:id/reject",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL, SCHOLARSHIP_CELL]),
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("remarks").trim().isLength({ min: 3, max: 2000 }),
  ],
  validate,
  scholarshipController.reject,
);
router.put(
  "/:id/disburse",
  authenticate,
  requireRoles([ACCOUNTS_DEPARTMENT]),
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("referenceNo").trim().isLength({ min: 3, max: 200 }),
  ],
  validate,
  scholarshipController.disburse,
);

export default router;
