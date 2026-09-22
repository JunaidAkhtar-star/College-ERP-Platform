import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { externalConnectorController } from "../controllers/external-connector.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
router.post(
  "/webhooks/twilio/:connectorId",
  param("connectorId").isMongoId(),
  body("MessageSid").isString().notEmpty(),
  body("MessageStatus").isString().notEmpty(),
  validate,
  externalConnectorController.twilioReceipt,
);
router.use(
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL]),
);
router.get("/metadata", externalConnectorController.metadata);
router.get("/executions", externalConnectorController.executions);
router.get("/", externalConnectorController.list);
const rules = [
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  body("provider").isString(),
  body("enabled").optional().isBoolean(),
  body("config").isObject(),
  body("secrets").optional().isObject(),
  body("rotationReason").optional().isString().trim().isLength({ min: 10, max: 1000 }),
];
router.post("/", rules, validate, externalConnectorController.save);
router.put("/:id", [param("id").isMongoId(), ...rules], validate, externalConnectorController.save);
router.post("/:id/test", [param("id").isMongoId()], validate, externalConnectorController.test);
router.post(
  "/:id/execute",
  [
    param("id").isMongoId(),
    body("operation").isString().trim().isLength({ min: 3, max: 100 }),
    body("payload").isObject(),
    body("idempotencyKey")
      .isString()
      .trim()
      .matches(/^[A-Za-z0-9._:-]{12,200}$/),
  ],
  validate,
  externalConnectorController.execute,
);
export default router;
