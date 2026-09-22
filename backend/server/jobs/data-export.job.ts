import cron from "node-cron";
import { DataExportJobModel } from "../models/data-portability.model";
import { dataPortabilityService } from "../services/data-portability.service";
import { jobQueueService, registerJobHandler } from "../services/job-queue.service";
import { logger } from "../utils/logger.util";

registerJobHandler("data-export.generate", {
  async run(payload) {
    await dataPortabilityService.generateArtifact(String(payload.exportJobId));
  },
  async onDead(payload, error) {
    await DataExportJobModel.updateOne(
      {
        _id: String(payload.exportJobId),
        status: "generating",
        generationLeaseUntil: { $lte: new Date() },
      },
      { $set: { status: "failed", generationError: error } },
    );
  },
});

export function startDataExportRecoveryJob(): void {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const stale = await DataExportJobModel.find({
        status: "generating",
        updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) },
      })
        .select("_id")
        .limit(100)
        .lean();
      for (const job of stale) {
        await jobQueueService.enqueue(
          "data-export.generate",
          `data-export-recovery:${job._id}:${Math.floor(Date.now() / 600_000)}`,
          { exportJobId: String(job._id) },
        );
      }
    } catch (error) {
      logger.error("data export recovery dispatcher failed", error);
    }
  });
  logger.cron("Encrypted export recovery scheduler started (every 10 minutes)");
}
