import { Router } from "express";
import { param, body } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { accountsController } from "../controllers";
import { paymentSubmissionController } from "../controllers/payment-submission.controller";
import { SystemRole } from "../constants/roles";
import { financeControlController } from "../controllers/finance-control.controller";

const router = Router();
const { SUPER_ADMIN, ACCOUNTS_DEPARTMENT, PRINCIPAL } = SystemRole;
const accountsGuard = requireRoles([
  SUPER_ADMIN,
  ACCOUNTS_DEPARTMENT,
  PRINCIPAL,
  SystemRole.ADMIN,
  SystemRole.ADMINISTRATION_OFFICE,
]);
const strictAccountsGuard = requireRoles([SUPER_ADMIN, ACCOUNTS_DEPARTMENT]);
const financeApproverGuard = requireRoles([SUPER_ADMIN, PRINCIPAL]);

router.get("/periods", authenticate, accountsGuard, financeControlController.listPeriods);
router.post(
  "/periods",
  authenticate,
  strictAccountsGuard,
  [body("financialYear").matches(/^\d{4}-\d{2}$/)],
  validate,
  financeControlController.createYear,
);
router.patch(
  "/periods/:id/status",
  authenticate,
  financeApproverGuard,
  [
    param("id").isMongoId(),
    body("status").isIn(["open", "soft_closed", "closed"]),
    body("reason").isString().trim().isLength({ min: 10, max: 1000 }),
  ],
  validate,
  financeControlController.closePeriod,
);
router.get("/budgets", authenticate, accountsGuard, financeControlController.listBudgets);
router.post(
  "/budgets",
  authenticate,
  strictAccountsGuard,
  [
    body("financialYear").matches(/^\d{4}-\d{2}$/),
    body("budgetHead").isString().trim().isLength({ min: 2, max: 100 }),
    body("approvedAmount").isFloat({ gt: 0 }),
    body("departmentId").optional({ values: "falsy" }).isMongoId(),
  ],
  validate,
  financeControlController.createBudget,
);
router.post(
  "/budgets/:id/submit",
  authenticate,
  strictAccountsGuard,
  [param("id").isMongoId()],
  validate,
  financeControlController.submitBudget,
);
router.post(
  "/budgets/:id/approve",
  authenticate,
  financeApproverGuard,
  [param("id").isMongoId()],
  validate,
  financeControlController.approveBudget,
);
router.get("/bank-lines", authenticate, accountsGuard, financeControlController.listBankLines);
router.post(
  "/bank-lines/import",
  authenticate,
  strictAccountsGuard,
  [body("lines").isArray({ min: 1, max: 5000 })],
  validate,
  financeControlController.importBankLines,
);
router.patch(
  "/bank-lines/:id/match",
  authenticate,
  strictAccountsGuard,
  [
    param("id").isMongoId(),
    body("journalEntryId").isMongoId(),
    body("note").optional().isString().trim().isLength({ max: 1000 }),
  ],
  validate,
  financeControlController.matchBankLine,
);
router.get(
  "/receivable-aging",
  authenticate,
  accountsGuard,
  financeControlController.receivableAging,
);
router.get("/tax-configs", authenticate, accountsGuard, financeControlController.listTaxConfigs);
router.post(
  "/tax-configs",
  authenticate,
  strictAccountsGuard,
  [
    body("code").isString().trim().isLength({ min: 2, max: 50 }),
    body("name").isString().trim().isLength({ min: 2, max: 150 }),
    body("taxType").isIn(["gst", "tds"]),
    body("rate").isFloat({ min: 0, max: 100 }),
    body("effectiveFrom").isISO8601(),
    body("effectiveTo").optional({ values: "falsy" }).isISO8601(),
    body("inputAccountCode").optional({ values: "falsy" }).isString().trim(),
    body("outputAccountCode").isString().trim().isLength({ min: 2, max: 50 }),
  ],
  validate,
  financeControlController.createTaxConfig,
);
router.post(
  "/tax-configs/:id/submit",
  authenticate,
  strictAccountsGuard,
  [param("id").isMongoId()],
  validate,
  financeControlController.submitTaxConfig,
);
router.post(
  "/tax-configs/:id/approve",
  authenticate,
  financeApproverGuard,
  [param("id").isMongoId()],
  validate,
  financeControlController.approveTaxConfig,
);

// ── Accounts Transactions ─────────────────────────────────────────────────────
router.get("/", authenticate, accountsGuard, accountsController.list);
router.get("/summary", authenticate, accountsGuard, accountsController.summary);
router.get("/monthly-flow", authenticate, accountsGuard, accountsController.monthlyFlow);
router.get("/balance", authenticate, accountsGuard, accountsController.balance);
router.get("/journals", authenticate, accountsGuard, accountsController.journals);
router.get("/trial-balance", authenticate, accountsGuard, accountsController.trialBalance);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  accountsGuard,
  accountsController.getById,
);
router.post(
  "/",
  authenticate,
  strictAccountsGuard,
  [
    body("transactionType").isIn(["income", "expense"]),
    body("category").trim().isLength({ min: 2, max: 100 }),
    body("amount").isFloat({ gt: 0, max: 1000000000 }),
    body("paymentMode").isIn(["cash", "bank_transfer", "cheque", "upi", "dd"]),
    body("description").trim().isLength({ min: 3, max: 500 }),
    body("date").isISO8601(),
    body("financialYear").matches(/^\d{4}-\d{2}$/),
    body("departmentId").optional({ values: "falsy" }).isMongoId(),
  ],
  validate,
  accountsController.create,
);
router.post(
  "/:id/reverse",
  authenticate,
  strictAccountsGuard,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("reason").trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  accountsController.reverse,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  strictAccountsGuard,
  accountsController.update,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  strictAccountsGuard,
  accountsController.remove,
);

// ── Payment Submission Verification (Accounts Portal) ────────────────────────
// List all student payment submissions
router.get(
  "/payment-submissions/counts",
  authenticate,
  accountsGuard,
  paymentSubmissionController.getCounts,
);
router.get("/payment-submissions", authenticate, accountsGuard, paymentSubmissionController.list);
router.get(
  "/payment-submissions/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  accountsGuard,
  paymentSubmissionController.getById,
);

// Mark under review
router.put(
  "/payment-submissions/:id/review",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  strictAccountsGuard,
  paymentSubmissionController.markUnderReview,
);

// Approve submission (optionally upload official receipt)
router.put(
  "/payment-submissions/:id/approve",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("studentEmail").optional().isEmail().withMessage("Valid student email required"),
    body("studentName").optional().isString(),
    body("officialInvoiceNumber").optional().isString().trim(),
    body("officialReceiptNumber").optional().isString().trim(),
    body("approvalReferenceNo").optional().isString().trim(),
    body("ddNumber").optional().isString().trim(),
    body("chequeNumber").optional().isString().trim(),
    body("remarks").optional().isString().trim(),
  ],
  validate,
  authenticate,
  strictAccountsGuard,
  paymentSubmissionController.approve,
);

router.post(
  "/payment-submissions/:id/receipt/retry",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  strictAccountsGuard,
  paymentSubmissionController.retryReceipt,
);

// Reject submission
router.put(
  "/payment-submissions/:id/reject",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("reason").notEmpty().withMessage("Rejection reason is required"),
  ],
  validate,
  authenticate,
  strictAccountsGuard,
  paymentSubmissionController.reject,
);

export default router;
