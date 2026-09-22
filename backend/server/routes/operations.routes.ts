import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { operationsController } from "../controllers/operations.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const operators = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL]);

router.use(authenticate, operators);
router.get("/outbox/summary", operationsController.outboxSummary);
router.get("/outbox/dead-letters", operationsController.deadLetters);
router.post(
  "/outbox/dead-letters/:id/replay",
  param("id").isMongoId(),
  body("reason").isString().trim().isLength({ min: 10, max: 1000 }),
  validate,
  operationsController.replayDeadLetter,
);

export default router;
