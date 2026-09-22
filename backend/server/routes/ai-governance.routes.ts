import { Router } from "express";
import { body, param } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { aiGovernanceController } from "../controllers/ai-governance.controller";
import { authenticate, requirePermission, validate } from "../middlewares";
const router = Router(),
  canView = requirePermission(Module.COMPLIANCE, PermissionAction.VIEW),
  canCreate = requirePermission(Module.COMPLIANCE, PermissionAction.CREATE),
  canEdit = requirePermission(Module.COMPLIANCE, PermissionAction.EDIT),
  canApprove = requirePermission(Module.COMPLIANCE, PermissionAction.APPROVE);
router.use(authenticate);
router.get("/dashboard", canView, aiGovernanceController.dashboard);
router.get("/use-cases", canView, aiGovernanceController.useCases);
router.get(
  "/use-cases/:id",
  canView,
  [param("id").isMongoId()],
  validate,
  aiGovernanceController.useCaseDetail,
);
router.post(
  "/use-cases",
  canCreate,
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("purpose").trim().isLength({ min: 10, max: 3000 }),
    body("ownerId").isMongoId(),
    body("provider").trim().isLength({ min: 2, max: 100 }),
    body("modelName").trim().isLength({ min: 1, max: 160 }),
    body("dataCategories").isArray({ min: 1, max: 50 }),
    body("decisionImpact").isIn(["assistive", "recommendation", "high_impact"]),
    body("humanReviewRequired").isBoolean(),
  ],
  validate,
  aiGovernanceController.createUseCase,
);
router.get("/assessments", canView, aiGovernanceController.assessments);
router.post(
  "/assessments",
  canEdit,
  [
    body("useCaseId").isMongoId(),
    ...["privacyRisk", "biasRisk", "securityRisk", "explainabilityRisk", "impactRisk"].map((key) =>
      body(key).isInt({ min: 1, max: 5 }),
    ),
    body("mitigations").isArray({ min: 1, max: 100 }),
    body("mitigations.*").trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  aiGovernanceController.assess,
);
router.post(
  "/use-cases/:id/decision",
  canApprove,
  [
    param("id").isMongoId(),
    body("decision").isIn(["approve", "suspend"]),
    body("reviewDueAt").optional({ checkFalsy: true }).isISO8601(),
  ],
  validate,
  aiGovernanceController.approve,
);
router.get("/incidents", canView, aiGovernanceController.incidents);
router.post(
  "/incidents",
  canCreate,
  [
    body("useCaseId").isMongoId(),
    body("severity").isIn(["low", "medium", "high", "critical"]),
    body("summary").trim().isLength({ min: 3, max: 300 }),
    body("description").trim().isLength({ min: 10, max: 5000 }),
    body("ownerId").isMongoId(),
  ],
  validate,
  aiGovernanceController.report,
);
router.patch(
  "/incidents/:id",
  canEdit,
  [
    param("id").isMongoId(),
    body("status").isIn(["investigating", "contained", "resolved"]),
    body("resolution").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  aiGovernanceController.transition,
);
export default router;
