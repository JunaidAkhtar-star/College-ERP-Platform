/**
 * Rate limiters — backed by Redis when available, in-memory otherwise.
 *
 * Redis-backed store ensures limits are shared across all server instances in
 * a horizontally-scaled deployment (fixes the in-memory multi-instance gap).
 *
 * Two limiters:
 *   apiLimiter   — 100 req / 15 min per IP (general API)
 *   authLimiter  — account-scoped auth protection that remains safe behind campus NAT
 */
import type { Store, IncrementResponse } from "express-rate-limit";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { tokenUtil } from "../utils/token.util";
import Redis from "ioredis";
import { logger } from "../utils/logger.util";
import { configs } from "../configs";

// ── Redis-backed store ────────────────────────────────────────────────────────

let redisConnectionLogged = false;
let lastFallbackWarningAt = 0;
const FALLBACK_WARNING_INTERVAL_MS = 60_000;
const MAX_MEMORY_KEYS = 50_000;

class RedisRateLimitStore implements Store {
  private client: Redis | null = null;
  readonly prefix: string;
  private readonly windowMs: number;
  private readonly memory = new Map<string, { totalHits: number; resetTime: Date }>();

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;

    if (configs.REDIS_URL) {
      try {
        this.client = new Redis(configs.REDIS_URL, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: (attempt) => Math.min(250 * 2 ** Math.min(attempt - 1, 5), 10_000),
        });
        this.client.on("connect", () => {
          if (!redisConnectionLogged) {
            redisConnectionLogged = true;
            logger.info("[rate-limit] Redis connected — using Redis-backed rate limiting");
          }
        });
        this.client.on("error", () => {
          // suppress ioredis unhandled-error spam; fallback handled below
        });
        this.client.connect().catch(() => this.warnFallback());
      } catch {
        this.client = null;
      }
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const rKey = `${this.prefix}:${key}`;
    if (this.client?.status === "ready") {
      try {
        const pipeline = this.client.pipeline();
        pipeline.incr(rKey);
        pipeline.pttl(rKey);
        const results = await pipeline.exec();
        const totalHits = (results?.[0]?.[1] as number) ?? 1;
        const ttl = (results?.[1]?.[1] as number) ?? -1;
        if (ttl < 0) {
          await this.client.pexpire(rKey, this.windowMs);
        }
        const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
        return { totalHits, resetTime };
      } catch {
        this.warnFallback();
      }
    }
    this.warnFallback();
    // Emergency per-process fallback keeps enforcing a bounded limit while the
    // distributed store reconnects. Availability must not depend on Redis.
    const now = Date.now();
    if (this.memory.size >= MAX_MEMORY_KEYS) this.pruneMemory(now);
    const existing = this.memory.get(rKey);
    if (!existing || existing.resetTime.getTime() <= now) {
      const next = { totalHits: 1, resetTime: new Date(now + this.windowMs) };
      this.memory.set(rKey, next);
      return next;
    }
    existing.totalHits += 1;
    return existing;
  }

  private warnFallback() {
    const now = Date.now();
    if (now - lastFallbackWarningAt < FALLBACK_WARNING_INTERVAL_MS) return;
    lastFallbackWarningAt = now;
    logger.warn(
      "[rate-limit] Redis unavailable — using bounded in-memory rate limiting while reconnecting",
    );
  }

  private pruneMemory(now: number) {
    for (const [key, value] of this.memory) {
      if (value.resetTime.getTime() <= now) this.memory.delete(key);
    }
    while (this.memory.size >= MAX_MEMORY_KEYS) {
      const oldestKey = this.memory.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.memory.delete(oldestKey);
    }
  }

  async decrement(key: string): Promise<void> {
    if (this.client?.status === "ready") {
      await this.client.decr(`${this.prefix}:${key}`).catch(() => undefined);
      return;
    }
    const item = this.memory.get(`${this.prefix}:${key}`);
    if (item && item.totalHits > 0) item.totalHits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    if (this.client?.status === "ready") {
      await this.client.del(`${this.prefix}:${key}`).catch(() => undefined);
    }
    this.memory.delete(`${this.prefix}:${key}`);
  }
}

// ── Limiter instances ─────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

// Public traffic stays tightly bounded. Authenticated ERP pages fan out across
// many modules, so they receive a separate per-session budget instead of
// competing in one IP bucket (schools commonly share a NAT address).
const API_WINDOW_MS = isDev ? 60 * 1000 : 15 * 60 * 1000;
const PUBLIC_API_MAX = isDev ? 10000 : 120;
const AUTHENTICATED_API_MAX = isDev ? 20000 : 1500;

// Dev: 1 min window, 200 attempts. Prod: 15 min / 10 per tenant+account+IP.
const AUTH_WINDOW_MS = isDev ? 60 * 1000 : 15 * 60 * 1000;
const AUTH_MAX = isDev ? 200 : 10;

export const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: (req) =>
    authenticatedRateIdentity(req.headers.authorization) ? AUTHENTICATED_API_MAX : PUBLIC_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore("rl:api", API_WINDOW_MS),
  keyGenerator: (req) =>
    authenticatedRateIdentity(req.headers.authorization) ??
    `public:${ipKeyGenerator(req.ip ?? "unknown")}`,
  message: {
    success: false,
    error: { message: "Too many requests. Please try again later." },
  },
  skip: (req) => req.method === "OPTIONS",
});

export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: (req) => (req.path === "/refresh-token" ? (isDev ? 500 : 60) : AUTH_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore("rl:auth", AUTH_WINDOW_MS),
  keyGenerator: (req) => {
    const account =
      typeof req.body?.identifier === "string"
        ? req.body.identifier.trim().toLowerCase()
        : typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";
    const tenant =
      typeof req.headers["x-tenant-id"] === "string"
        ? req.headers["x-tenant-id"].trim().toLowerCase()
        : req.hostname.toLowerCase();
    return `${ipKeyGenerator(req.ip ?? "unknown")}:${tenant}:${account || req.path}`;
  },
  message: {
    success: false,
    error: { message: "Too many auth attempts. Please try again later." },
  },
});

function authenticatedRateIdentity(authorization?: string): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const payload = tokenUtil.verifyAccessToken(authorization.slice("Bearer ".length));
    return `authenticated:${payload.tenantId ?? "platform"}:${payload.userId}:${payload.jti ?? "session"}`;
  } catch {
    return null;
  }
}
