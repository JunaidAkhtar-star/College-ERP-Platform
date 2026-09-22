import { Router } from "express";
import { body, param, query } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { alumniController } from "../controllers";
import { authenticate, requirePermission, validate } from "../middlewares";

const router = Router();
const alumniView = requirePermission(Module.ALUMNI, PermissionAction.VIEW);
const alumniCreate = requirePermission(Module.ALUMNI, PermissionAction.CREATE);
const alumniEdit = requirePermission(Module.ALUMNI, PermissionAction.EDIT);
const alumniApprove = requirePermission(Module.ALUMNI, PermissionAction.APPROVE);

router.get("/stats", authenticate, alumniView, alumniController.stats);
router.get(
  "/engagements",
  authenticate,
  alumniView,
  [query("status").optional().isIn(["planned", "completed", "cancelled"])],
  validate,
  alumniController.listEngagements,
);
router.post(
  "/engagements",
  authenticate,
  alumniCreate,
  [
    body("type").isIn(["reunion", "mentorship", "guest_talk", "referral", "networking", "other"]),
    body("title").trim().isLength({ min: 3, max: 200 }),
    body("description").trim().isLength({ min: 10, max: 5000 }),
    body("scheduledAt").isISO8601(),
    body("alumniIds").isArray({ min: 1 }),
    body("capacity").optional().isInt({ min: 1 }),
  ],
  validate,
  alumniController.createEngagement,
);
router.put(
  "/engagements/:id/close",
  authenticate,
  alumniEdit,
  [
    param("id").isMongoId(),
    body("status").isIn(["completed", "cancelled"]),
    body("outcome").trim().isLength({ min: 5, max: 5000 }),
  ],
  validate,
  alumniController.closeEngagement,
);

router.get(
  "/graduation-candidates",
  authenticate,
  alumniApprove,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  alumniController.graduationCandidates,
);

router.post(
  "/students/:studentProfileId/graduate",
  authenticate,
  alumniApprove,
  [param("studentProfileId").isMongoId()],
  validate,
  alumniController.graduateStudent,
);

router.post(
  "/donations",
  authenticate,
  alumniCreate,
  [
    body("alumniId").isMongoId(),
    body("amount").isFloat({ gt: 0 }),
    body("currency").optional().equals("INR"),
    body("purpose").trim().isLength({ min: 2, max: 200 }),
    body("paymentMethod").isIn(["online", "cheque", "dd", "cash"]),
    body("transactionId").optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body("notes").optional().trim().isLength({ max: 2000 }),
  ],
  validate,
  alumniController.createDonation,
);
router.get("/donations/stats", authenticate, alumniView, alumniController.donationStats);
router.get(
  "/donations",
  authenticate,
  alumniView,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  alumniController.listDonations,
);
router.put(
  "/donations/:id/confirm",
  authenticate,
  alumniApprove,
  [param("id").isMongoId()],
  validate,
  alumniController.confirmDonation,
);
router.put(
  "/donations/:id/fail",
  authenticate,
  alumniApprove,
  [param("id").isMongoId(), body("reason").trim().isLength({ min: 5, max: 1000 })],
  validate,
  alumniController.failDonation,
);

router.get(
  "/",
  authenticate,
  alumniView,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  alumniController.list,
);
router.get(
  "/:id",
  authenticate,
  alumniView,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  alumniController.getById,
);
router.put(
  "/:id",
  authenticate,
  alumniEdit,
  [param("id").isMongoId()],
  validate,
  alumniController.update,
);
router.put(
  "/:id/verify",
  authenticate,
  alumniApprove,
  [param("id").isMongoId()],
  validate,
  alumniController.verify,
);
router.put(
  "/:id/career/verify",
  authenticate,
  alumniApprove,
  [param("id").isMongoId()],
  validate,
  alumniController.verifyCareerOutcome,
);

export default router;
