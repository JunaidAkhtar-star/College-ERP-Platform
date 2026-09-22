import type { Request, Response } from "express";
import { Router } from "express";
import { configs, isDBHealthy } from "../configs";
import { getOnlineUserIds } from "../socket/socket.gateway";
import { rabbitMqService } from "../services/rabbitmq.service";
import { redisUtil } from "../utils/redis.util";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const db = isDBHealthy();
  const redis = await redisUtil.healthCheck();

  let socketConnections = 0;
  try {
    socketConnections = (await getOnlineUserIds()).length;
  } catch {
    /* Socket.IO not yet ready */
  }

  const brokerReady =
    configs.JOB_RUNTIME_MODE === "api" ||
    (rabbitMqService.enabled() && rabbitMqService.connected());
  const redisReady = configs.NODE_ENV !== "production" || redis;
  const healthy = db && brokerReady && redisReady;
  const status = healthy ? 200 : 503;

  res.status(status).json({
    status: healthy ? "ok" : "degraded",
    db: db ? "connected" : "disconnected",
    redis: redis ? "connected" : "disconnected",
    rabbitmq: {
      enabled: rabbitMqService.enabled(),
      connected: rabbitMqService.connected(),
      requiredByProcess: configs.JOB_RUNTIME_MODE !== "api",
    },
    websocket: { onlineUsers: socketConnections },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
  });
});

export default router;
