import { Router } from "express";
import { body, param, query } from "express-validator";
import { ADMISSION_ROLES } from "../constants/roles";
import { recruitmentCrmController } from "../controllers/recruitment-crm.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const access = requireRoles(ADMISSION_ROLES);
const stages = [
  "new",
  "contacted",
  "qualified",
  "application_started",
  "applied",
  "enrolled",
  "lost",
];
const sources = ["website", "walk_in", "referral", "campaign", "school_visit", "other"];
router.use(authenticate, access);
router.get("/dashboard", recruitmentCrmController.dashboard);
router.get(
  "/",
  [
    query("stage").optional().isIn(stages),
    query("source").optional().isIn(sources),
    query("ownerId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().trim().isLength({ max: 120 }),
    query("overdue").optional().isBoolean(),
  ],
  validate,
  recruitmentCrmController.list,
);
router.post(
  "/",
  [
    body("firstName").trim().isLength({ min: 1, max: 120 }),
    body("lastName").optional().trim().isLength({ max: 120 }),
    body("phone").trim().isLength({ min: 7, max: 24 }),
    body("email").optional({ checkFalsy: true }).isEmail(),
    body("source").isIn(sources),
    body("programInterest").optional().isMongoId(),
    body("ownerId").optional().isMongoId(),
    body("nextFollowUpAt").optional().isISO8601(),
    body("consentToContact").isBoolean(),
    body("notes").optional().trim().isLength({ max: 5000 }),
    body("tags").optional().isArray({ max: 20 }),
  ],
  validate,
  recruitmentCrmController.create,
);
router.patch(
  "/:id",
  [
    param("id").isMongoId(),
    body("stage").optional().isIn(stages),
    body("ownerId").optional().isMongoId(),
    body("programInterest").optional().isMongoId(),
    body("nextFollowUpAt").optional().isISO8601(),
    body("lostReason").optional().trim().isLength({ max: 1000 }),
    body("notes").optional().trim().isLength({ max: 5000 }),
    body("consentToContact").optional().isBoolean(),
  ],
  validate,
  recruitmentCrmController.update,
);
router.get(
  "/:id/activities",
  [param("id").isMongoId()],
  validate,
  recruitmentCrmController.activities,
);
router.post(
  "/:id/activities",
  [
    param("id").isMongoId(),
    body("type").isIn(["call", "email", "message", "meeting", "note", "task"]),
    body("subject").trim().isLength({ min: 2, max: 240 }),
    body("details").optional().trim().isLength({ max: 5000 }),
    body("status").optional().isIn(["planned", "completed", "cancelled"]),
    body("dueAt").optional().isISO8601(),
    body("ownerId").optional().isMongoId(),
  ],
  validate,
  recruitmentCrmController.addActivity,
);
router.patch(
  "/activities/:id/complete",
  [param("id").isMongoId()],
  validate,
  recruitmentCrmController.completeActivity,
);
export default router;
