import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { transportController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, ADMINISTRATION_OFFICE, TRANSPORTATION, STUDENT } =
  SystemRole;
const transportStaff = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  ADMINISTRATION_OFFICE,
  TRANSPORTATION,
]);
const transportReaders = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  ADMINISTRATION_OFFICE,
  TRANSPORTATION,
  STUDENT,
]);

// Routes
router.get("/routes", authenticate, transportReaders, transportController.listRoutes);
router.post(
  "/routes",
  authenticate,
  transportStaff,
  [
    body("routeNo").trim().isLength({ min: 1, max: 30 }),
    body("routeName").trim().isLength({ min: 2, max: 150 }),
    body("stops").isArray({ min: 1 }),
    body("stops.*.stopName").trim().notEmpty(),
    body("stops.*.stopTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("stops.*.fareFromOrigin").isFloat({ min: 0 }),
    body("driverName").trim().notEmpty(),
    body("driverPhone")
      .trim()
      .matches(/^[0-9+() -]{7,20}$/),
    body("vehicleNo").trim().notEmpty(),
    body("vehicleType").trim().notEmpty(),
    body("capacity").isInt({ min: 1, max: 200 }),
  ],
  validate,
  transportController.addRoute,
);
router.put(
  "/routes/:id",
  authenticate,
  transportStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("capacity").optional().isInt({ min: 1, max: 200 }),
    body("stops").optional().isArray({ min: 1 }),
    body("stops.*.stopTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("stops.*.fareFromOrigin").optional().isFloat({ min: 0 }),
  ],
  validate,
  transportController.updateRoute,
);

// Allocations
router.get(
  "/allocations/my",
  authenticate,
  requireRoles([STUDENT]),
  transportController.myAllocation,
);
router.get("/allocations", authenticate, transportStaff, transportController.listAllocations);
router.post(
  "/allocations",
  authenticate,
  transportStaff,
  [
    body("studentId").isMongoId(),
    body("routeId").isMongoId(),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("stopName").trim().notEmpty(),
  ],
  validate,
  transportController.allocate,
);
router.put(
  "/allocations/:id/cancel",
  authenticate,
  transportStaff,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  transportController.cancel,
);

router.post(
  "/fees",
  authenticate,
  transportStaff,
  [
    body("allocationId").isMongoId(),
    body("month").matches(/^\d{4}-(0[1-9]|1[0-2])$/),
    body("dueDate").isISO8601(),
  ],
  validate,
  transportController.generateFee,
);
router.get(
  "/fees",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, ADMINISTRATION_OFFICE, TRANSPORTATION, STUDENT]),
  transportController.listFees,
);
router.post(
  "/fees/:id/payments",
  authenticate,
  transportStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("amount").isFloat({ gt: 0 }),
    body("paymentMode").isIn(["cash", "bank_transfer", "upi", "dd", "cheque"]),
  ],
  validate,
  transportController.collectFee,
);

// ─── Drivers (M41) ────────────────────────────────────────────────────────────
router.post(
  "/drivers",
  authenticate,
  transportStaff,
  [
    body("name").trim().isLength({ min: 2, max: 120 }),
    body("phone")
      .trim()
      .matches(/^[0-9+() -]{7,20}$/),
    body("licenseNo").trim().isLength({ min: 3, max: 80 }),
    body("licenseExpiry").isISO8601(),
    body("experience").optional().isFloat({ min: 0, max: 80 }),
    body("assignedRoute").optional({ nullable: true }).isMongoId(),
  ],
  validate,
  transportController.createDriver,
);
router.get("/drivers", authenticate, transportStaff, transportController.listDrivers);
router.get(
  "/drivers/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  transportStaff,
  transportController.getDriver,
);
router.put(
  "/drivers/:id",
  authenticate,
  transportStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("licenseExpiry").optional().isISO8601(),
    body("experience").optional().isFloat({ min: 0, max: 80 }),
    body("assignedRoute").optional({ nullable: true }).isMongoId(),
  ],
  validate,
  transportController.updateDriver,
);
router.delete(
  "/drivers/:id",
  authenticate,
  transportStaff,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  transportController.deleteDriver,
);

// ─── GPS (M41 — live bus tracking) ─────────────────────────────────────────────────────────
router.get(
  "/gps/live",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, ADMINISTRATION_OFFICE, TRANSPORTATION, STUDENT]),
  transportController.listLiveGps,
);
router.post(
  "/tracking/sessions",
  authenticate,
  transportStaff,
  [body("routeId").isMongoId().withMessage("Invalid route ID")],
  validate,
  transportController.startTrackingSession,
);
router.post(
  "/tracking/sessions/:id/positions",
  authenticate,
  transportStaff,
  [
    param("id").isMongoId().withMessage("Invalid tracking session ID"),
    body("lat").isFloat({ min: -90, max: 90 }).toFloat(),
    body("lng").isFloat({ min: -180, max: 180 }).toFloat(),
    body("speed").optional().isFloat({ min: 0, max: 200 }).toFloat(),
    body("heading").optional().isFloat({ min: 0, max: 360 }).toFloat(),
    body("accuracy").optional().isFloat({ min: 0, max: 5000 }).toFloat(),
    body("recordedAt").isISO8601().withMessage("A valid GPS timestamp is required"),
  ],
  validate,
  transportController.recordTrackingPosition,
);
router.delete(
  "/tracking/sessions/:id",
  authenticate,
  transportStaff,
  [param("id").isMongoId().withMessage("Invalid tracking session ID")],
  validate,
  transportController.stopTrackingSession,
);

export default router;
