import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { payrollController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT, FACULTY } = SystemRole;

router.get(
  "/policy",
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT]),
  payrollController.policy,
);
router.post(
  "/policy",
  [
    body("name").isString().trim().notEmpty(),
    body("effectiveFrom").isISO8601(),
    body("daPercent").isFloat({ min: 0 }),
    body("hraPercent").isFloat({ min: 0 }),
    body("transportAllowance").isFloat({ min: 0 }),
    body("employeePfPercent").isFloat({ min: 0 }),
    body("professionalTax").isFloat({ min: 0 }),
    body("standardDeduction").isFloat({ min: 0 }),
    body("taxSlabs").isArray(),
  ],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT]),
  payrollController.createPolicy,
);

router.get(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT]),
  payrollController.list,
);
router.get(
  "/summary",
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT]),
  payrollController.summary,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT, FACULTY]),
  payrollController.getById,
);
router.post(
  "/generate-monthly",
  [body("month").isInt({ min: 1, max: 12 }), body("year").isInt({ min: 2000, max: 2200 })],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT]),
  payrollController.generateMonthly,
);
router.post(
  "/generate",
  [
    body("employeeId").isMongoId(),
    body("departmentId").isMongoId(),
    body("month").isInt({ min: 1, max: 12 }),
    body("year").isInt({ min: 2000, max: 2200 }),
    body("basicPay").isFloat({ gt: 0 }),
    body("payableDays").isInt({ min: 0, max: 31 }),
  ],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT]),
  payrollController.generate,
);
router.put(
  "/:id/pay",
  authenticate,
  requireRoles([SUPER_ADMIN, ACCOUNTS_DEPARTMENT]),
  payrollController.markPaid,
);
router.put(
  "/:id/review",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT]),
  payrollController.review,
);
router.put(
  "/:id/approve",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, ACCOUNTS_DEPARTMENT]),
  payrollController.approve,
);
router.post(
  "/:id/send-email",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT]),
  payrollController.sendEmail,
);
router.get(
  "/employee/:employeeId/form16",
  authenticate,
  requireRoles([SUPER_ADMIN, HR_DEPARTMENT, ACCOUNTS_DEPARTMENT, FACULTY]),
  payrollController.form16,
);

export default router;
