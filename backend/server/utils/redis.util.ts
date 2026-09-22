/**
 * Redis client — thin wrapper around ioredis.
 * Connects lazily; all cache operations are no-ops if Redis is unavailable
 * so the app degrades gracefully without Redis in development.
 */
import Redis from "ioredis";
import { logger } from "./logger.util";
import { configs } from "../configs";
import { tenantLocalStorage } from "../configs/connectionManager";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

let client: Redis | null = null;
let connected = false;

export function tenantCacheKey(
  key: string,
  tenantId = tenantLocalStorage.getStore()?.tenantId,
): string {
  return `${tenantId ? `tenant:${tenantId}` : "master"}:${key}`;
}

function getClient(): Redis | null {
  if (client) return client;
  if (!configs.REDIS_URL && configs.NODE_ENV === "production") {
    logger.warn("[redis] REDIS_URL not set — caching disabled");
    return null;
  }
  try {
    client = new Redis(configs.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (attempt) => Math.min(250 * 2 ** Math.min(attempt - 1, 5), 10_000),
    });
    client.on("connect", () => {
      connected = true;
      logger.info("[redis] Connected");
    });
    client.on("error", (err) => {
      connected = false;
      logger.warn(`[redis] Error: ${err.message}`);
    });
    client.connect().catch(() => {
      /* handled by error event */
    });
    return client;
  } catch {
    return null;
  }
}

export const redisUtil = {
  isConnected: () => connected,

  async healthCheck(timeoutMs = 4_000): Promise<boolean> {
    const c = getClient();
    if (!c) return false;
    const deadline = Date.now() + timeoutMs;
    while (c.status !== "ready" && Date.now() < deadline) {
      // `wait` is ioredis' lazy-connect state and `connecting` is the active
      // handshake. Both are normal during process startup. Terminal states
      // cannot become ready because this client intentionally disables retry.
      if (c.status !== "wait" && c.status !== "connecting" && c.status !== "connect") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (c.status !== "ready") return false;
    try {
      await c.ping();
      connected = true;
      return true;
    } catch {
      connected = false;
      return false;
    }
  },

  async get<T>(key: string): Promise<T | null> {
    const c = getClient();
    if (!c || !connected) return null;
    try {
      const val = await c.get(tenantCacheKey(key));
      return val ? (JSON.parse(val) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    const c = getClient();
    if (!c || !connected) return;
    try {
      await c.set(tenantCacheKey(key), JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      /* ignore */
    }
  },

  async del(...keys: string[]): Promise<void> {
    const c = getClient();
    if (!c || !connected) return;
    try {
      await c.del(...keys.map((key) => tenantCacheKey(key)));
    } catch {
      /* ignore */
    }
  },

  async delPattern(pattern: string): Promise<void> {
    const c = getClient();
    if (!c || !connected) return;
    try {
      let cursor = "0";
      do {
        const [next, keys] = await c.scan(cursor, "MATCH", tenantCacheKey(pattern), "COUNT", 100);
        cursor = next;
        if (keys.length) await c.del(...keys);
      } while (cursor !== "0");
    } catch {
      /* ignore */
    }
  },

  async consumeFixedWindow(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const c = getClient();
    if (!c || !connected) {
      if (configs.NODE_ENV === "production")
        throw new Error("Distributed provider rate limit is unavailable");
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const namespaced = tenantCacheKey(key);
    const result = (await c.eval(
      `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
        local ttl = redis.call('TTL', KEYS[1])
        return {current, ttl}
      `,
      1,
      namespaced,
      windowSeconds,
    )) as [number, number];
    return {
      allowed: Number(result[0]) <= limit,
      retryAfterSeconds: Math.max(1, Number(result[1])),
    };
  },

  /** Cache-aside helper: return cached or compute + store */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await redisUtil.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await compute();
    await redisUtil.set(key, fresh, ttlSeconds);
    return fresh;
  },
};
