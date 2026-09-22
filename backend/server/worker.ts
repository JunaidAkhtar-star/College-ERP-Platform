import mongoose from "mongoose";
import { connectDB } from "./configs";
import { startAllJobs } from "./jobs";
import { rabbitMqService } from "./services/rabbitmq.service";
import { logger } from "./utils/logger.util";

let shuttingDown = false;

async function shutdown(signal: string, exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${signal} received — worker shutdown starting`);
  const hardKill = setTimeout(() => process.exit(1), 10_000);
  hardKill.unref();
  try {
    await rabbitMqService.stop();
    await mongoose.connection.close(false);
    clearTimeout(hardKill);
    process.exit(exitCode);
  } catch (error) {
    logger.error("Worker shutdown failed", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM", 0));
process.on("SIGINT", () => void shutdown("SIGINT", 0));
process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED_REJECTION", reason instanceof Error ? reason : { reason });
  void shutdown("UNHANDLED_REJECTION", 1);
});
process.on("uncaughtException", (error) => {
  logger.error("UNCAUGHT_EXCEPTION", error);
  void shutdown("UNCAUGHT_EXCEPTION", 1);
});

connectDB()
  .then(() => {
    startAllJobs();
    logger.info("Background worker started");
  })
  .catch((error) => {
    logger.error("Background worker failed to start", error);
    void shutdown("STARTUP_FAILURE", 1);
  });
