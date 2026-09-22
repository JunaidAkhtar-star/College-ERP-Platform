/**
 * Parent Portal Routes — SRS §4.6, Module 32
 * Clean thin router delegating to parentController / parentService.
 */
import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { parentController } from "../controllers/parent.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const parent = requireRoles([SystemRole.PARENT]);

router.get("/ward", authenticate, parent, parentController.getWard);
router.get("/attendance", authenticate, parent, parentController.getAttendance);
router.get("/results", authenticate, parent, parentController.getResults);
router.get("/fees", authenticate, parent, parentController.getFees);
router.get("/notices", authenticate, parent, parentController.getNotices);
router.post(
  "/messages",
  authenticate,
  parent,
  [
    body("recipientId").optional().isMongoId(),
    body("conversationId").optional().isMongoId(),
    body("content").isString().trim().isLength({ min: 1, max: 4000 }),
  ],
  validate,
  parentController.sendMessage,
);
router.get("/messages", authenticate, parent, parentController.getConversations);

// ── Fee Payment ────────────────────────────────────────────────────────────────

router.post(
  "/fees/pay",
  authenticate,
  parent,
  [
    body("feeRecordId").isMongoId().withMessage("feeRecordId must be a valid ID"),
    body("amountPaid").isFloat({ gt: 0 }).withMessage("amountPaid must be a positive number"),
    body("paymentMode")
      .isIn(["upi", "neft", "rtgs", "imps", "net_banking", "card", "online_portal"])
      .withMessage("Use an accepted online payment mode"),
  ],
  validate,
  parentController.initiatePayment,
);

router.get("/fees/history", authenticate, parent, parentController.getPaymentHistory);

export default router;
