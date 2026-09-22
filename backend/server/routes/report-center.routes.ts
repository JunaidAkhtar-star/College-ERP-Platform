import { Router } from "express";
import { body, param } from "express-validator";
import { reportCenterController } from "../controllers/report-center.controller";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
router.get("/metadata", authenticate, reportCenterController.metadata);
router.get("/", authenticate, reportCenterController.list);
router.post(
  "/",
  [
    body("name").trim().notEmpty(),
    body("dataset").trim().notEmpty(),
    body("columns").isArray({ min: 1 }),
  ],
  validate,
  authenticate,
  reportCenterController.create,
);
router.post("/preview", authenticate, reportCenterController.preview);
router.post(
  "/export",
  [
    body("dataset").isString().trim().notEmpty(),
    body("columns").isArray({ min: 1, max: 50 }),
    body("columns.*").isString().trim().notEmpty(),
    body("filters").optional().isArray({ max: 20 }),
    body("sort").optional().isArray({ max: 5 }),
    body("asOf").optional().isISO8601(),
  ],
  validate,
  authenticate,
  reportCenterController.exportAdHoc,
);
router.get("/snapshots", authenticate, reportCenterController.listSnapshots);
router.get(
  "/snapshots/:id",
  [param("id").isMongoId()],
  validate,
  authenticate,
  reportCenterController.getSnapshot,
);
router.get("/schedules", authenticate, reportCenterController.listSchedules);
router.post(
  "/schedules",
  [
    body("reportDefinitionId").isMongoId(),
    body("cronExpression")
      .isString()
      .trim()
      .matches(/^(\S+\s+){4}\S+$/),
    body("timezone").isString().trim().isLength({ min: 3, max: 100 }),
    body("format").isIn(["json", "csv"]),
    body("recipientUserIds").isArray({ min: 1, max: 100 }),
    body("recipientUserIds.*").isMongoId(),
    body("asOfMode").isIn(["run_time", "previous_day", "previous_month_end"]),
  ],
  validate,
  authenticate,
  reportCenterController.createSchedule,
);
router.patch(
  "/schedules/:id/status",
  [param("id").isMongoId(), body("status").isIn(["active", "paused"])],
  validate,
  authenticate,
  reportCenterController.setScheduleStatus,
);
router.put(
  "/:id",
  [param("id").isMongoId()],
  validate,
  authenticate,
  reportCenterController.update,
);
router.get(
  "/:id/run",
  [param("id").isMongoId()],
  validate,
  authenticate,
  reportCenterController.run,
);
router.post(
  "/:id/submit",
  [param("id").isMongoId()],
  validate,
  authenticate,
  reportCenterController.submit,
);
router.post(
  "/:id/publish",
  [param("id").isMongoId()],
  validate,
  authenticate,
  requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL]),
  reportCenterController.publish,
);
router.post(
  "/:id/snapshot",
  [param("id").isMongoId(), body("asOf").optional().isISO8601()],
  validate,
  authenticate,
  reportCenterController.snapshot,
);

export default router;
