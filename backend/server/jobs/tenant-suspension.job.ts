/**
 * Tenant Suspension Job
 * Runs every five minutes — scans for college tenant accounts
 * that have reached their subscription end date and suspends/expires them.
 */
import cron from "node-cron";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { logger } from "../utils/logger.util";
import { withSchedulerLease } from "../services/scheduler-lease.service";

export function startTenantSuspensionJob(): void {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await withSchedulerLease("master:tenant-suspension", async () => {
        logger.cron("tenant-suspension — running subscription scan");
        const now = new Date();
        const expiredTrials = await TenantModel.updateMany(
          {
            status: TenantStatus.ACTIVE,
            billingStatus: "trialing",
            trialEndsAt: { $lte: now },
          },
          { $set: { status: TenantStatus.EXPIRED, billingStatus: "pending_payment" } },
        );
        const expiredCount = await TenantModel.updateMany(
          {
            status: TenantStatus.ACTIVE,
            subscriptionExpiresAt: { $lt: now },
            billingStatus: { $nin: ["free", "trialing"] },
          },
          {
            $set: { status: TenantStatus.EXPIRED },
          },
        );
        const totalExpired = expiredTrials.modifiedCount + expiredCount.modifiedCount;
        if (totalExpired > 0) {
          logger.cron(`tenant-suspension — Expired ${totalExpired} tenant college(s)`);
        }
      });
    } catch (err) {
      logger.error("tenant-suspension job failed", err);
    }
  });

  logger.cron("Tenant suspension job started (every 5 minutes)");
}
