import cron from "node-cron";
import { lmsIntegrationService } from "../services/lms-integration.service";
import { logger } from "../utils/logger.util";

export function startLmsSyncJob(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const runs = await lmsIntegrationService.runDueProfiles();
      if (runs.length) logger.cron(`LMS scheduled sync completed — runs=${runs.length}`);
    } catch (error) {
      logger.error("LMS scheduled sync failed", error);
    }
  });
  logger.cron("LMS scheduler started (every 15 minutes)");
}
