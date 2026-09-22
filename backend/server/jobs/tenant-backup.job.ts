import cron from "node-cron";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { TenantBackupConfigModel } from "../models/tenant-backup.model";
import { getTenantConnection, tenantLocalStorage } from "../configs/connectionManager";
import { tenantBackupService } from "../services/tenant-backup.service";
import { withSchedulerLease } from "../services/scheduler-lease.service";
import { logger } from "../utils/logger.util";

export function startTenantBackupJob(): void {
  cron.schedule("*/10 * * * *", async () => {
    try {
      await withSchedulerLease("master:tenant-backup-dispatch", async () => {
        const tenants = await TenantModel.find({ status: TenantStatus.ACTIVE })
          .select("tenantId databaseName")
          .lean();
        for (const tenant of tenants) {
          const tenantDb = getTenantConnection(tenant.tenantId, tenant.databaseName);
          await tenantLocalStorage.run({ tenantId: tenant.tenantId, tenantDb }, async () => {
            const config = await TenantBackupConfigModel.findOne({
              enabled: true,
              connectedAt: { $exists: true },
              nextRunAt: { $lte: new Date() },
            }).lean();
            if (!config) return;
            try {
              await tenantBackupService.queue("scheduled");
              await TenantBackupConfigModel.updateOne(
                { _id: config._id },
                {
                  $set: {
                    nextRunAt: tenantBackupService.nextRun(
                      config.frequency,
                      config.hourUtc,
                      config.dayOfWeek,
                      config.dayOfMonth,
                    ),
                  },
                },
              );
            } catch (error) {
              if ((error as { status?: number }).status !== 409) throw error;
            }
          });
        }
      });
    } catch (error) {
      logger.error("tenant backup scheduler failed", error);
    }
  });
  logger.cron("Tenant backup dispatcher started (every 10 minutes)");
}
