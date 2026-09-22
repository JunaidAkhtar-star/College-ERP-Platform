import { Router } from "express";
import { authenticate, requireRoles, validate } from "../middlewares";
import { body, param, query } from "express-validator";
import { iqacController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD, FACULTY } = SystemRole;

const academicYear = query("academicYear").matches(/^\d{4}-\d{2}$/);
const pagination = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];
const feedbackTypes = [
  "student_on_faculty",
  "student_course_exit",
  "faculty_on_curriculum",
  "alumni",
  "employer",
  "parent",
];

// Feedback
router.post(
  "/feedback",
  authenticate,
  [
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("semesterType").isIn(["odd", "even"]),
    body("feedbackType").isIn(feedbackTypes),
    body("targetId").optional().isMongoId(),
    body("ratings").isArray({ min: 1, max: 50 }),
    body("ratings.*.criterion").trim().isLength({ min: 1, max: 200 }),
    body("ratings.*.score").isInt({ min: 1, max: 5 }),
    body("textFeedback").optional().trim().isLength({ max: 5000 }),
    body("isAnonymous").optional().isBoolean(),
  ],
  validate,
  iqacController.submitFeedback,
);
router.get(
  "/feedback/analysis",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD]),
  [
    academicYear,
    query("feedbackType").isIn(feedbackTypes),
    query("targetId").optional().isMongoId(),
  ],
  validate,
  iqacController.getFeedbackAnalysis,
);
router.get(
  "/feedback",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM]),
  [
    academicYear,
    query("feedbackType").optional().isIn(feedbackTypes),
    query("semesterType").optional().isIn(["odd", "even"]),
    ...pagination,
  ],
  validate,
  iqacController.getFeedback,
);

// Audits
router.get(
  "/audits",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD]),
  [
    academicYear,
    query("auditType")
      .optional()
      .isIn(["academic", "administrative", "infrastructure", "documentation"]),
    query("departmentId").optional().isMongoId(),
    query("status").optional().isIn(["scheduled", "ongoing", "completed", "closed"]),
    ...pagination,
  ],
  validate,
  iqacController.listAudits,
);
router.get(
  "/audits/:id",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD]),
  [param("id").isMongoId()],
  validate,
  iqacController.getAuditById,
);
router.post(
  "/audits",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM]),
  [
    body("academicYear").matches(/^\d{4}-\d{2}$/),
    body("auditType").isIn(["academic", "administrative", "infrastructure", "documentation"]),
    body("departmentId").optional().isMongoId(),
    body("auditDate").isISO8601(),
    body("auditedBy").optional().isArray({ max: 50 }),
    body("auditedBy.*").isMongoId(),
    body("findings").optional().isArray({ max: 100 }),
    body("findings.*.criterion").optional().trim().isLength({ min: 1, max: 300 }),
    body("findings.*.observation").optional().trim().isLength({ min: 1, max: 2000 }),
    body("findings.*.status").optional().isIn(["compliant", "partial", "non_compliant"]),
    body("findings.*.remark").optional().trim().isLength({ max: 2000 }),
    body("actionPlan").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  iqacController.createAudit,
);
router.put(
  "/audits/:id",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM]),
  [
    param("id").isMongoId(),
    body("status").optional().isIn(["scheduled", "ongoing", "completed", "closed"]),
    body("findings").optional().isArray({ max: 100 }),
    body("findings.*.criterion").optional().trim().isLength({ min: 1, max: 300 }),
    body("findings.*.observation").optional().trim().isLength({ min: 1, max: 2000 }),
    body("findings.*.status").optional().isIn(["compliant", "partial", "non_compliant"]),
    body("findings.*.remark").optional().trim().isLength({ max: 2000 }),
    body("actionPlan").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  iqacController.updateAudit,
);

// CO-PO Attainment
router.get(
  "/copo",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD, FACULTY]),
  [
    academicYear,
    query("subjectId").isMongoId(),
    query("section").trim().isLength({ min: 1, max: 50 }),
  ],
  validate,
  iqacController.getAttainment,
);
router.get(
  "/copo/po-summary",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD]),
  [academicYear, query("program").trim().isLength({ min: 1, max: 200 })],
  validate,
  iqacController.getPOSummary,
);
router.get(
  "/copo/course-outcomes",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD, FACULTY]),
  [query("subjectId").isMongoId()],
  validate,
  iqacController.getCourseOutcomes,
);
router.post(
  "/copo/:id/action-plans",
  authenticate,
  requireRoles([SUPER_ADMIN, IQAC_NAAC, IQAC_TEAM, HOD, FACULTY]),
  [
    param("id").isMongoId(),
    body("actions").isArray({ max: 20 }),
    body("actions.*.coCode").matches(/^CO(?:[1-9]|1\d|20)$/i),
    body("actions.*.actionPlan").trim().isLength({ min: 10, max: 2000 }),
  ],
  validate,
  iqacController.saveAttainment,
);
router.post(
  "/copo/:id/submit",
  authenticate,
  requireRoles([SUPER_ADMIN, IQAC_NAAC, IQAC_TEAM, HOD]),
  [param("id").isMongoId()],
  validate,
  iqacController.submitAttainment,
);
router.post(
  "/copo/:id/approve",
  authenticate,
  requireRoles([SUPER_ADMIN, PRINCIPAL, IQAC_NAAC]),
  [param("id").isMongoId()],
  validate,
  iqacController.approveAttainment,
);

/** OBE auto-calculation from actual marks data (SRS §4.8 / NBA) */
router.post(
  "/copo/auto-calculate",
  authenticate,
  requireRoles([SUPER_ADMIN, IQAC_NAAC, IQAC_TEAM, HOD]),
  [
    body("sectionId").isMongoId(),
    body("subjectId").isMongoId(),
    body("coMappings").isArray({ min: 1, max: 20 }),
    body("coMappings.*.coCode").matches(/^CO(?:[1-9]|1\d|20)$/i),
    body("coMappings.*.targetPercent").isFloat({ gt: 0, max: 100 }),
    body("coPOMatrix").isObject(),
    body("directWeight").optional().isFloat({ min: 0, max: 100 }),
    body("indirectWeight").optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  iqacController.autoCalculateCOPO,
);

export default router;
