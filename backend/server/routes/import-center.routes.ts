import { Router } from "express";
import { param } from "express-validator";
import { importCenterController } from "../controllers/import-center.controller";
import { authenticate, validate } from "../middlewares";

const router = Router();
router.get("/metadata", authenticate, importCenterController.metadata);
router.get("/", authenticate, importCenterController.list);
router.get("/:id", [param("id").isMongoId()], validate, authenticate, importCenterController.get);
router.post("/stage", authenticate, importCenterController.stage);
router.post(
  "/:id/commit",
  [param("id").isMongoId()],
  validate,
  authenticate,
  importCenterController.commit,
);
router.post(
  "/:id/cancel",
  [param("id").isMongoId()],
  validate,
  authenticate,
  importCenterController.cancel,
);
router.post(
  "/:id/rollback",
  [param("id").isMongoId()],
  validate,
  authenticate,
  importCenterController.rollback,
);
export default router;
