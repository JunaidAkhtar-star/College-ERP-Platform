import { Router } from "express";
import { body, param, query } from "express-validator";
import { SystemRole } from "../constants/roles";
import { studentSuccessController } from "../controllers/student-success.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT } = SystemRole;
const staff = requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY]);
const leaders = requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD]);

router.get("/mine", authenticate, requireRoles([STUDENT]), studentSuccessController.mine);
router.get(
  "/caseload",
  authenticate,
  staff,
  [
    query("riskLevel").optional().isIn(["low", "medium", "high", "critical"]),
    query("departmentId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  studentSuccessController.caseload,
);
router.post(
  "/refresh",
  authenticate,
  leaders,
  [body("departmentId").optional().isMongoId()],
  validate,
  studentSuccessController.refreshDepartment,
);
router.post(
  "/students/:studentProfileId/refresh",
  authenticate,
  staff,
  [param("studentProfileId").isMongoId()],
  validate,
  studentSuccessController.refreshStudent,
);
router.post(
  "/cases",
  authenticate,
  staff,
  [
    body("studentProfileId").isMongoId(),
    body("assignedAdvisorId").isMongoId(),
    body("title").trim().isLength({ min: 5, max: 240 }),
    body("summary").trim().isLength({ min: 10, max: 5000 }),
    body("priority").isIn(["low", "medium", "high", "critical"]),
    body("dueAt").optional().isISO8601(),
  ],
  validate,
  studentSuccessController.openCase,
);
router.patch(
  "/cases/:id/interventions",
  authenticate,
  staff,
  [
    param("id").isMongoId(),
    body("type").isIn([
      "academic",
      "attendance",
      "financial",
      "wellbeing",
      "career",
      "parent_outreach",
    ]),
    body("action").trim().isLength({ min: 10, max: 3000 }),
    body("outcome").optional().trim().isLength({ min: 5, max: 3000 }),
    body("nextFollowUpAt").optional().isISO8601(),
    body("status").optional().isIn(["contacted", "in_progress", "monitoring"]),
  ],
  validate,
  studentSuccessController.addIntervention,
);
router.patch(
  "/cases/:id/resolve",
  authenticate,
  staff,
  [param("id").isMongoId(), body("resolution").trim().isLength({ min: 10, max: 5000 })],
  validate,
  studentSuccessController.resolveCase,
);

export default router;
