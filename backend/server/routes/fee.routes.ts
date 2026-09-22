import { Router } from "express";
import { param, body } from "express-validator";
import { feeController } from "../controllers";
import { paymentSubmissionController } from "../controllers/payment-submission.controller";
import { feeAdvancedController } from "../controllers/fee-advanced.controller";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ACCOUNTS_DEPARTMENT,
]);

const feeMonitors = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.ADMIN,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.SCHOLARSHIP_CELL,
]);
const feeRecordViewers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.STUDENT,
]);
const submissionViewers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.SCHOLARSHIP_CELL,
  SystemRole.STUDENT,
]);

// Structures
router.get("/structures", auth, feeMonitors, feeController.getStructures);
router.get(
  "/structures/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  feeMonitors,
  feeController.getStructure,
);
router.post("/structures", auth, admin, feeController.createStructure);

// Analytics
router.get("/summary", auth, feeMonitors, feeController.getCollectionSummary);
router.get("/overdue", auth, feeMonitors, feeController.getOverdueFees);

// Advanced fee governance
router.get("/advanced", auth, feeMonitors, feeAdvancedController.overview);
router.post(
  "/:recordId/installments",
  auth,
  admin,
  [
    param("recordId").isMongoId(),
    body("installments").isArray({ min: 1, max: 24 }),
    body("installments.*.amount").isFloat({ gt: 0 }),
    body("installments.*.dueDate").isISO8601(),
  ],
  validate,
  feeAdvancedController.saveInstallments,
);
router.post(
  "/:recordId/adjustments",
  auth,
  admin,
  [
    param("recordId").isMongoId(),
    body("kind").isIn(["concession", "waiver", "late_fee"]),
    body("amount").isFloat({ gt: 0 }),
    body("reason").isLength({ min: 5, max: 500 }),
  ],
  validate,
  feeAdvancedController.requestAdjustment,
);
router.patch(
  "/adjustments/:id/review",
  auth,
  admin,
  [param("id").isMongoId(), body("decision").isIn(["approved", "rejected"])],
  validate,
  feeAdvancedController.reviewAdjustment,
);
router.post(
  "/:recordId/refunds",
  auth,
  admin,
  [
    param("recordId").isMongoId(),
    body("transactionId").notEmpty(),
    body("amount").isFloat({ gt: 0 }),
    body("reason").isLength({ min: 5, max: 500 }),
    body("destination").isLength({ min: 3, max: 200 }),
  ],
  validate,
  feeAdvancedController.requestRefund,
);
router.patch(
  "/refunds/:id/review",
  auth,
  admin,
  [param("id").isMongoId(), body("decision").isIn(["approved", "rejected"])],
  validate,
  feeAdvancedController.reviewRefund,
);
router.patch(
  "/refunds/:id/complete",
  auth,
  admin,
  [param("id").isMongoId(), body("reference").isLength({ min: 3, max: 200 })],
  validate,
  feeAdvancedController.completeRefund,
);
router.post(
  "/reconciliation/import",
  auth,
  admin,
  [
    body("provider").isLength({ min: 2, max: 100 }),
    body("statementReference").isLength({ min: 2, max: 100 }),
    body("rows").isArray({ min: 1, max: 5000 }),
    body("rows.*.transactionReference").notEmpty(),
    body("rows.*.amount").isFloat({ gt: 0 }),
    body("rows.*.paidAt").isISO8601(),
  ],
  validate,
  feeAdvancedController.importReconciliation,
);

// Invoices & Payments
router.post("/invoice/preview", auth, admin, feeController.previewInvoice);
router.post("/invoice", auth, admin, feeController.generateInvoice);
router.post("/:recordId/payment", auth, admin, feeController.recordPayment);
router.get("/records", auth, feeMonitors, feeController.listRecords);
router.get(
  "/records/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  feeRecordViewers,
  feeController.getRecord,
);
router.get(
  "/student/:studentId",
  [param("studentId").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  feeRecordViewers,
  feeController.getByStudent,
);

// Certificates
router.post("/bonafide/:studentId", auth, admin, feeController.generateBonafide);
router.post("/tc/:studentId", auth, admin, feeController.generateTC);

// ── Payment Submission (Manual QR/Bank transfer verification workflow) ────────
// Students submit proof; Accounts team verifies

// Student submits payment proof for a fee invoice
router.post(
  "/submissions",
  auth,
  requireRoles([SystemRole.STUDENT]),
  [
    body("feeRecordId").isMongoId().withMessage("Valid fee record ID required"),
    body("amountSubmitted").isFloat({ min: 1 }).withMessage("Amount must be greater than 0"),
    body("paymentMode").notEmpty().withMessage("Payment mode is required"),
    body("paymentDate").isISO8601().withMessage("Valid payment date required"),
  ],
  validate,
  paymentSubmissionController.submit,
);

// Student views their submissions
router.get(
  "/submissions/my",
  auth,
  requireRoles([SystemRole.STUDENT]),
  paymentSubmissionController.mySubmissions,
);

// Get submissions for a specific fee record (student or accounts)
router.get(
  "/submissions/record/:feeRecordId",
  [param("feeRecordId").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  submissionViewers,
  paymentSubmissionController.getByFeeRecord,
);

// Get a single submission
router.get(
  "/submissions/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  submissionViewers,
  paymentSubmissionController.getById,
);

// Student resubmits after rejection
router.put(
  "/submissions/:id/resubmit",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  requireRoles([SystemRole.STUDENT]),
  paymentSubmissionController.resubmit,
);

export default router;
