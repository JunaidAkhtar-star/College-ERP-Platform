import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { communicationHubController } from "../controllers/communication-hub.controller";
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
const suppressionManagers = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]);
const campaignRules = [
  body("title").isString().trim().isLength({ min: 3, max: 200 }),
  body("body").isString().trim().isLength({ min: 3, max: 5000 }),
  body("channels").isArray({ min: 1, max: 4 }),
  body("channels.*").isIn(["in_app", "email", "push", "sms"]),
  body("audience").isIn(["all", "students", "faculty", "parents", "admin", "specific_users"]),
  body("scheduledAt").optional().isISO8601(),
  body("priority").optional().isIn(["normal", "important", "emergency"]),
  body("requireAcknowledgement").optional().isBoolean(),
  body("targetDepartments").optional().isArray({ max: 100 }),
  body("targetDepartments.*").optional().isMongoId(),
  body("targetPrograms").optional().isArray({ max: 100 }),
  body("targetPrograms.*").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("targetSemesters").optional().isArray({ max: 20 }),
  body("targetSemesters.*").optional().isInt({ min: 1, max: 20 }),
  body("targetUserIds").optional().isArray({ max: 10000 }),
  body("targetUserIds.*").optional().isMongoId(),
];
const audienceRules = [
  body("channels").isArray({ min: 1, max: 4 }),
  body("channels.*").isIn(["in_app", "email", "push", "sms"]),
  body("audience").isIn(["all", "students", "faculty", "parents", "admin", "specific_users"]),
  body("targetDepartments").optional().isArray({ max: 100 }),
  body("targetDepartments.*").optional().isMongoId(),
  body("targetPrograms").optional().isArray({ max: 100 }),
  body("targetPrograms.*").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("targetSemesters").optional().isArray({ max: 20 }),
  body("targetSemesters.*").optional().isInt({ min: 1, max: 20 }),
  body("targetUserIds").optional().isArray({ max: 10000 }),
  body("targetUserIds.*").optional().isMongoId(),
];
const templateRules = [
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  body("category").isString().trim().isLength({ min: 2, max: 80 }),
  body("subject").isString().trim().isLength({ min: 3, max: 200 }),
  body("body").isString().trim().isLength({ min: 3, max: 5000 }),
  body("channels").isArray({ min: 1, max: 4 }),
];

router.use(authenticate, managers);
router.get("/metadata", communicationHubController.metadata);
router.get("/campaigns", communicationHubController.campaigns);
router.post(
  "/audience-preview",
  audienceRules,
  validate,
  communicationHubController.audiencePreview,
);
router.get(
  "/campaigns/:id",
  [param("id").isMongoId()],
  validate,
  communicationHubController.campaign,
);
router.get("/templates", communicationHubController.templates);
router.get("/suppressions", suppressionManagers, communicationHubController.suppressions);
router.post(
  "/suppressions",
  suppressionManagers,
  [
    body("channel").isIn(["email", "sms"]),
    body("destination").isString().trim().isLength({ min: 3, max: 320 }),
    body("reason").isString().trim().isLength({ min: 10, max: 1000 }),
  ],
  validate,
  communicationHubController.suppress,
);
router.post(
  "/suppressions/:id/release",
  suppressionManagers,
  [param("id").isMongoId()],
  validate,
  communicationHubController.releaseSuppression,
);
router.post("/templates", templateRules, validate, communicationHubController.saveTemplate);
router.put(
  "/templates/:id",
  [param("id").isMongoId(), ...templateRules],
  validate,
  communicationHubController.saveTemplate,
);
router.post("/campaigns", campaignRules, validate, communicationHubController.createCampaign);
router.post(
  "/campaigns/:id/cancel",
  [param("id").isMongoId()],
  validate,
  communicationHubController.cancelCampaign,
);
router.post(
  "/campaigns/:id/retry",
  [param("id").isMongoId(), body("reason").isString().trim().isLength({ min: 10, max: 500 })],
  validate,
  communicationHubController.retryCampaign,
);

export default router;
