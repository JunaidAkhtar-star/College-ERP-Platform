/**
 * HR Routes — SRS §4.8, Modules 36–39
 * Employee management: create, list, update, terminate.
 */
import { Router } from "express";
import { authenticate, requireRoles, ipWhitelist, validate } from "../middlewares";
import { hrController } from "../controllers/hr.controller";
import { EMPLOYEE_ROLES, SystemRole } from "../constants/roles";
import { body, param, query } from "express-validator";

const router = Router();

const hrAdmin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.HR_DEPARTMENT,
]);

const hrMonitors = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.HR_DEPARTMENT,
  SystemRole.ADMINISTRATION_OFFICE,
]);

const anyStaff = requireRoles(EMPLOYEE_ROLES);

// HR admin routes — IP whitelisted
router.use("/employees", ipWhitelist);

// GET /hr/me — any authenticated staff views their own record
router.get("/me", authenticate, anyStaff, hrController.getMyRecord);

// CRUD
router.post(
  "/employees",
  authenticate,
  hrAdmin,
  [
    body("userId").isMongoId(),
    body("department").isMongoId(),
    body("name").isString().trim().isLength({ min: 2, max: 150 }),
    body("email").isEmail().normalizeEmail(),
    body("phone").isString().trim().isLength({ min: 7, max: 20 }),
    body("gender").isIn(["male", "female", "other"]),
    body("designation").isString().trim().isLength({ min: 2, max: 150 }),
    body("employmentType").isIn(["permanent", "contractual", "visiting", "adhoc", "guest_faculty"]),
    body("dateOfJoining").isISO8601(),
    body("basicSalary").isFloat({ min: 0 }),
    body("aadhaarNumber")
      .optional()
      .matches(/^\d{12}$/),
    body("panNumber")
      .optional()
      .matches(/^[A-Z]{5}\d{4}[A-Z]$/i),
  ],
  validate,
  hrController.create,
);
router.get(
  "/employees",
  authenticate,
  hrMonitors,
  [
    query("department").optional().isMongoId(),
    query("status").optional().isIn(["active", "on_leave", "resigned", "retired", "terminated"]),
    query("type")
      .optional()
      .isIn(["permanent", "contractual", "visiting", "adhoc", "guest_faculty"]),
    query("search").optional().isString().trim().isLength({ max: 100 }),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  hrController.list,
);
router.get(
  "/employees/:id",
  authenticate,
  hrMonitors,
  [param("id").isMongoId()],
  validate,
  hrController.getById,
);
router.put(
  "/employees/:id",
  authenticate,
  hrAdmin,
  [
    param("id").isMongoId(),
    body("department").optional().isMongoId(),
    body("name").optional().isString().trim().isLength({ min: 2, max: 150 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().isString().trim().isLength({ min: 7, max: 20 }),
    body("gender").optional().isIn(["male", "female", "other"]),
    body("designation").optional().isString().trim().isLength({ min: 2, max: 150 }),
    body("employmentType")
      .optional()
      .isIn(["permanent", "contractual", "visiting", "adhoc", "guest_faculty"]),
    body("dateOfJoining").optional().isISO8601(),
    body("basicSalary").optional().isFloat({ min: 0 }),
    body("aadhaarNumber")
      .optional()
      .matches(/^\d{12}$/),
    body("panNumber")
      .optional()
      .matches(/^[A-Z]{5}\d{4}[A-Z]$/i),
    body("employmentStatus")
      .optional()
      .isIn(["active", "on_leave", "resigned", "retired", "terminated"]),
  ],
  validate,
  hrController.update,
);
router.delete(
  "/employees/:id",
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL]),
  [param("id").isMongoId()],
  validate,
  hrController.terminate,
);

export default router;
