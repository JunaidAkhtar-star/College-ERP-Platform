import { Router } from "express";
import { body, param } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { advancementController } from "../controllers/advancement.controller";
import { authenticate, requirePermission, validate } from "../middlewares";
const router = Router();
const canView = requirePermission(Module.ALUMNI, PermissionAction.VIEW);
const canCreate = requirePermission(Module.ALUMNI, PermissionAction.CREATE);
const canEdit = requirePermission(Module.ALUMNI, PermissionAction.EDIT);
const canApprove = requirePermission(Module.ALUMNI, PermissionAction.APPROVE);
router.use(authenticate, canView);
router.get("/dashboard", advancementController.dashboard);
router.get("/funds", advancementController.funds);
router.post(
  "/funds",
  canCreate,
  [
    body("code").trim().isLength({ min: 2, max: 30 }),
    body("name").trim().isLength({ min: 2, max: 160 }),
    body("purpose").trim().isLength({ min: 5, max: 2000 }),
    body("restriction").isIn(["unrestricted", "temporarily_restricted", "permanently_restricted"]),
    body("goalAmount").optional().isFloat({ min: 0 }),
  ],
  validate,
  advancementController.createFund,
);
router.get("/campaigns", advancementController.campaigns);
router.post(
  "/campaigns",
  canCreate,
  [
    body("code").trim().isLength({ min: 2, max: 30 }),
    body("name").trim().isLength({ min: 2, max: 160 }),
    body("description").trim().isLength({ min: 5, max: 3000 }),
    body("fundId").isMongoId(),
    body("goalAmount").isFloat({ gt: 0 }),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
    body("ownerId").isMongoId(),
  ],
  validate,
  advancementController.createCampaign,
);
router.get("/pledges", advancementController.pledges);
router.post(
  "/pledges",
  canCreate,
  [
    body("alumniId").isMongoId(),
    body("campaignId").isMongoId(),
    body("fundId").isMongoId(),
    body("amount").isFloat({ gt: 0 }),
    body("dueAt").isISO8601(),
  ],
  validate,
  advancementController.createPledge,
);
router.get("/designations", advancementController.designations);
router.post(
  "/designations",
  canApprove,
  [
    body("donationId").isMongoId(),
    body("fundId").isMongoId(),
    body("campaignId").optional({ checkFalsy: true }).isMongoId(),
    body("pledgeId").optional({ checkFalsy: true }).isMongoId(),
    body("amount").isFloat({ gt: 0 }),
  ],
  validate,
  advancementController.designate,
);
router.get("/tasks", advancementController.tasks);
router.post(
  "/tasks",
  canCreate,
  [
    body("alumniId").isMongoId(),
    body("campaignId").optional({ checkFalsy: true }).isMongoId(),
    body("type").isIn(["call", "meeting", "proposal", "thank_you", "impact_report", "other"]),
    body("subject").trim().isLength({ min: 2, max: 300 }),
    body("dueAt").isISO8601(),
    body("assignedTo").isMongoId(),
  ],
  validate,
  advancementController.createTask,
);
router.patch(
  "/tasks/:id/complete",
  canEdit,
  [param("id").isMongoId(), body("outcome").trim().isLength({ min: 3, max: 2000 })],
  validate,
  advancementController.closeTask,
);
export default router;
