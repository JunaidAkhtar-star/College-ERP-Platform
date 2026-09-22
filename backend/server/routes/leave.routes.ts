import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { leaveController } from "../controllers";
import { EMPLOYEE_ROLES, SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, HOD } = SystemRole;
const listValidators = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("employeeId").optional().isMongoId(),
  query("departmentId").optional().isMongoId(),
  query("status").optional().isIn(["pending", "approved", "rejected", "cancelled"]),
  query("leaveType")
    .optional()
    .isIn([
      "casual",
      "sick",
      "earned",
      "on_duty",
      "maternity",
      "paternity",
      "special",
      "loss_of_pay",
    ]),
];
const idValidator = [param("id").isMongoId().withMessage("Invalid ID")];
const rejectionValidator = [
  ...idValidator,
  body("reason")
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Rejection reason is required"),
];

router.get(
  "/",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL, HOD]),
  listValidators,
  validate,
  leaveController.list,
);
router.get(
  "/my",
  authenticate,
  requireRoles(EMPLOYEE_ROLES),
  listValidators,
  validate,
  leaveController.listMine,
);
router.get(
  "/balance",
  authenticate,
  requireRoles(EMPLOYEE_ROLES),
  [
    query("academicYear")
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
      .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format"),
  ],
  validate,
  leaveController.myBalance,
);
router.get(
  "/:id",
  authenticate,
  requireRoles(EMPLOYEE_ROLES),
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  leaveController.getById,
);
router.post(
  "/",
  authenticate,
  requireRoles(EMPLOYEE_ROLES),
  [
    body("leaveType").isIn([
      "casual",
      "sick",
      "earned",
      "on_duty",
      "maternity",
      "paternity",
      "special",
      "loss_of_pay",
    ]),
    body("fromDate").isISO8601().withMessage("Valid start date is required"),
    body("toDate").isISO8601().withMessage("Valid end date is required"),
    body("totalDays").isInt({ min: 1, max: 366 }).toInt(),
    body("reason").isString().trim().isLength({ min: 5, max: 1000 }),
  ],
  validate,
  leaveController.apply,
);
router.put(
  "/:id/hod-approve",
  authenticate,
  idValidator,
  validate,
  requireRoles([SUPER_ADMIN, HOD]),
  leaveController.hodApprove,
);
router.put(
  "/:id/hod-reject",
  authenticate,
  rejectionValidator,
  validate,
  requireRoles([SUPER_ADMIN, HOD]),
  leaveController.hodReject,
);
router.put(
  "/:id/approve",
  authenticate,
  idValidator,
  validate,
  requireRoles([SUPER_ADMIN, PRINCIPAL]),
  leaveController.adminApprove,
);
router.put(
  "/:id/reject",
  authenticate,
  rejectionValidator,
  validate,
  requireRoles([SUPER_ADMIN, PRINCIPAL]),
  leaveController.adminReject,
);
router.put(
  "/:id/cancel",
  authenticate,
  requireRoles(EMPLOYEE_ROLES),
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  leaveController.cancel,
);

export default router;
