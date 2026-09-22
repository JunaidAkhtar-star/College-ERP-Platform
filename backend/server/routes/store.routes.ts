/**
 * @file store.routes.ts
 */
import { Router } from "express";
import { param, body } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { storeController } from "../controllers/store.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const STORE_MANAGERS = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.STORE,
];
const STORE_MONITORS = [...STORE_MANAGERS, SystemRole.ADMINISTRATION_OFFICE];

// ── Items ────────────────────────────────────────────────────────────────────
router.get("/items", auth, storeController.listItems);
router.get("/items/stats", auth, requireRoles(STORE_MONITORS), storeController.stats);
router.get("/movements", auth, requireRoles(STORE_MONITORS), storeController.listMovements);
router.get("/reorder-plan", auth, requireRoles(STORE_MONITORS), storeController.reorderPlan);
router.get("/reconciliation", auth, requireRoles(STORE_MONITORS), storeController.reconciliation);
router.get(
  "/items/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  storeController.getItem,
);
router.post(
  "/items",
  [
    body("sku").isString().trim().notEmpty(),
    body("name").isString().trim().notEmpty(),
    body("valuationMethod").optional().isIn(["fifo", "weighted_average"]),
    body("reorderQuantity").optional().isFloat({ min: 0 }),
    body("leadTimeDays").optional().isInt({ min: 0, max: 365 }),
    body("batchTracking").optional().isBoolean(),
    body("serialTracking").optional().isBoolean(),
  ],
  validate,
  auth,
  requireRoles(STORE_MANAGERS),
  storeController.createItem,
);
router.patch(
  "/items/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  requireRoles(STORE_MANAGERS),
  storeController.updateItem,
);
router.patch(
  "/items/:id/stock",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("delta")
      .isInt()
      .custom((value) => Number(value) !== 0),
    body("note").isString().trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  auth,
  requireRoles(STORE_MANAGERS),
  storeController.adjustStock,
);
router.delete(
  "/items/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  requireRoles(STORE_MANAGERS),
  storeController.deleteItem,
);

// ── Requests ─────────────────────────────────────────────────────────────────
router.get("/requests", auth, storeController.listRequests);
router.post(
  "/requests",
  [
    body("itemId").isMongoId().withMessage("Valid itemId is required"),
    body("quantity").isInt({ min: 1 }),
    body("purpose").isString().trim().isLength({ min: 5, max: 1000 }),
  ],
  validate,
  auth,
  storeController.createRequest,
);
router.patch(
  "/requests/:id/decide",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("decision").isIn(["approved", "rejected", "issued"]),
    body("remarks").optional().isString().trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  auth,
  requireRoles(STORE_MANAGERS),
  storeController.decideRequest,
);

export default router;
