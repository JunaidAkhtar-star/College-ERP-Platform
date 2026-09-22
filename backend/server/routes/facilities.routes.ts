import { Router } from "express";
import { body, param } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { facilitiesController } from "../controllers/facilities.controller";
import { authenticate, requirePermission, validate } from "../middlewares";
const router = Router();
const canCreate = requirePermission(Module.STORE, PermissionAction.CREATE);
const canEdit = requirePermission(Module.STORE, PermissionAction.EDIT);
router.use(authenticate, requirePermission(Module.STORE, PermissionAction.VIEW));
const campus = [body("campusId").isMongoId()];
router.get("/dashboard", facilitiesController.dashboard);
router.get("/spaces", facilitiesController.spaces);
router.post(
  "/spaces",
  canCreate,
  [
    ...campus,
    body("code").trim().isLength({ min: 2, max: 30 }),
    body("name").trim().isLength({ min: 2, max: 160 }),
    body("building").trim().isLength({ min: 2, max: 160 }),
    body("type").isIn([
      "classroom",
      "laboratory",
      "office",
      "auditorium",
      "library",
      "sports",
      "hostel",
      "utility",
      "other",
    ]),
    body("capacity").isInt({ min: 0, max: 100000 }),
    body("status").optional().isIn(["active", "maintenance", "inactive"]),
  ],
  validate,
  facilitiesController.createSpace,
);
router.get("/assets", facilitiesController.assets);
router.post(
  "/assets",
  canCreate,
  [
    ...campus,
    body("assetTag").trim().isLength({ min: 2, max: 60 }),
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("category").trim().isLength({ min: 2, max: 80 }),
    body("spaceId").optional({ checkFalsy: true }).isMongoId(),
    body("storeItemId").optional({ checkFalsy: true }).isMongoId(),
    body("custodianId").optional({ checkFalsy: true }).isMongoId(),
    body("condition").isIn(["excellent", "good", "fair", "poor", "unserviceable"]),
    body("maintenanceIntervalDays").optional({ checkFalsy: true }).isInt({ min: 1, max: 3650 }),
  ],
  validate,
  facilitiesController.createAsset,
);
router.get("/work-orders", facilitiesController.workOrders);
router.post(
  "/work-orders",
  canCreate,
  [
    ...campus,
    body("spaceId").optional({ checkFalsy: true }).isMongoId(),
    body("assetId").optional({ checkFalsy: true }).isMongoId(),
    body("assignedTo").optional({ checkFalsy: true }).isMongoId(),
    body("title").trim().isLength({ min: 2, max: 180 }),
    body("description").trim().isLength({ min: 5, max: 3000 }),
    body("category").isIn(["corrective", "preventive", "inspection", "safety", "cleaning"]),
    body("priority").isIn(["low", "medium", "high", "critical"]),
    body("dueAt").optional({ checkFalsy: true }).isISO8601(),
  ],
  validate,
  facilitiesController.createWorkOrder,
);
router.patch(
  "/work-orders/:id/status",
  [
    param("id").isMongoId(),
    body("status").isIn(["assigned", "in_progress", "on_hold", "completed", "cancelled"]),
    body("resolution").optional().trim().isLength({ max: 3000 }),
    body("laborCost").optional().isFloat({ min: 0 }),
    body("materialCost").optional().isFloat({ min: 0 }),
  ],
  validate,
  facilitiesController.transitionWorkOrder,
);
router.post("/work-orders/generate-preventive", canEdit, facilitiesController.generatePreventive);
router.get("/bookings", facilitiesController.bookings);
router.post(
  "/bookings",
  canCreate,
  [
    ...campus,
    body("spaceId").isMongoId(),
    body("title").trim().isLength({ min: 2, max: 180 }),
    body("purpose").trim().isLength({ min: 3, max: 1000 }),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
    body("attendees").isInt({ min: 1, max: 100000 }),
  ],
  validate,
  facilitiesController.createBooking,
);
router.get("/inspections", facilitiesController.inspections);
router.post(
  "/inspections",
  canCreate,
  [
    ...campus,
    body("spaceId").isMongoId(),
    body("checklist").isArray({ min: 1, max: 100 }),
    body("checklist.*.item").trim().isLength({ min: 2, max: 300 }),
    body("checklist.*.passed").isBoolean(),
    body("followUpDueAt").optional({ checkFalsy: true }).isISO8601(),
  ],
  validate,
  facilitiesController.createInspection,
);
export default router;
