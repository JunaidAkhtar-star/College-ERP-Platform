import { Router } from "express";
import { query } from "express-validator";
import { authenticate, validate } from "../middlewares";
import { complianceController } from "../controllers/compliance.controller";

const router = Router();
const exportScope = [query("academicYear").matches(/^\d{4}-\d{2}$/)];

router.get(
  "/export/naac-1",
  authenticate,
  exportScope,
  validate,
  complianceController.exportNaacCriteria1,
);

router.get(
  "/export/naac-5",
  authenticate,
  exportScope,
  validate,
  complianceController.exportNaacCriteria5,
);

router.get(
  "/export/nba-performance",
  authenticate,
  exportScope,
  validate,
  complianceController.exportNbaPerformance,
);

export default router;
