import { Router } from "express";
import { body, param, query } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { campusGovernanceController } from "../controllers/campus-governance.controller";
import { authenticate, requirePermission, validate } from "../middlewares";

const router = Router();
const canView = requirePermission(Module.USER_MANAGEMENT, PermissionAction.VIEW);
const canCreate = requirePermission(Module.USER_MANAGEMENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.USER_MANAGEMENT, PermissionAction.EDIT);
const canApprove = requirePermission(Module.USER_MANAGEMENT, PermissionAction.APPROVE);
const canDelete = requirePermission(Module.USER_MANAGEMENT, PermissionAction.DELETE);
const campusRules = [
  body("code").trim().isLength({ min: 2, max: 24 }),
  body("name").trim().isLength({ min: 2, max: 200 }),
  body("type").isIn(["campus", "school", "learning_center"]),
  body("parentCampusId").optional({ checkFalsy: true }).isMongoId(),
  body("timezone").trim().isLength({ min: 3, max: 80 }),
  body("address.line1").trim().isLength({ min: 2, max: 300 }),
  body("address.city").trim().isLength({ min: 2, max: 100 }),
  body("address.state").trim().isLength({ min: 2, max: 100 }),
  body("address.postalCode").trim().isLength({ min: 3, max: 20 }),
  body("address.country").trim().isLength({ min: 2, max: 100 }),
  body("status").isIn(["planned", "active", "inactive", "closed"]),
  body("openedAt").optional({ checkFalsy: true }).isISO8601(),
  body("closedAt").optional({ checkFalsy: true }).isISO8601(),
];
router.use(authenticate, canView);
router.get("/campuses", campusGovernanceController.campuses);
router.post("/campuses", canCreate, campusRules, validate, campusGovernanceController.saveCampus);
router.put(
  "/campuses/:id",
  canEdit,
  [param("id").isMongoId(), ...campusRules],
  validate,
  campusGovernanceController.saveCampus,
);
router.put(
  "/departments/:departmentId/campus",
  canEdit,
  [param("departmentId").isMongoId(), body("campusId").isMongoId()],
  validate,
  campusGovernanceController.bindDepartment,
);
router.get("/assignments", campusGovernanceController.assignments);
router.post(
  "/assignments",
  canCreate,
  [
    body("campusId").isMongoId(),
    body("userId").isMongoId(),
    body("scopeRole").isIn(["leader", "academic", "finance", "operations", "viewer"]),
    body("isPrimary").optional().isBoolean(),
    body("startsAt").isISO8601(),
    body("endsAt").optional({ checkFalsy: true }).isISO8601(),
  ],
  validate,
  campusGovernanceController.assign,
);
router.delete(
  "/assignments/:id",
  canDelete,
  [param("id").isMongoId()],
  validate,
  campusGovernanceController.revoke,
);
router.get("/calendars", campusGovernanceController.calendars);
router.post(
  "/calendars",
  canCreate,
  [
    body("campusId").isMongoId(),
    body("academicYear")
      .trim()
      .matches(/^\d{4}-\d{2}$/),
    body("name").trim().isLength({ min: 2, max: 200 }),
    body("events").isArray({ max: 500 }),
    body("events.*.title").trim().isLength({ min: 2, max: 200 }),
    body("events.*.category").isIn(["holiday", "academic", "exam", "operations", "community"]),
    body("events.*.startAt").isISO8601(),
    body("events.*.endAt").isISO8601(),
  ],
  validate,
  campusGovernanceController.createCalendar,
);
router.post(
  "/calendars/:id/publish",
  canApprove,
  [param("id").isMongoId()],
  validate,
  campusGovernanceController.publishCalendar,
);
router.get(
  "/campuses/:campusId/calendar",
  [param("campusId").isMongoId(), query("academicYear").trim().isLength({ min: 4, max: 20 })],
  validate,
  campusGovernanceController.effectiveCalendar,
);
router.get("/shared-services", campusGovernanceController.sharedServices);
router.post(
  "/shared-services",
  canCreate,
  [
    body("code").trim().isLength({ min: 2, max: 40 }),
    body("name").trim().isLength({ min: 2, max: 200 }),
    body("serviceType").isIn([
      "library",
      "transport",
      "procurement",
      "finance",
      "hr",
      "it",
      "admissions",
      "other",
    ]),
    body("providerCampusId").isMongoId(),
    body("consumerCampusIds").isArray({ min: 1, max: 100 }),
    body("consumerCampusIds.*").isMongoId(),
    body("allocationMethod").isIn(["equal", "headcount", "usage", "fixed"]),
    body("annualBudget").optional().isFloat({ min: 0 }),
    body("startsAt").isISO8601(),
    body("endsAt").optional({ checkFalsy: true }).isISO8601(),
    body("status").isIn(["draft", "active", "suspended", "ended"]),
    body("ownerId").isMongoId(),
  ],
  validate,
  campusGovernanceController.createSharedService,
);
router.get("/metrics", campusGovernanceController.metrics);
export default router;
