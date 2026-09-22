/**
 * @file erp-assistant.routes.ts
 * @description Clean MVC Route definition for ERP AI Assistant.
 *
 * POST /api/v1/erp-assistant/ask
 *   Auth: Bearer token (authenticate middleware)
 */

import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, validate } from "../middlewares";
import { erpAssistantController } from "../controllers/erp-assistant.controller";

const router = Router();

router.get("/history", authenticate, erpAssistantController.history);
router.delete("/history", authenticate, erpAssistantController.clearHistory);
router.delete(
  "/history/:conversationId",
  authenticate,
  [param("conversationId").isString().trim().isLength({ min: 1, max: 80 })],
  validate,
  erpAssistantController.deleteConversation,
);

router.post(
  "/ask",
  authenticate,
  [
    body("question")
      .isString()
      .trim()
      .isLength({ min: 1, max: 1500 })
      .withMessage("Question must be between 1 and 1500 characters"),
    body("conversationId").optional().isString().trim().isLength({ min: 1, max: 80 }),
    body("history").optional().isArray({ max: 20 }),
    body("history.*.role").optional().isIn(["user", "model"]),
    body("history.*.text").optional().isString(),
    body("context").optional().isObject(),
    body("context.currentPath").optional().isString().isLength({ max: 300 }),
    body("context.visibleModules").optional().isArray({ max: 150 }),
    body("context.visibleModules.*.label").optional().isString().isLength({ min: 1, max: 120 }),
    body("context.visibleModules.*.path").optional().isString().isLength({ min: 1, max: 300 }),
    body("context.visibleModules.*.group").optional().isString().isLength({ max: 120 }),
  ],
  validate,
  erpAssistantController.ask,
);

router.post(
  "/ask-stream",
  authenticate,
  [
    body("question")
      .isString()
      .trim()
      .isLength({ min: 1, max: 1500 })
      .withMessage("Question must be between 1 and 1500 characters"),
    body("conversationId").optional().isString().trim().isLength({ min: 1, max: 80 }),
    body("history").optional().isArray({ max: 20 }),
    body("history.*.role").optional().isIn(["user", "model"]),
    body("history.*.text").optional().isString(),
    body("context").optional().isObject(),
    body("context.currentPath").optional().isString().isLength({ max: 300 }),
    body("context.visibleModules").optional().isArray({ max: 150 }),
    body("context.visibleModules.*.label").optional().isString().isLength({ min: 1, max: 120 }),
    body("context.visibleModules.*.path").optional().isString().isLength({ min: 1, max: 300 }),
    body("context.visibleModules.*.group").optional().isString().isLength({ max: 120 }),
  ],
  validate,
  erpAssistantController.askStream,
);

export default router;
