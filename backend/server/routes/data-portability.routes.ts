import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { dataPortabilityController } from "../controllers/data-portability.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const administrators = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
]);
const approvers = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL]);
router.use(authenticate, administrators);
router.get("/metadata", dataPortabilityController.metadata);
router.get("/", dataPortabilityController.list);
router.post(
  "/",
  [
    body("datasets").isArray({ min: 1, max: 8 }),
    body("format").optional().isIn(["json", "ndjson"]),
    body("filters.from").optional().isISO8601(),
    body("filters.to").optional().isISO8601(),
    body("purpose").isString().trim().isLength({ min: 10, max: 1000 }),
    body("legalBasis").isIn(["consent", "contract", "legal_obligation", "legitimate_interest"]),
    body("redactionProfile").optional().isIn(["standard", "deidentified"]),
  ],
  validate,
  dataPortabilityController.create,
);
router.patch(
  "/:id/decide",
  approvers,
  [
    param("id").isMongoId(),
    body("action").isIn(["approve", "reject"]),
    body("reason").isString().trim().isLength({ min: 10, max: 1000 }),
  ],
  validate,
  dataPortabilityController.decide,
);
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), body("reason").isString().trim().isLength({ min: 10, max: 1000 })],
  validate,
  dataPortabilityController.cancel,
);
router.get("/dsars", dataPortabilityController.listDsars);
router.post(
  "/dsars",
  [
    body("subjectUserId").isMongoId(),
    body("requestType").isIn(["access", "rectification", "erasure", "restriction", "portability"]),
    body("details").isString().trim().isLength({ min: 10, max: 5000 }),
  ],
  validate,
  dataPortabilityController.createDsar,
);
router.patch(
  "/dsars/:id/status",
  approvers,
  [
    param("id").isMongoId(),
    body("status").isIn(["identity_verified", "under_review", "fulfilled", "rejected"]),
    body("resolution").optional().isString().trim().isLength({ min: 10, max: 5000 }),
  ],
  validate,
  dataPortabilityController.decideDsar,
);
router.get("/legal-holds", dataPortabilityController.listHolds);
router.post(
  "/legal-holds",
  approvers,
  [
    body("name").isString().trim().isLength({ min: 3, max: 255 }),
    body("reason").isString().trim().isLength({ min: 10, max: 2000 }),
    body("datasets").isArray({ min: 1, max: 8 }),
  ],
  validate,
  dataPortabilityController.createHold,
);
router.patch(
  "/legal-holds/:id/release",
  approvers,
  [param("id").isMongoId(), body("reason").isString().trim().isLength({ min: 10, max: 2000 })],
  validate,
  dataPortabilityController.releaseHold,
);
router.get("/compliance-summary", dataPortabilityController.complianceSummary);
router.get(
  "/:id/download",
  [param("id").isMongoId()],
  validate,
  dataPortabilityController.download,
);
export default router;
