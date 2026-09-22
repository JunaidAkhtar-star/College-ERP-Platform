import { config } from "dotenv";
import mongoose from "mongoose";
import { logger } from "../utils/logger.util";
import { patchMongooseModel } from "./connectionManager";
import { validateProductionEnvironment } from "../utils/environment.util";

config();
patchMongooseModel();

const configs = {
  PORT: process.env.PORT || "5000",
  API_VERSION: process.env.API_VERSION || "api/v1",
  HOST: process.env.HOST || "localhost",
  NODE_ENV: process.env.NODE_ENV || "development",
  JOB_RUNTIME_MODE: ["all", "api", "worker"].includes(process.env.JOB_RUNTIME_MODE ?? "")
    ? (process.env.JOB_RUNTIME_MODE as "all" | "api" | "worker")
    : "all",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  AUDIT_HMAC_SECRET: process.env.AUDIT_HMAC_SECRET || "",

  // Database
  MONGODB_URI: process.env.MONGODB_URI || "",
  MASTER_DB_NAME: process.env.MASTER_DB_NAME || "devvelocity_master",
  MONGO_QUERY_MAX_TIME_MS: Math.max(
    1_000,
    parseInt(process.env.MONGO_QUERY_MAX_TIME_MS || "30000", 10) || 30_000,
  ),

  // App
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  APP_NAME: process.env.APP_NAME || "Devvelocity",
  PLATFORM_WEBSITE_URL: process.env.PLATFORM_WEBSITE_URL || "https://devvelocity.in",
  PLATFORM_LOGO_URL: process.env.PLATFORM_LOGO_URL || "https://devvelocity.in/devvelocitylogo.webp",
  TENANT_APP_URL_TEMPLATE: process.env.TENANT_APP_URL_TEMPLATE || "http://{tenant}.localhost:3000",
  TENANT_ROOT_DOMAIN: process.env.TENANT_ROOT_DOMAIN || "erp.devvelocity.in",
  TENANT_CNAME_TARGET: process.env.TENANT_CNAME_TARGET || "tenants.erp.devvelocity.in",

  // Gemini API
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest",
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "z-ai/glm-5.2:free",
  ERP_ASSISTANT_HISTORY_RETENTION_DAYS: Math.max(
    1,
    parseInt(process.env.ERP_ASSISTANT_HISTORY_RETENTION_DAYS || "7", 10) || 7,
  ),
  // Cache
  REDIS_URL: process.env.REDIS_URL || "",
  RABBITMQ_URL: process.env.RABBITMQ_URL || "",
  RABBITMQ_PREFETCH: Math.min(
    1_000,
    Math.max(1, parseInt(process.env.RABBITMQ_PREFETCH || "10", 10) || 10),
  ),

  // Encryption (AES-256 key — 64 hex chars = 32 bytes)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "",

  // CORS — comma-separated list of allowed origins
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",

  // Admin IP whitelist — comma-separated CIDRs/IPs for sensitive routes
  ADMIN_IP_WHITELIST: process.env.ADMIN_IP_WHITELIST || "",
  DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME || "",
  DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || "",
  TRUST_PROXY_HOPS: Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS || "0", 10) || 0),
  CONNECTOR_EGRESS_HOSTS: process.env.CONNECTOR_EGRESS_HOSTS || "",
  CONNECTOR_WEBHOOK_BASE_URL: process.env.CONNECTOR_WEBHOOK_BASE_URL || "",

  // Tenant database archive tooling (provider credentials are configured dynamically)
  MONGODUMP_PATH: process.env.MONGODUMP_PATH || "mongodump",

  // Institution / College
  COLLEGE_NAME: process.env.COLLEGE_NAME || "Institution",

  // Puppeteer (PDF generation)
  PUPPETEER_EXEC_PATH: process.env.PUPPETEER_EXEC_PATH || "",

  // Data retention (cleanup job) — days. Set to 0 to disable that sweep.
  NOTIFICATION_RETENTION_DAYS: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || "30", 10),
  AUDIT_LOG_RETENTION_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "90", 10),
  SOFT_DELETE_PURGE_DAYS: parseInt(process.env.SOFT_DELETE_PURGE_DAYS || "30", 10),
  ACTIVE_SESSION_RETENTION_DAYS: parseInt(process.env.ACTIVE_SESSION_RETENTION_DAYS || "7", 10),
  NOTICE_READ_RETENTION_DAYS: parseInt(process.env.NOTICE_READ_RETENTION_DAYS || "180", 10),
  DELETED_CHAT_MESSAGE_RETENTION_DAYS: parseInt(
    process.env.DELETED_CHAT_MESSAGE_RETENTION_DAYS || "30",
    10,
  ),
};

// ── Critical environment variable validation ─────────────────────────────────
const REQUIRED_ENV: (keyof typeof configs)[] = ["JWT_SECRET", "JWT_REFRESH_SECRET", "MONGODB_URI"];
const missing = REQUIRED_ENV.filter((k) => !configs[k]);
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(", ")}`, {
    hint: "Set them in your .env file before starting the server",
  });
  process.exit(1);
}
const productionEnvironmentErrors = validateProductionEnvironment(configs);
if (productionEnvironmentErrors.length > 0) {
  logger.error("Invalid production environment configuration", {
    errors: productionEnvironmentErrors,
  });
  process.exit(1);
}

mongoose.set("maxTimeMS", configs.MONGO_QUERY_MAX_TIME_MS);

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  dbName: configs.MASTER_DB_NAME,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  retryWrites: true,
  retryReads: true,
};

// Mongoose v9 deprecated `returnDocument: "after"` in favour of `returnDocument: "after"`.
// Every findOneAndUpdate / findOneAndReplace call site uses returnDocument: "after".

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
let retryCount = 0;
let isConnecting = false;

const scheduleReconnect = (): void => {
  if (isConnecting) return;
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
  if (retryCount >= MAX_RETRIES) {
    logger.error(`MongoDB — max retries (${MAX_RETRIES}) exceeded.`);
    return;
  }
  const delay = RETRY_BASE_DELAY_MS * 2 ** retryCount;
  retryCount++;
  logger.warn(`MongoDB reconnect attempt ${retryCount}/${MAX_RETRIES} in ${delay} ms…`);
  setTimeout(() => connectDB(), delay);
};

const connectDB = async (): Promise<void> => {
  if (isConnecting || mongoose.connection.readyState === 1) return;
  isConnecting = true;

  try {
    logger.db("Connecting to MongoDB…");
    const conn = await mongoose.connect(configs.MONGODB_URI, MONGO_OPTIONS);
    retryCount = 0;
    logger.db(`Connected — host: ${conn.connection.host}`);
  } catch (error) {
    logger.error("MongoDB Connection Failed", error);
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
};

// ── Connection lifecycle events ──────────────────────────────────────────────

mongoose.connection.on("connected", () => {
  retryCount = 0;
  logger.db("Connection established");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB Disconnected — scheduling reconnect…");
  scheduleReconnect();
});

mongoose.connection.on("reconnected", () => {
  retryCount = 0;
  logger.db("Reconnected");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB driver error", err);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
// NOTE: Shutdown is owned by `listener.plugin.ts` so it can close HTTP +
// Socket.IO + Mongo in the correct order. Do NOT register SIGINT/SIGTERM
// handlers here — a second handler would race and preempt the listener's
// clean shutdown via process.exit, dropping in-flight requests and sockets.

// ── Health helper ────────────────────────────────────────────────────────────

const isDBHealthy = (): boolean =>
  mongoose.connection.readyState === mongoose.ConnectionStates.connected;

export { configs, connectDB, isDBHealthy };
