import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { procurementController } from "../controllers/procurement.controller";
import { procureToPayController } from "../controllers/procure-to-pay.controller";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.PROCUREMENT, PermissionAction.VIEW);
const canCreate = requirePermission(Module.PROCUREMENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.PROCUREMENT, PermissionAction.EDIT);
const canApprove = requirePermission(Module.PROCUREMENT, PermissionAction.APPROVE);
const canReceive = requirePermission(Module.STORE, PermissionAction.EDIT);
const canPay = requirePermission(Module.ACCOUNTS, PermissionAction.EDIT);

// List requisitions (HODs see department, Faculty see all/own, Admins see global)
router.get(
  "/requisitions",
  authenticate,
  canView,
  [
    query("departmentId").optional().isMongoId(),
    query("status")
      .optional()
      .isIn(["pending", "hod_approved", "approved", "partially_received", "received", "rejected"]),
  ],
  validate,
  procurementController.getAll,
);

// Raise requisition
router.post(
  "/requisitions",
  authenticate,
  canCreate,
  [
    body("itemName").trim().isLength({ min: 2, max: 255 }),
    body("quantity").isInt({ min: 1 }),
    body("estimatedCost").isFloat({ min: 0 }),
    body("purpose").trim().isLength({ min: 5, max: 5000 }),
    body("departmentId").optional().isMongoId(),
    body("notes").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  procurementController.createRequisition,
);

// Finalize status (HOD approve or Admin/Dean final approve/reject)
router.patch(
  "/requisitions/:id/decide",
  authenticate,
  canApprove,
  [
    param("id").isMongoId(),
    body("action").isIn(["hod_approve", "approve", "reject"]),
    body("notes").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  procurementController.decideRequisition,
);

router.post(
  "/requisitions/:id/receive",
  [
    param("id").isMongoId().withMessage("Invalid requisition ID"),
    body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive whole number"),
  ],
  validate,
  authenticate,
  canReceive,
  procurementController.receiveGoods,
);

router.get("/vendors", authenticate, canView, procureToPayController.listVendors);
router.post(
  "/vendors",
  authenticate,
  canCreate,
  [
    body("legalName").isString().trim().isLength({ min: 2, max: 255 }),
    body("email").isEmail().normalizeEmail(),
    body("phone").isString().trim().isLength({ min: 7, max: 30 }),
    body("address").isString().trim().isLength({ min: 5, max: 1000 }),
    body("paymentTermsDays").optional().isInt({ min: 0, max: 365 }),
  ],
  validate,
  procureToPayController.createVendor,
);
router.post(
  "/vendors/:id/submit",
  authenticate,
  canEdit,
  [param("id").isMongoId()],
  validate,
  procureToPayController.submitVendor,
);
router.patch(
  "/vendors/:id/decide",
  authenticate,
  canApprove,
  [
    param("id").isMongoId(),
    body("action").isIn(["approve", "suspend"]),
    body("reason").optional().isString().trim().isLength({ min: 5, max: 1000 }),
  ],
  validate,
  procureToPayController.decideVendor,
);

router.get("/rfqs", authenticate, canView, procureToPayController.listRfqs);
router.post(
  "/rfqs",
  authenticate,
  canCreate,
  [
    body("requisitionId").isMongoId(),
    body("vendorIds").isArray({ min: 1 }),
    body("vendorIds.*").isMongoId(),
    body("closesAt").isISO8601(),
  ],
  validate,
  procureToPayController.createRfq,
);
router.post(
  "/rfqs/:id/quotes",
  authenticate,
  canEdit,
  [
    param("id").isMongoId(),
    body("vendorId").isMongoId(),
    body("quoteNumber").isString().trim().isLength({ min: 1, max: 100 }),
    body("subtotal").isFloat({ min: 0 }),
    body("taxAmount").isFloat({ min: 0 }),
    body("totalAmount").isFloat({ min: 0 }),
    body("deliveryDays").isInt({ min: 0, max: 365 }),
    body("validUntil").isISO8601(),
    body("attachmentUrl")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  procureToPayController.addQuote,
);
router.patch(
  "/rfqs/:id/award",
  authenticate,
  canApprove,
  [
    param("id").isMongoId(),
    body("quoteNumber").isString().trim().notEmpty(),
    body("reason").isString().trim().isLength({ min: 10, max: 1000 }),
  ],
  validate,
  procureToPayController.awardRfq,
);

router.get("/purchase-orders", authenticate, canView, procureToPayController.listPurchaseOrders);
router.get("/goods-receipts", authenticate, canView, procureToPayController.listGoodsReceipts);
router.post(
  "/purchase-orders/:id/receive",
  authenticate,
  canReceive,
  [
    param("id").isMongoId(),
    body("quantityReceived").isInt({ min: 1 }),
    body("quantityAccepted").isInt({ min: 0 }),
    body("quantityRejected").isInt({ min: 0 }),
    body("inspectionNotes").optional().isString().trim().isLength({ max: 1000 }),
  ],
  validate,
  procureToPayController.receiveAndInspect,
);
router.post(
  "/goods-receipts/:id/return",
  authenticate,
  canReceive,
  [param("id").isMongoId(), body("reason").isString().trim().isLength({ min: 5, max: 1000 })],
  validate,
  procureToPayController.returnRejectedGoods,
);

router.get("/supplier-invoices", authenticate, canView, procureToPayController.listInvoices);
router.post(
  "/supplier-invoices",
  authenticate,
  canCreate,
  [
    body("invoiceNumber").isString().trim().isLength({ min: 1, max: 100 }),
    body("purchaseOrderId").isMongoId(),
    body("grnIds").isArray({ min: 1 }),
    body("grnIds.*").isMongoId(),
    body("subtotal").isFloat({ min: 0 }),
    body("taxAmount").isFloat({ min: 0 }),
    body("totalAmount").isFloat({ min: 0 }),
    body("dueDate").isISO8601(),
  ],
  validate,
  procureToPayController.submitInvoice,
);
router.patch(
  "/supplier-invoices/:id/decide",
  authenticate,
  canApprove,
  [
    param("id").isMongoId(),
    body("action").isIn(["approve", "reject"]),
    body("reason").optional().isString().trim().isLength({ min: 5, max: 1000 }),
  ],
  validate,
  procureToPayController.decideInvoice,
);
router.post(
  "/supplier-invoices/:id/pay",
  authenticate,
  canPay,
  [
    param("id").isMongoId(),
    body("paymentReference").isString().trim().isLength({ min: 3, max: 100 }),
    body("paymentDate").isISO8601(),
  ],
  validate,
  procureToPayController.payInvoice,
);

export default router;
