import { Router, type NextFunction, type Request, type Response } from "express";
import { body, query } from "express-validator";
import createError from "http-errors";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";
import { getTenantConnection, tenantLocalStorage } from "../configs/connectionManager";
import { tenantBackupService, verifyBackupOAuthState } from "../services/tenant-backup.service";
import { auditLogRepository } from "../repositories/audit-log.repository";

const router = Router();
const administrators = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]);

router.get("/google/callback", async (req, res, next) => {
  let returnUrl = "";
  try {
    const state = verifyBackupOAuthState(String(req.query.state || ""));
    returnUrl = state.returnUrl;
    if (!req.query.code) throw createError(400, "Google authorization code is missing.");
    const tenantDb = getTenantConnection(state.tenantId, state.databaseName);
    await tenantLocalStorage.run({ tenantId: state.tenantId, tenantDb }, () =>
      tenantBackupService.completeAuthorization(String(req.query.code)),
    );
    const destination = new URL(returnUrl);
    destination.searchParams.set("backup", "connected");
    res.redirect(destination.toString());
  } catch (error) {
    if (returnUrl) {
      const destination = new URL(returnUrl);
      destination.searchParams.set("backup", "failed");
      res.redirect(destination.toString());
      return;
    }
    next(error);
  }
});

router.use(authenticate, administrators);
router.get("/", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tenantBackupService.overview() });
  } catch (error) {
    next(error);
  }
});
router.get(
  "/google/authorization-url",
  [query("returnUrl").isURL({ protocols: ["http", "https"], require_protocol: true })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: { url: await tenantBackupService.authorizationUrl(String(req.query.returnUrl)) },
      });
    } catch (error) {
      next(error);
    }
  },
);
router.put(
  "/schedule",
  [
    body("enabled").isBoolean(),
    body("frequency").isIn(["daily", "weekly", "monthly"]),
    body("hourUtc").isInt({ min: 0, max: 23 }),
    body("dayOfWeek").isInt({ min: 0, max: 6 }),
    body("dayOfMonth").isInt({ min: 1, max: 28 }),
    body("retentionCount").isInt({ min: 1, max: 30 }),
    body("driveFolderId").optional({ values: "falsy" }).isString().trim().isLength({ max: 255 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await tenantBackupService.saveSchedule({
        ...req.body,
        updatedBy: req.user?._id ? String(req.user._id) : undefined,
      });
      await auditLogRepository.create({
        user: req.user ?? null,
        action: "TENANT_BACKUP_SCHEDULE_UPDATED",
        module: "data_portability",
        targetId: String(data?._id || "google_drive"),
        targetModel: "TenantBackupConfig",
        description: "Automatic tenant backup schedule updated",
        metadata: { enabled: req.body.enabled, frequency: req.body.frequency },
        req,
      });
      res.json({ success: true, data, message: "Backup schedule saved." });
    } catch (error) {
      next(error);
    }
  },
);
router.post("/run", async (req, res, next) => {
  try {
    const data = await tenantBackupService.queue(
      "manual",
      req.user?._id ? String(req.user._id) : undefined,
    );
    res.status(202).json({ success: true, data, message: "Backup queued securely." });
  } catch (error) {
    next(error);
  }
});
router.delete("/google", async (req, res, next) => {
  try {
    await tenantBackupService.disconnect();
    res.json({ success: true, message: "Google Drive disconnected and scheduling disabled." });
  } catch (error) {
    next(error);
  }
});

export default router;
