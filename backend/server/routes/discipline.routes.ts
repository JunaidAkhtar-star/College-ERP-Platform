import { Router } from "express";
import { body, param, query } from "express-validator";
import { SystemRole } from "../constants/roles";
import { disciplineController } from "../controllers/discipline.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const managers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.ADMINISTRATION_OFFICE,
]);
router.use(authenticate);
router.get("/metadata", disciplineController.metadata);
router.get(
  "/people",
  [query("q").isString().isLength({ min: 2, max: 100 })],
  validate,
  disciplineController.people,
);
router.post(
  "/categories",
  managers,
  [
    body("name").isLength({ min: 2, max: 120 }),
    body("code").isLength({ min: 2, max: 30 }),
    body("defaultSeverity").isIn(["minor", "moderate", "major", "critical"]),
  ],
  validate,
  disciplineController.createCategory,
);
router.get("/", disciplineController.list);
router.post(
  "/",
  [
    body("title").isLength({ min: 3, max: 200 }),
    body("description").isLength({ min: 10, max: 10000 }),
    body("categoryId").isMongoId(),
    body("occurredAt").isISO8601(),
    body("accusedUserIds").isArray({ min: 1, max: 50 }),
  ],
  validate,
  disciplineController.report,
);
router.get("/:id", [param("id").isMongoId()], validate, disciplineController.get);
router.post(
  "/:id/assign",
  managers,
  [param("id").isMongoId(), body("assigneeId").isMongoId()],
  validate,
  disciplineController.assign,
);
router.post(
  "/:id/transition",
  managers,
  [
    param("id").isMongoId(),
    body("status").isIn([
      "triage",
      "investigation",
      "hearing",
      "decided",
      "appealed",
      "closed",
      "dismissed",
    ]),
    body("note").isLength({ min: 3, max: 10000 }),
  ],
  validate,
  disciplineController.transition,
);
router.post(
  "/:id/events",
  managers,
  [
    param("id").isMongoId(),
    body("type").isIn(["note", "hearing"]),
    body("content").isLength({ min: 3, max: 10000 }),
  ],
  validate,
  disciplineController.addEvent,
);
router.post(
  "/:id/sanctions",
  managers,
  [
    param("id").isMongoId(),
    body("userId").isMongoId(),
    body("type").isIn([
      "warning",
      "community_service",
      "fine",
      "suspension",
      "restriction",
      "rustication",
      "other",
    ]),
    body("description").isLength({ min: 3, max: 3000 }),
    body("startsAt").isISO8601(),
  ],
  validate,
  disciplineController.sanction,
);
router.post(
  "/:id/appeal",
  [param("id").isMongoId(), body("reason").isLength({ min: 10, max: 5000 })],
  validate,
  disciplineController.appeal,
);
export default router;
