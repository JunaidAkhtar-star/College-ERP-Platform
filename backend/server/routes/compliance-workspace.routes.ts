import { Router } from "express";
import { body, param, query } from "express-validator";
import { complianceWorkspaceController } from "../controllers/compliance-workspace.controller";
import { authenticate, validate } from "../middlewares";
import { requirePermission } from "../middlewares";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const readers = requirePermission(Module.COMPLIANCE, PermissionAction.VIEW);
const editors = requirePermission(Module.COMPLIANCE, PermissionAction.EDIT);
const contributors = requirePermission(Module.COMPLIANCE, PermissionAction.CREATE);
const reviewers = requirePermission(Module.COMPLIANCE, PermissionAction.APPROVE);
const tallyEditors = requirePermission(Module.COMPLIANCE, PermissionAction.EXPORT);
const academicYearQuery = () =>
  query("academicYear")
    .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
    .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format");
const submissionBody = [
  body("requirementId").isMongoId(),
  body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  body("period").optional().isString().trim().isLength({ max: 100 }),
  body("departmentId").optional({ nullable: true }).isMongoId(),
  body("status").isIn(["in_progress", "submitted"]),
  body("values").isObject(),
  body("evidenceFiles").optional().isArray({ max: 50 }),
  body("evidenceFiles.*.url").optional().isURL(),
  body("evidenceFiles.*.name").optional().isString().trim().isLength({ min: 1, max: 255 }),
  body("remarks").optional().isString().trim().isLength({ max: 1000 }),
  body("evidenceValidUntil").optional({ nullable: true }).isISO8601(),
];
const setupProfileBody = [
  body("country").isString().trim().isLength({ min: 2, max: 100 }),
  body("region").optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body("institutionType").isIn([
    "university",
    "deemed_university",
    "autonomous_college",
    "affiliated_college",
    "standalone_institution",
    "other",
  ]),
  body("universityType")
    .optional({ nullable: true })
    .isIn(["central", "state", "private", "deemed", "open", "not_applicable"]),
  body("affiliatingUniversity")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 255 }),
  body("isAutonomous").isBoolean(),
  body("programmeDomains").isArray({ max: 50 }),
  body("programmeDomains.*").isString().trim().isLength({ min: 2, max: 100 }),
];

router.get(
  "/accreditation/setup",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.VIEW),
  complianceWorkspaceController.accreditationSetup,
);
router.put(
  "/accreditation/setup",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.EDIT),
  setupProfileBody,
  validate,
  complianceWorkspaceController.saveAccreditationProfile,
);
router.get(
  "/accreditation/recommendations",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.VIEW),
  complianceWorkspaceController.accreditationRecommendations,
);
router.get(
  "/accreditation/readiness",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.VIEW),
  [academicYearQuery()],
  validate,
  complianceWorkspaceController.accreditationReadiness,
);
router.post(
  "/accreditation/scopes",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.CREATE),
  [
    body("frameworkSlug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    body("frameworkVersion").isString().trim().isLength({ min: 1, max: 100 }),
    body("authority").optional().isString().trim().isLength({ max: 255 }),
    body("scopeType").isIn(["institution", "campus", "programme"]),
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("cycleType").isIn(["first", "subsequent", "renewal", "continuous"]),
    body("campusIds").optional().isArray({ max: 100 }),
    body("campusIds.*").isMongoId(),
    body("departmentIds").optional().isArray({ max: 100 }),
    body("departmentIds.*").isMongoId(),
    body("programIds").optional().isArray({ max: 100 }),
    body("programIds.*").isMongoId(),
    body("ownerIds").isArray({ min: 1, max: 100 }),
    body("ownerIds.*").isMongoId(),
    body("reviewerIds").isArray({ min: 1, max: 100 }),
    body("reviewerIds.*").isMongoId(),
    body("officialSourceUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("officialSourceChecksum")
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 32, max: 128 }),
    body("submissionDueAt").optional({ nullable: true }).isISO8601(),
  ],
  validate,
  complianceWorkspaceController.addAccreditationScope,
);
router.post(
  "/accreditation/scopes/:scopeId/request-activation",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.EDIT),
  [param("scopeId").isMongoId()],
  validate,
  complianceWorkspaceController.requestAccreditationActivation,
);
router.post(
  "/accreditation/scopes/:scopeId/decision",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.APPROVE),
  [
    param("scopeId").isMongoId(),
    body("approved").isBoolean(),
    body("note").isString().trim().isLength({ min: 5, max: 2000 }),
  ],
  validate,
  complianceWorkspaceController.decideAccreditationActivation,
);
router.patch(
  "/accreditation/scopes/:scopeId/trust",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.APPROVE),
  [
    param("scopeId").isMongoId(),
    body("state").isIn([
      "platform_verified",
      "official_template_mapped",
      "submitted",
      "provider_acknowledged",
    ]),
    body("evidenceReference").isString().trim().isLength({ min: 3, max: 500 }),
    body("evidenceSource").isIn(["official_document", "verified_portal_evidence", "verified_api"]),
    body("note").isString().trim().isLength({ min: 5, max: 2000 }),
  ],
  validate,
  complianceWorkspaceController.advanceAccreditationTrust,
);
router.get(
  "/accreditation/snapshots",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.VIEW),
  complianceWorkspaceController.accreditationSnapshots,
);
router.post(
  "/accreditation/scopes/:scopeId/snapshots",
  authenticate,
  requirePermission(Module.COMPLIANCE, PermissionAction.EXPORT),
  [param("scopeId").isMongoId()],
  validate,
  complianceWorkspaceController.createAccreditationSnapshot,
);

router.get("/catalog", authenticate, complianceWorkspaceController.catalog);
router.post(
  "/catalog/:key/activate",
  authenticate,
  [param("key").matches(/^[a-z0-9-]+$/)],
  validate,
  complianceWorkspaceController.activateCatalogFramework,
);

router.get(
  "/dashboard",
  authenticate,
  [academicYearQuery()],
  validate,
  complianceWorkspaceController.dashboard,
);
router.get(
  "/audit-package",
  authenticate,
  [
    academicYearQuery(),
    query("framework")
      .optional()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ],
  validate,
  complianceWorkspaceController.auditManifest,
);
router.get(
  "/frameworks",
  authenticate,
  [query("includeInactive").optional().isBoolean()],
  validate,
  complianceWorkspaceController.frameworks,
);
router.post(
  "/frameworks",
  [
    body("name").trim().notEmpty(),
    body("shortName").trim().notEmpty(),
    body("country").trim().notEmpty(),
  ],
  validate,
  authenticate,
  complianceWorkspaceController.createFramework,
);
router.put(
  "/frameworks/:id",
  [param("id").isMongoId()],
  validate,
  authenticate,
  complianceWorkspaceController.updateFramework,
);
router.get(
  "/requirements",
  authenticate,
  [
    query("framework")
      .optional()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    query("active").optional().isBoolean(),
    query("search").optional().isString().trim().isLength({ max: 100 }),
  ],
  validate,
  complianceWorkspaceController.requirements,
);
router.post(
  "/requirements",
  [
    body("framework")
      .trim()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    body("code").trim().notEmpty(),
    body("title").trim().notEmpty(),
    body("category").trim().notEmpty(),
    body("departmentIds").optional().isArray({ max: 100 }),
    body("departmentIds.*").isMongoId(),
    body("ownerIds").optional().isArray({ max: 100 }),
    body("ownerIds.*").isMongoId(),
    body("reviewerIds").optional().isArray({ max: 100 }),
    body("reviewerIds.*").isMongoId(),
    body("dueMonth").optional({ nullable: true }).isInt({ min: 1, max: 12 }),
    body("evidenceValidityDays").optional({ nullable: true }).isInt({ min: 1, max: 3650 }),
  ],
  validate,
  authenticate,
  complianceWorkspaceController.createRequirement,
);
router.put(
  "/requirements/:id",
  [
    param("id").isMongoId(),
    body("departmentIds").optional().isArray({ max: 100 }),
    body("departmentIds.*").isMongoId(),
    body("ownerIds").optional().isArray({ max: 100 }),
    body("ownerIds.*").isMongoId(),
    body("reviewerIds").optional().isArray({ max: 100 }),
    body("reviewerIds.*").isMongoId(),
    body("dueMonth").optional({ nullable: true }).isInt({ min: 1, max: 12 }),
    body("evidenceValidityDays").optional({ nullable: true }).isInt({ min: 1, max: 3650 }),
  ],
  validate,
  authenticate,
  complianceWorkspaceController.updateRequirement,
);
router.get(
  "/submissions",
  authenticate,
  readers,
  [
    academicYearQuery(),
    query("framework")
      .optional()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    query("status")
      .optional()
      .isIn(["not_started", "in_progress", "submitted", "approved", "non_compliant"]),
    query("requirementId").optional().isMongoId(),
  ],
  validate,
  complianceWorkspaceController.submissions,
);
router.post(
  "/submissions",
  authenticate,
  contributors,
  submissionBody,
  validate,
  complianceWorkspaceController.createSubmission,
);
router.put(
  "/submissions/:id",
  authenticate,
  editors,
  [param("id").isMongoId(), ...submissionBody],
  validate,
  complianceWorkspaceController.updateSubmission,
);
router.patch(
  "/submissions/:id/review",
  authenticate,
  reviewers,
  [
    param("id").isMongoId(),
    body("status").isIn(["approved", "non_compliant"]),
    body("remarks")
      .if(body("status").equals("non_compliant"))
      .isString()
      .trim()
      .isLength({ min: 5, max: 1000 }),
  ],
  validate,
  complianceWorkspaceController.reviewSubmission,
);
router.get(
  "/findings",
  authenticate,
  readers,
  [
    query("academicYear")
      .optional()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/),
  ],
  validate,
  complianceWorkspaceController.findings,
);
router.post(
  "/findings",
  authenticate,
  reviewers,
  body("submissionId").isMongoId(),
  body("title").isString().trim().isLength({ min: 3, max: 255 }),
  body("description").isString().trim().isLength({ min: 10, max: 5000 }),
  body("severity").isIn(["low", "medium", "high", "critical"]),
  body("ownerId").isMongoId(),
  body("dueAt").isISO8601(),
  validate,
  complianceWorkspaceController.createFinding,
);
router.patch(
  "/findings/:id/remediation",
  authenticate,
  contributors,
  [
    param("id").isMongoId(),
    body("remediationPlan").isString().trim().isLength({ min: 10, max: 5000 }),
    body("evidenceFiles").isArray({ min: 1, max: 50 }),
    body("evidenceFiles.*.url").isURL(),
    body("evidenceFiles.*.name").isString().trim().isLength({ min: 1, max: 255 }),
  ],
  validate,
  complianceWorkspaceController.submitFindingRemediation,
);
router.patch(
  "/findings/:id/verify",
  authenticate,
  reviewers,
  [
    param("id").isMongoId(),
    body("accepted").isBoolean(),
    body("closureNote").isString().trim().isLength({ min: 10, max: 2000 }),
  ],
  validate,
  complianceWorkspaceController.verifyFinding,
);
router.get("/tally/config", authenticate, readers, complianceWorkspaceController.tallyConfig);
router.put(
  "/tally/config",
  authenticate,
  tallyEditors,
  [
    body("companyName").isString().trim().isLength({ min: 1, max: 255 }),
    body("companyGuid").optional({ checkFalsy: true }).isString().trim().isLength({ max: 255 }),
    body("financialYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("ledgerMappings").isArray({ max: 1000 }),
    body("ledgerMappings.*.accountCode").isString().trim().isLength({ min: 1, max: 100 }),
    body("ledgerMappings.*.tallyLedgerName").isString().trim().isLength({ min: 1, max: 255 }),
  ],
  validate,
  complianceWorkspaceController.saveTallyConfig,
);
router.get(
  "/tally/export",
  authenticate,
  tallyEditors,
  [
    query("financialYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
  ],
  validate,
  complianceWorkspaceController.tallyExport,
);
router.post(
  "/tally/export",
  authenticate,
  tallyEditors,
  [
    body("financialYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("from").optional().isISO8601(),
    body("to").optional().isISO8601(),
  ],
  validate,
  complianceWorkspaceController.tallyExportJson,
);

export default router;
