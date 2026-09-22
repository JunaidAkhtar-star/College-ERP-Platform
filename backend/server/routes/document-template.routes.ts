import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { documentTemplateController } from "../controllers/document-template.controller";
import { authenticate, requireRoles, validate } from "../middlewares";
const router = Router();
const admins = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
]);
router.get(
  "/verify/:code",
  [param("code").isHexadecimal().isLength({ min: 32, max: 32 })],
  validate,
  documentTemplateController.verify,
);
router.get("/metadata", authenticate, admins, documentTemplateController.metadata);
router.get("/", authenticate, admins, documentTemplateController.list);
router.get("/issued", authenticate, admins, documentTemplateController.issued);
router.get(
  "/:id/versions",
  [param("id").isMongoId()],
  validate,
  authenticate,
  admins,
  documentTemplateController.versions,
);
router.post(
  "/",
  [
    body("name").trim().notEmpty(),
    body("kind").isIn(["certificate", "id_card", "letter", "report", "poster"]),
    body("audience").isIn(["student", "faculty", "visitor"]),
  ],
  validate,
  authenticate,
  admins,
  documentTemplateController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId()],
  validate,
  authenticate,
  admins,
  documentTemplateController.update,
);
router.post(
  "/:id/lifecycle/:action",
  [
    param("id").isMongoId(),
    param("action").isIn(["submit", "approve", "publish", "revise", "retire"]),
  ],
  validate,
  authenticate,
  admins,
  documentTemplateController.transition,
);
router.post(
  "/:id/issue",
  [param("id").isMongoId(), body("subjectId").isMongoId()],
  validate,
  authenticate,
  admins,
  documentTemplateController.issue,
);
router.post(
  "/issued/:id/revoke",
  [param("id").isMongoId(), body("reason").trim().isLength({ min: 5, max: 500 })],
  validate,
  authenticate,
  admins,
  documentTemplateController.revoke,
);
export default router;
