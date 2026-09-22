import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { platformCustomerOperationsController } from "../controllers/platform-customer-operations.controller";
import { authenticate, requireRoles, validate } from "../middlewares";
const router = Router();
router.use(authenticate, requireRoles([SystemRole.SUPER_ADMIN]));
router.get("/dashboard", platformCustomerOperationsController.dashboard);
router.get("/owners", platformCustomerOperationsController.owners);
router.get("/projects", platformCustomerOperationsController.projects);
router.post(
  "/projects",
  [
    body("tenantId").isMongoId(),
    body("ownerId").isMongoId(),
    body("stage").isIn([
      "discovery",
      "configuration",
      "migration",
      "training",
      "go_live",
      "stabilization",
      "completed",
      "on_hold",
    ]),
    body("targetGoLiveAt").isISO8601(),
    body("milestones").isArray({ min: 1, max: 100 }),
    body("milestones.*.name").trim().isLength({ min: 2, max: 200 }),
    body("milestones.*.category").trim().isLength({ min: 2, max: 100 }),
    body("milestones.*.dueAt").isISO8601(),
  ],
  validate,
  platformCustomerOperationsController.createProject,
);
router.patch(
  "/projects/:id/milestones/:milestoneId",
  [
    param("id").isMongoId(),
    param("milestoneId").isMongoId(),
    body("status").isIn(["pending", "in_progress", "completed", "blocked"]),
    body("note").optional().trim().isLength({ max: 2000 }),
  ],
  validate,
  platformCustomerOperationsController.milestone,
);
router.patch(
  "/projects/:id/stage",
  [
    param("id").isMongoId(),
    body("stage").isIn([
      "discovery",
      "configuration",
      "migration",
      "training",
      "go_live",
      "stabilization",
      "completed",
      "on_hold",
    ]),
  ],
  validate,
  platformCustomerOperationsController.projectStage,
);
router.post(
  "/projects/:id/risks",
  [
    param("id").isMongoId(),
    body("summary").trim().isLength({ min: 5, max: 1000 }),
    body("severity").isIn(["low", "medium", "high"]),
    body("mitigation").trim().isLength({ min: 5, max: 2000 }),
    body("ownerId").isMongoId(),
  ],
  validate,
  platformCustomerOperationsController.addRisk,
);
router.patch(
  "/projects/:id/risks/:riskId/mitigate",
  [param("id").isMongoId(), param("riskId").isMongoId()],
  validate,
  platformCustomerOperationsController.mitigateRisk,
);
router.get("/tickets", platformCustomerOperationsController.tickets);
router.post(
  "/tickets",
  [
    body("tenantId").isMongoId(),
    body("category").isIn([
      "incident",
      "question",
      "configuration",
      "data",
      "billing",
      "security",
      "feature_request",
    ]),
    body("priority").isIn(["low", "medium", "high", "critical"]),
    body("subject").trim().isLength({ min: 3, max: 300 }),
    body("description").trim().isLength({ min: 10, max: 5000 }),
    body("requesterName").trim().isLength({ min: 2, max: 160 }),
    body("requesterEmail").isEmail(),
  ],
  validate,
  platformCustomerOperationsController.createTicket,
);
router.patch(
  "/tickets/:id",
  [
    param("id").isMongoId(),
    body("status").isIn(["triaged", "in_progress", "waiting_customer", "resolved", "closed"]),
    body("ownerId").optional({ checkFalsy: true }).isMongoId(),
    body("resolution").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  platformCustomerOperationsController.transition,
);
router.post(
  "/tickets/:id/comments",
  [
    param("id").isMongoId(),
    body("body").trim().isLength({ min: 2, max: 5000 }),
    body("visibility").isIn(["internal", "customer"]),
  ],
  validate,
  platformCustomerOperationsController.comment,
);
export default router;
