/// <reference path="./types/express.d.ts" />
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import fileUpload from "express-fileupload";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { readdirSync } from "fs";
import path from "path";
import { connectDB, configs, isDBHealthy } from "./configs";
import { jobRuntimeStatus, startAllJobs } from "./jobs";
import { apiLimiter } from "./middlewares/rate-limit.middleware";
import { dashboardProtection } from "./middlewares/dashboard.middleware";
import { tenantResolver } from "./middlewares";
import { ListenerPlugin, RouterPlugin } from "./plugins";
import { renderDashboard } from "./views/dashboard.view";
import { logger } from "./utils/logger.util";
import si from "systeminformation";
import { TenantModel, TenantStatus } from "./models/tenant.model";
import { redisUtil } from "./utils/redis.util";
import { redactOperationalLog } from "./utils/operational-dashboard.util";
import { isAllowedCorsOrigin } from "./utils/cors.util";
import { businessAuditMiddleware } from "./middlewares/business-audit.middleware";

// ── Bootstrap — jobs ONLY start after a confirmed DB connection ───────────────
connectDB()
  .then(() => {
    if (configs.JOB_RUNTIME_MODE !== "api") startAllJobs();
  })
  .catch((err) => {
    logger.error("DB connection failed at startup — background jobs NOT started", err);
    // Do not start jobs; the DB reconnect loop in configs/index.ts will re-try
  });

const app = express();
app.set("trust proxy", configs.TRUST_PROXY_HOPS);

const requestTelemetry = {
  startedAt: Date.now(),
  requests: 0,
  errors: 0,
  totalDurationMs: 0,
};

app.use((req: Request, res: Response, next) => {
  const supplied = req.headers["x-request-id"];
  const id =
    typeof supplied === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);

  const started = performance.now();
  requestTelemetry.requests += 1;
  res.on("finish", () => {
    const durationMs = performance.now() - started;
    requestTelemetry.totalDurationMs += durationMs;
    if (res.statusCode >= 500) requestTelemetry.errors += 1;
    if (durationMs >= 2_000 && !req.path.startsWith("/__logs/stream")) {
      logger.warn("Slow HTTP request", {
        requestId: id,
        method: req.method,
        path: req.originalUrl.split("?", 1)[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    }
  });
  next();
});

// Browsers request this automatically while viewing the operational dashboard.
// Resolve it before tenant middleware so it is never mistaken for a tenant API call.
app.get("/favicon.ico", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(204).end();
});

// ── Live log bus — captures EVERY line written to stdout/stderr ─────────────
// This is logger-agnostic: it works whether logger.util uses pino, winston,
// or plain console under the hood, and also captures morgan's HTTP access log.
// A ring buffer keeps recent history so new dashboard connections can replay
// the tail instantly; the EventEmitter fans out new lines to open SSE streams.
const LOG_BUFFER_SIZE = 500;
const logBuffer: { ts: number; line: string }[] = [];
const logBus = new EventEmitter();
logBus.setMaxListeners(100);

function pushLog(raw: string) {
  // eslint-disable-next-line no-control-regex
  const line = redactOperationalLog(raw.replace(/\x1b\[[0-9;]*m/g, "").replace(/\n+$/, ""));
  if (!line.trim()) return;
  const entry = { ts: Date.now(), line };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  logBus.emit("line", entry);
}

type WriteChunk = string | Uint8Array;
type PassthroughWrite = (...args: unknown[]) => boolean;

function patchStreamForLogCapture(stream: NodeJS.WriteStream): void {
  const original = stream.write.bind(stream) as unknown as PassthroughWrite;
  stream.write = ((chunk: WriteChunk, ...rest: unknown[]): boolean => {
    try {
      pushLog(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    } catch {
      /* never let log capture break the actual write */
    }
    return original(chunk, ...rest);
  }) as typeof stream.write;
}

for (const stream of [process.stdout, process.stderr] as const) {
  patchStreamForLogCapture(stream);
}

// ── API modules ───────────────────────────────────────────────────────────────
const API_ROUTES = readdirSync(path.join(__dirname, "routes"))
  .filter((filename) => /\.routes\.(ts|js)$/.test(filename))
  .map((filename) => filename.replace(/\.routes\.(ts|js)$/, ""))
  .sort();

// ── Helper: collect live stats (shared by both routes) ───────────────────────
let tenantCountCache = {
  expiresAt: 0,
  value: { total: 0, active: 0, suspended: 0, failed: 0 },
};
let redisHealthCache = { expiresAt: 0, connected: false };

async function collectLiveStats() {
  let onlineUsers = 0;
  try {
    const { getOnlineUserIds } = require("./socket/socket.gateway") as {
      getOnlineUserIds: () => Promise<string[]>;
    };
    onlineUsers = (await getOnlineUserIds()).length;
  } catch {
    /* socket not yet initialised */
  }

  let cpuTemp: number | null = null;
  let cpuSpeed: number | null = null;
  let cpuSpeedMax: number | null = null;
  let diskUsedGB: number | null = null;
  let diskTotalGB: number | null = null;
  let diskPct: number | null = null;
  let netRxSec: number | null = null;
  let netTxSec: number | null = null;
  let netIface: string | null = null;
  let processCount: number | null = null;
  let processRunning: number | null = null;
  let cpuLoadCurrent: number | null = null;
  let cpuCoresLoad: number[] = [];

  try {
    const [tempData, cpuData, fsData, netData, procData, loadData] = await Promise.all([
      si.cpuTemperature(),
      si.cpuCurrentSpeed(),
      si.fsSize(),
      si.networkStats(),
      si.processes(),
      si.currentLoad(),
    ]);

    cpuTemp = tempData.main > 0 ? tempData.main : null;
    cpuSpeed = cpuData.avg > 0 ? cpuData.avg : null;
    cpuSpeedMax = cpuData.max > 0 ? cpuData.max : null;
    cpuLoadCurrent = loadData.currentLoad;
    cpuCoresLoad = loadData.cpus.map((c) => c.load);

    // Largest mounted filesystem — typically the root/data volume on a server
    const mainDisk = [...fsData].sort((a, b) => b.size - a.size)[0];
    if (mainDisk) {
      diskTotalGB = mainDisk.size / 1024 ** 3;
      diskUsedGB = mainDisk.used / 1024 ** 3;
      diskPct = mainDisk.use;
    }

    const mainNic = netData?.[0];
    if (mainNic) {
      netRxSec = mainNic.rx_sec ?? null;
      netTxSec = mainNic.tx_sec ?? null;
      netIface = mainNic.iface ?? null;
    }

    processCount = procData?.all ?? null;
    processRunning = procData?.running ?? null;
  } catch {
    /* not available in all OS/environments (e.g. containers without procfs) */
  }

  let tenantCounts = tenantCountCache.value;
  if (isDBHealthy() && tenantCountCache.expiresAt <= Date.now()) {
    try {
      const rows = await TenantModel.aggregate<{ _id: TenantStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const counts = new Map(rows.map((row) => [row._id, row.count]));
      tenantCounts = {
        total: rows.reduce((sum, row) => sum + row.count, 0),
        active: counts.get(TenantStatus.ACTIVE) || 0,
        suspended: counts.get(TenantStatus.SUSPENDED) || 0,
        failed: counts.get(TenantStatus.PROVISIONING_FAILED) || 0,
      };
      tenantCountCache = { value: tenantCounts, expiresAt: Date.now() + 30_000 };
    } catch {
      /* master database may still be reconnecting */
    }
  }

  const elapsedMinutes = Math.max((Date.now() - requestTelemetry.startedAt) / 60_000, 1 / 60);
  if (redisHealthCache.expiresAt <= Date.now()) {
    redisHealthCache = {
      connected: await redisUtil.healthCheck(),
      expiresAt: Date.now() + 15_000,
    };
  }
  return {
    onlineUsers,
    cpuTemp,
    cpuSpeed,
    cpuSpeedMax,
    diskUsedGB,
    diskTotalGB,
    diskPct,
    netRxSec,
    netTxSec,
    netIface,
    processCount,
    processRunning,
    cpuLoadCurrent,
    cpuCoresLoad,
    tenantCounts,
    redisConnected: redisHealthCache.connected,
    jobs: jobRuntimeStatus,
    requestsPerMinute: requestTelemetry.requests / elapsedMinutes,
    requestErrorRate:
      requestTelemetry.requests > 0
        ? (requestTelemetry.errors / requestTelemetry.requests) * 100
        : 0,
    averageResponseMs:
      requestTelemetry.requests > 0
        ? requestTelemetry.totalDurationMs / requestTelemetry.requests
        : 0,
  };
}

// ── Developer dashboard — only accessible from whitelisted IPs ───────────────
// In development (no ADMIN_IP_WHITELIST set) all IPs pass through.
// Hosting providers commonly use HEAD / as a lightweight process health probe.
// Return no content without exposing the protected operations dashboard.
app.head("/", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
});

app.get("/", ...dashboardProtection, async (_req: Request, res: Response) => {
  const stats = await collectLiveStats();

  const html = renderDashboard({
    db: isDBHealthy(),
    ...stats,
    apiRoutes: API_ROUTES,
    apiVersion: configs.API_VERSION,
    port: configs.PORT,
    host: configs.HOST,
    nodeEnv: configs.NODE_ENV,
    allowedOrigins: configs.ALLOWED_ORIGINS || "* (open)",
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── Live stats JSON endpoint — IP-restricted ─────────────────────────────────
app.get("/__stats", ...dashboardProtection, async (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const os = await import("os");
  const upSec = Math.floor(process.uptime());
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();

  const stats = await collectLiveStats();

  res.json({
    db: isDBHealthy(),
    onlineUsers: stats.onlineUsers,
    cpuTemp: stats.cpuTemp,
    cpuSpeed: stats.cpuSpeed,
    cpuSpeedMax: stats.cpuSpeedMax,
    diskUsedGB: stats.diskUsedGB,
    diskTotalGB: stats.diskTotalGB,
    diskPct: stats.diskPct,
    netRxSec: stats.netRxSec,
    netTxSec: stats.netTxSec,
    netIface: stats.netIface,
    processCount: stats.processCount,
    processRunning: stats.processRunning,
    cpuLoadCurrent: stats.cpuLoadCurrent,
    cpuCoresLoad: stats.cpuCoresLoad,
    tenantCounts: stats.tenantCounts,
    redisConnected: stats.redisConnected,
    jobs: stats.jobs,
    requestsPerMinute: stats.requestsPerMinute,
    requestErrorRate: stats.requestErrorRate,
    averageResponseMs: stats.averageResponseMs,
    loadAvg: os.loadavg().map((v) => v.toFixed(2)),
    uptime: `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m ${upSec % 60}s`,
    heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
    heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
    rssMB: (mem.rss / 1024 / 1024).toFixed(1),
    sysUsedGB: (usedMem / 1024 / 1024 / 1024).toFixed(1),
    sysTotalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
    memPct: ((usedMem / totalMem) * 100).toFixed(1),
    ts: Date.now(),
  });
});

// ── Live log tail — Server-Sent Events, IP-restricted ────────────────────────
// One-way stream, no extra deps, works through Nginx as long as buffering is
// disabled for this path (see nginx snippet in the writeup below).
app.get("/__logs/stream", ...dashboardProtection, (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // tell Nginx not to buffer this response
  res.flushHeaders();

  // Replay the buffered tail so a fresh dashboard tab isn't empty
  for (const entry of logBuffer) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  const onLine = (entry: { ts: number; line: string }) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };
  logBus.on("line", onLine);

  // Heartbeat keeps intermediate proxies from closing an idle connection
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    logBus.off("line", onLine);
  });
});

// ── Middleware stack ──────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowed = configs.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    // In development with no origins configured, allow all
    if (allowed.length === 0 && configs.NODE_ENV !== "production") return callback(null, true);
    // In production require explicit allowlist
    if (!origin || isAllowedCorsOrigin(origin, allowed.join(","))) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      TenantModel.exists({
        customDomain: hostname,
        customDomainStatus: "active",
      })
        .then((tenant) =>
          tenant
            ? callback(null, true)
            : callback(new Error(`CORS: origin ${origin} not permitted`)),
        )
        .catch(() => callback(new Error(`CORS: origin ${origin} not permitted`)));
    } catch {
      callback(new Error(`CORS: origin ${origin} not permitted`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Tenant-ID",
    "X-Platform-Context",
    "X-Requested-With",
    "X-Request-ID",
    "Range",
    "Content-Length",
    "ngrok-skip-browser-warning",
    "ipv4",
    "Type",
  ],
};

app
  // 1. Security headers
  .use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: { action: "deny" },
      contentSecurityPolicy:
        configs.NODE_ENV === "production"
          ? {
              directives: {
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
              },
            }
          : false,
    }),
  )
  // 2. CORS — never default to * in production
  .use(cors(corsOptions))
  // 3. Preflight — respond immediately to all OPTIONS requests with same cors config
  .options("*", cors(corsOptions))
  // 4. Request logging
  .use(morgan(configs.NODE_ENV === "production" ? "combined" : "dev"))
  // 5. Rate limiting
  .use(apiLimiter)
  // 5. Body parsers
  .use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buffer) => {
        if (/\/tenant-integrations\/[^/]+\/webhook(?:\?|$)/.test(req.url || "")) {
          (req as Request).rawBody = Buffer.from(buffer);
        }
      },
    }),
  )
  .use(
    express.urlencoded({
      extended: true,
      limit: "10mb",
      verify: (req, _res, buffer) => {
        if (/\/tenant-integrations\/[^/]+\/webhook(?:\?|$)/.test(req.url || "")) {
          (req as Request).rawBody = Buffer.from(buffer);
        }
      },
    }),
  )
  // 6. Cookie parser (signed cookies via JWT_SECRET)
  .use(cookieParser(configs.JWT_SECRET))
  // 7. NoSQL injection sanitizer
  .use(mongoSanitize({ replaceWith: "_" }))
  // 8. HTTP Parameter Pollution protection
  .use(hpp())
  // 9. gzip compression. Never compress SSE: compression middleware can buffer
  // assistant tokens and make a streamed answer appear only after completion.
  .use(
    compression({
      filter: (req, res) => {
        if (req.headers.accept?.includes("text/event-stream")) return false;
        if (req.path.endsWith("/erp-assistant/ask-stream")) return false;
        return compression.filter(req, res);
      },
    }),
  )
  // 10. File upload (25 MB cap, safe filenames)
  .use(
    fileUpload({
      limits: { fileSize: 25 * 1024 * 1024 },
      abortOnLimit: true,
      useTempFiles: false,
      safeFileNames: true,
      preserveExtension: true,
    }),
  )
  .use(tenantResolver)
  .use(businessAuditMiddleware);

// ── Routes & server ───────────────────────────────────────────────────────────
RouterPlugin.setup(app)
  .then(() => ListenerPlugin.listen(app))
  .catch((err) => {
    logger.error("Fatal startup error", err);
  });
