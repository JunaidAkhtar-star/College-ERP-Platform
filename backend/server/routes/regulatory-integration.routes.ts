import { Router } from "express";
import { body, param } from "express-validator";
import { Module, PermissionAction } from "../constants/permissions";
import { SystemRole } from "../constants/roles";
import { regulatoryIntegrationController } from "../controllers/regulatory-integration.controller";
import { authenticate, requirePermission, requireRoles, validate } from "../middlewares";

const router = Router();
const providers = ["digilocker", "nad", "abc", "aishe", "nirf"];
const statuses = [
  "not_started",
  "documents_pending",
  "submitted",
  "approved",
  "configured",
  "suspended",
];
const connectionAdministrators = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]);

router.get(
  "/overview",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.VIEW),
  regulatoryIntegrationController.overview,
);
router.get(
  "/submissions",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.VIEW),
  regulatoryIntegrationController.listSubmissions,
);
router.get(
  "/connections",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.VIEW),
  regulatoryIntegrationController.listConnections,
);
router.get(
  "/:provider/operations",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.VIEW),
  [param("provider").isIn(providers)],
  validate,
  regulatoryIntegrationController.operational,
);
router.post(
  "/:provider/submissions",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.CREATE),
  [param("provider").isIn(providers), body("academicYear").matches(/^\d{4}-\d{2}$/)],
  validate,
  regulatoryIntegrationController.createSubmission,
);
router.put(
  "/:provider/connection",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  connectionAdministrators,
  [
    param("provider").isIn(providers),
    body("mode").isIn(["portal_export", "api"]),
    body("enabled").isBoolean(),
    body("apiBaseUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("clientId").optional({ checkFalsy: true }).trim().isLength({ max: 240 }),
    body("credential").optional({ checkFalsy: true }).isString().isLength({ max: 4000 }),
  ],
  validate,
  regulatoryIntegrationController.saveConnection,
);
router.post(
  "/:provider/connection/test",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  connectionAdministrators,
  [param("provider").isIn(providers)],
  validate,
  regulatoryIntegrationController.testConnection,
);
router.post(
  "/submissions/:batchId/request-review",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [param("batchId").isMongoId(), body("note").trim().isLength({ min: 3, max: 1000 })],
  validate,
  regulatoryIntegrationController.requestSubmissionReview,
);
router.post(
  "/submissions/:batchId/decision",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.APPROVE),
  [
    param("batchId").isMongoId(),
    body("decision").isIn(["approved", "rejected"]),
    body("note").trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  regulatoryIntegrationController.decideSubmission,
);
router.post(
  "/submissions/:batchId/exported",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [param("batchId").isMongoId()],
  validate,
  regulatoryIntegrationController.markSubmissionExported,
);
router.post(
  "/submissions/:batchId/submitted",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [
    param("batchId").isMongoId(),
    body("acknowledgementReference").trim().isLength({ min: 2, max: 240 }),
  ],
  validate,
  regulatoryIntegrationController.markSubmissionSubmitted,
);
router.post(
  "/submissions/:batchId/reconcile",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [
    param("batchId").isMongoId(),
    body("acceptedRecords").isInt({ min: 0 }),
    body("rejectedRecords").isInt({ min: 0 }),
    body("note").trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  regulatoryIntegrationController.reconcileSubmission,
);
router.put(
  "/:provider",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [
    param("provider").isIn(providers),
    body("status").isIn(statuses),
    body("institutionCode").optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
    body("nodalOfficerName").optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
    body("nodalOfficerEmail").optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body("applicationReference").optional({ checkFalsy: true }).trim().isLength({ max: 180 }),
    body("notes").optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
    body("checklist").isArray({ max: 20 }),
    body("checklist.*").isString().trim().isLength({ min: 1, max: 80 }),
    body("consentConfirmed").isBoolean(),
    body("reason").optional({ checkFalsy: true }).trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  regulatoryIntegrationController.update,
);

router.post(
  "/:provider/request-approval",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [param("provider").isIn(providers), body("reason").trim().isLength({ min: 3, max: 500 })],
  validate,
  regulatoryIntegrationController.requestApproval,
);

router.post(
  "/:provider/approval",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.APPROVE),
  [
    param("provider").isIn(providers),
    body("decision").isIn(["approved", "rejected"]),
    body("note").trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  regulatoryIntegrationController.decideApproval,
);

router.post(
  "/:provider/evidence",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [param("provider").isIn(providers)],
  validate,
  regulatoryIntegrationController.uploadEvidence,
);

router.delete(
  "/:provider/evidence/:evidenceId",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [param("provider").isIn(providers), param("evidenceId").isMongoId()],
  validate,
  regulatoryIntegrationController.removeEvidence,
);

router.post(
  "/:provider/cycles",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.CREATE),
  [
    param("provider").isIn(providers),
    body("name").trim().isLength({ min: 2, max: 120 }),
    body("reportingYear").trim().isLength({ min: 4, max: 20 }),
    body("dueDate").optional({ checkFalsy: true }).isISO8601(),
    body("notes").optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  ],
  validate,
  regulatoryIntegrationController.addCycle,
);

router.patch(
  "/:provider/cycles/:cycleId",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.EDIT),
  [
    param("provider").isIn(providers),
    param("cycleId").isMongoId(),
    body("status").isIn(["draft", "in_review", "submitted", "acknowledged", "closed"]),
    body("acknowledgementReference").optional({ checkFalsy: true }).trim().isLength({ max: 180 }),
    body("notes").optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  ],
  validate,
  regulatoryIntegrationController.updateCycle,
);

router.delete(
  "/:provider/cycles/:cycleId",
  authenticate,
  requirePermission(Module.REGULATORY_INTEGRATION, PermissionAction.DELETE),
  [param("provider").isIn(providers), param("cycleId").isMongoId()],
  validate,
  regulatoryIntegrationController.deleteCycle,
);

export default router;
