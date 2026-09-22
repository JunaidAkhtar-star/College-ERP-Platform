import type { Express } from "express";
import http from "http";
import mongoose from "mongoose";
import { configs, isDBHealthy } from "../configs";
import { initSocketGateway } from "../socket/socket.gateway";
import { logger } from "../utils/logger.util";
import { rabbitMqService } from "../services/rabbitmq.service";
import { emailService } from "../email/email.service";
import { redisUtil } from "../utils/redis.util";
import { platformIntegrationService } from "../services/platform-integration.service";

async function waitForDatabase(timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!isDBHealthy() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return isDBHealthy();
}

/**
 * Reports required infrastructure and every configured platform provider without
 * exposing credentials. Optional providers never prevent the HTTP server from
 * accepting requests; their latest verified state is made explicit in logs.
 */
async function reportStartupReadiness(): Promise<void> {
  const databaseConnected = await waitForDatabase();
  const redisConnected = await redisUtil.healthCheck();
  logger.info(`[startup] MongoDB: ${databaseConnected ? "connected" : "unavailable"}`);
  logger.info(
    `[startup] Redis: ${redisConnected ? "connected" : configs.REDIS_URL ? "unavailable" : "not configured"}`,
  );
  logger.info(
    `[startup] RabbitMQ: ${rabbitMqService.connected() ? "connected" : configs.RABBITMQ_URL ? "connecting/unavailable" : "not configured (background jobs disabled)"}`,
  );

  if (databaseConnected) {
    try {
      const integrations = await platformIntegrationService.list();
      for (const integration of integrations) {
        const state = !integration.enabled
          ? integration.status === "not_configured"
            ? "not configured"
            : "disabled"
          : integration.status === "healthy"
            ? "connected (last verified)"
            : integration.status;
        logger.info(`[startup] ${integration.label}: ${state}`);
      }

      const smtp = integrations.find((integration) => integration.provider === "smtp");
      if (smtp?.enabled) {
        const emailConnected = await emailService.verifyConnection();
        logger.info(`[startup] SMTP live connection: ${emailConnected ? "connected" : "failed"}`);
      }
    } catch (error) {
      logger.warn("[startup] Platform integration readiness could not be loaded", error);
    }
  }

  const rabbitReady = Boolean(configs.RABBITMQ_URL) && rabbitMqService.connected();
  const requiredReady =
    databaseConnected && (configs.NODE_ENV !== "production" || redisConnected) && rabbitReady;
  if (requiredReady) {
    logger.info("✅ Backend server connected successfully", {
      port: configs.PORT,
      environment: configs.NODE_ENV,
    });
  } else {
    logger.error("❌ Backend server started but required services are not ready", {
      databaseConnected,
      redisConnected,
      redisRequired: configs.NODE_ENV === "production",
      rabbitRequired: Boolean(configs.RABBITMQ_URL),
      rabbitConnected: rabbitMqService.connected(),
    });
  }
}

export const ListenerPlugin = {
  listen(app: Express) {
    const server = http.createServer(app);

    // Attach Socket.IO to the same HTTP server
    const io = initSocketGateway(server);

    server.listen(configs.PORT, () => {
      logger.info(`Server listening on port ${configs.PORT}`);
      logger.socket(`Socket.IO gateway active on port ${configs.PORT}`);
      void reportStartupReadiness();
    });

    // ── Graceful shutdown ────────────────────────────────────────────────────
    // On SIGTERM/SIGINT (e.g. Docker stop, pm2 reload, Ctrl-C) we:
    //   1. stop accepting new HTTP requests
    //   2. close all Socket.IO connections (clients get a disconnect, can reconnect)
    //   3. drain the Mongo pool
    // A 10-second hard-kill safety net guards against hung handles.
    let shuttingDown = false;
    async function shutdown(signal: string) {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.warn(`${signal} received — graceful shutdown starting`);

      const hardKill = setTimeout(() => {
        logger.error("Graceful shutdown timed out — forcing exit");
        process.exit(1);
      }, 10_000);
      hardKill.unref();

      try {
        await new Promise<void>((resolve) => io.close(() => resolve()));
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await rabbitMqService.stop();
        await mongoose.connection.close(false);
        logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error("Shutdown error", err);
        process.exit(1);
      }
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
      logger.error("UNHANDLED_REJECTION", reason instanceof Error ? reason : { reason });
      void shutdown("UNHANDLED_REJECTION");
    });
    process.on("uncaughtException", (error) => {
      logger.error("UNCAUGHT_EXCEPTION", error);
      void shutdown("UNCAUGHT_EXCEPTION");
    });
  },
};
