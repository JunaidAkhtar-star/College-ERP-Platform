import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { formWorkflowController } from "../controllers/form-workflow.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const managers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
]);
const definitionRules = [
  body("name").isString().trim().isLength({ min: 2, max: 150 }),
  body("slug").matches(/^[a-z0-9-]{2,80}$/),
  body("category").isString().trim().isLength({ min: 2, max: 80 }),
  body("fields").isArray({ min: 1, max: 100 }),
];

router.use(authenticate);
router.get("/metadata", formWorkflowController.metadata);
router.get("/manage/definitions", managers, formWorkflowController.manageDefinitions);
router.get(
  "/manage/definitions/:id",
  managers,
  [param("id").isMongoId()],
  validate,
  formWorkflowController.manageDefinition,
);
router.get("/definitions", formWorkflowController.definitions);
router.get("/definitions/:id", formWorkflowController.definition);
router.post(
  "/definitions",
  managers,
  definitionRules,
  validate,
  formWorkflowController.saveDefinition,
);
router.put(
  "/definitions/:id",
  managers,
  [param("id").isMongoId(), ...definitionRules],
  validate,
  formWorkflowController.saveDefinition,
);
router.post(
  "/definitions/:id/review",
  managers,
  [param("id").isMongoId()],
  validate,
  formWorkflowController.submitForReview,
);
router.post(
  "/definitions/:id/publish",
  managers,
  [param("id").isMongoId()],
  validate,
  formWorkflowController.publish,
);
router.post(
  "/definitions/:id/submit",
  [param("id").isMongoId(), body("data").isObject()],
  validate,
  formWorkflowController.submit,
);
router.get("/submissions/mine", formWorkflowController.mine);
router.get("/submissions/inbox", formWorkflowController.inbox);
router.get("/manage/submissions", managers, formWorkflowController.allSubmissions);
router.post(
  "/submissions/:id/decision",
  [param("id").isMongoId(), body("decision").isIn(["approved", "rejected"])],
  validate,
  formWorkflowController.decide,
);
router.post(
  "/submissions/:id/withdraw",
  [param("id").isMongoId()],
  validate,
  formWorkflowController.withdraw,
);
router.post(
  "/submissions/:id/remind",
  [param("id").isMongoId()],
  validate,
  formWorkflowController.remind,
);
router.get("/delegations/mine", formWorkflowController.delegations);
router.post(
  "/delegations",
  [
    body("delegateId").isMongoId(),
    body("role").isString().trim().isLength({ min: 2, max: 80 }),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
    body("reason").optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  formWorkflowController.createDelegation,
);
router.delete(
  "/delegations/:id",
  [param("id").isMongoId()],
  validate,
  formWorkflowController.revokeDelegation,
);

export default router;
