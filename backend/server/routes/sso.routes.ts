import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { ssoController } from "../controllers/sso.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const administrators = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
]);

router.get("/providers", ssoController.providers);
router.post(
  "/start",
  [
    body("provider").isIn(["google", "microsoft"]),
    body("returnUrl").isURL({ protocols: ["http", "https"], require_protocol: true }),
  ],
  validate,
  ssoController.start,
);
router.post(
  "/complete",
  [body("code").isString().notEmpty(), body("state").isString().isLength({ min: 20, max: 200 })],
  validate,
  ssoController.complete,
);
router.get("/configurations", authenticate, administrators, ssoController.configurations);
router.put(
  "/configurations/:provider",
  authenticate,
  administrators,
  [
    param("provider").isIn(["google", "microsoft"]),
    body("clientId")
      .optional()
      .isString()
      .withMessage("Client ID must be text")
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage("Client ID must contain between 3 and 500 characters"),
    body("clientSecret")
      .optional()
      .isString()
      .withMessage("Client secret must be text")
      .trim()
      .isLength({ min: 8, max: 1000 })
      .withMessage("Client secret must contain between 8 and 1000 characters"),
    body("allowedDomains").optional().isArray({ max: 100 }),
    body("autoProvision").optional().isBoolean(),
  ],
  validate,
  ssoController.saveConfiguration,
);
router.post(
  "/configurations/:provider/test",
  authenticate,
  administrators,
  [param("provider").isIn(["google", "microsoft"])],
  validate,
  ssoController.testConfiguration,
);

export default router;
