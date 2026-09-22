/**
 * NAAC & NBA Routes (M34 + M35)
 * NAAC: criteria evidence management, scoring, SSR-ready summaries
 * NBA:  CO-PO attainment reports, approval workflow
 */
import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { naacNbaController } from "../controllers/naac-nba.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, IQAC_TEAM, IQAC_NAAC } =
  SystemRole;

const reviewer = requireRoles([SUPER_ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM]);
const iqacWrite = requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, IQAC_NAAC, IQAC_TEAM, HOD]);
const allStaff = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  DEAN_ACADEMIC,
  HOD,
  FACULTY,
  IQAC_NAAC,
  IQAC_TEAM,
]);
const listValidators = [
  query("academicYear").matches(/^\d{4}-\d{2}$/),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];
const evidenceBody = [
  body("criterion").isIn(["1", "2", "3", "4", "5", "6", "7"]),
  body("metricNo").matches(/^[1-7](?:\.\d+){1,3}$/),
  body("title").isString().trim().isLength({ min: 3, max: 300 }),
  body("description").optional().isString().trim().isLength({ max: 5000 }),
  body("academicYear").matches(/^\d{4}-\d{2}$/),
  body("evidenceFiles").isArray({ max: 50 }),
  body("evidenceFiles.*.url").isURL({ protocols: ["https"], require_protocol: true }),
  body("evidenceFiles.*.name").isString().trim().isLength({ min: 1, max: 255 }),
];
const reportBody = [
  body("programId").isMongoId(),
  body("program").isString().trim().isLength({ min: 1, max: 200 }),
  body("departmentId").isMongoId(),
  body("academicYear").matches(/^\d{4}-\d{2}$/),
  body("semester").isInt({ min: 1, max: 10 }).toInt(),
  body("coAttainments").isArray({ min: 1, max: 100 }),
  body("poAttainments").isArray({ min: 1, max: 50 }),
];

// ── NAAC Evidence (M34) ───────────────────────────────────────────────────────
router.get(
  "/naac/evidence",
  authenticate,
  allStaff,
  listValidators,
  validate,
  naacNbaController.listEvidence,
);
router.get(
  "/naac/evidence/summary",
  authenticate,
  iqacWrite,
  [query("academicYear").matches(/^\d{4}-\d{2}$/)],
  validate,
  naacNbaController.criterionSummary,
);
router.get(
  "/naac/evidence/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  allStaff,
  naacNbaController.getEvidence,
);
router.post(
  "/naac/evidence",
  authenticate,
  allStaff,
  evidenceBody,
  validate,
  naacNbaController.createEvidence,
);
router.put(
  "/naac/evidence/:id",
  authenticate,
  allStaff,
  [param("id").isMongoId().withMessage("Invalid ID"), ...evidenceBody],
  validate,
  naacNbaController.updateEvidence,
);
router.post(
  "/naac/evidence/:id/submit",
  authenticate,
  allStaff,
  [param("id").isMongoId()],
  validate,
  naacNbaController.submitEvidence,
);
router.put(
  "/naac/evidence/:id/review",
  authenticate,
  reviewer,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("status").isIn(["approved", "revision_requested"]),
    body("reviewNotes").isString().trim().isLength({ min: 5, max: 2000 }),
    body("score").if(body("status").equals("approved")).isFloat({ min: 0, max: 4 }).toFloat(),
  ],
  validate,
  naacNbaController.reviewEvidence,
);

// ── NBA Reports (M35) ─────────────────────────────────────────────────────────
router.get(
  "/nba/reports",
  authenticate,
  allStaff,
  [
    ...listValidators,
    query("departmentId").optional().isMongoId(),
    query("status").optional().isIn(["draft", "approved"]),
  ],
  validate,
  naacNbaController.listReports,
);
router.get(
  "/nba/reports/po-summary",
  authenticate,
  iqacWrite,
  [query("departmentId").isMongoId(), query("academicYear").matches(/^\d{4}-\d{2}$/)],
  validate,
  naacNbaController.poDepartmentSummary,
);
router.get(
  "/nba/reports/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  allStaff,
  naacNbaController.getReport,
);
router.post(
  "/nba/reports",
  authenticate,
  iqacWrite,
  reportBody,
  validate,
  naacNbaController.createReport,
);
router.put(
  "/nba/reports/:id",
  authenticate,
  iqacWrite,
  [param("id").isMongoId().withMessage("Invalid ID"), ...reportBody],
  validate,
  naacNbaController.updateReport,
);
router.post(
  "/nba/reports/:id/approve",
  authenticate,
  reviewer,
  [param("id").isMongoId(), body("comments").optional().trim().isLength({ max: 2000 })],
  validate,
  naacNbaController.approveReport,
);

export default router;
