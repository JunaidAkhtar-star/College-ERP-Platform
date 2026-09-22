import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { gatepassController } from "../controllers/gatepass.controller";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.GATE_PASS, PermissionAction.VIEW);
const canCheckIn = requirePermission(Module.GATE_PASS, PermissionAction.EDIT);
const canCheckOut = requirePermission(Module.GATE_PASS, PermissionAction.APPROVE);

router.get("/outings", authenticate, canView, gatepassController.getOutings);
router.post(
  "/outings",
  authenticate,
  canCheckIn,
  [
    body("reason").trim().isLength({ min: 5, max: 500 }),
    body("destination").trim().isLength({ min: 2, max: 200 }),
    body("departureAt").isISO8601(),
    body("expectedReturnAt").isISO8601(),
    body("emergencyContact")
      .trim()
      .matches(/^[0-9+() -]{7,20}$/),
  ],
  validate,
  gatepassController.applyForOuting,
);
router.patch(
  "/outings/:id/decide",
  authenticate,
  canCheckOut,
  [
    param("id").isMongoId(),
    body("decision").isIn(["approve", "reject"]),
    body("reviewNotes").optional().trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  gatepassController.decideOuting,
);
router.patch(
  "/outings/:id/movement",
  authenticate,
  canCheckOut,
  [param("id").isMongoId(), body("movement").isIn(["exit", "return"])],
  validate,
  gatepassController.recordOutingMovement,
);
router.patch(
  "/outings/:id/cancel",
  authenticate,
  canCheckIn,
  [param("id").isMongoId()],
  validate,
  gatepassController.cancelOuting,
);

// Register access remains scoped by the selected role's effective permissions.
router.get("/", authenticate, canView, gatepassController.getAll);

// Only security/admins can check-in visitors
router.post(
  "/",
  authenticate,
  canCheckIn,
  [
    body("visitorName").trim().isLength({ min: 2, max: 120 }),
    body("visitorPhone")
      .trim()
      .matches(/^[0-9+() -]{7,20}$/),
    body("purpose").trim().isLength({ min: 3, max: 500 }),
    body("hostId").isMongoId(),
    body("vehicleNumber").optional().trim().isLength({ max: 30 }),
    body("remarks").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  gatepassController.checkIn,
);

// Check-out visitor
router.patch(
  "/:id/checkout",
  authenticate,
  canCheckOut,
  [param("id").isMongoId()],
  validate,
  gatepassController.checkOut,
);

export default router;
