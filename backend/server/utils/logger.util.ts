/**
 * logger.util.ts
 * Lightweight structured logger — no external dependencies.
 *
 * Development : coloured, human-readable, one line per entry.
 * Production  : JSON lines (stdout), ready for log-aggregators.
 *
 * Usage:
 *   import { logger } from "../utils/logger.util";
 *   logger.info("Server started", { port: 5000 });
 *   logger.error("DB failed", err);
 */

const IS_PROD = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const R = "\x1b[0m"; // reset
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const c = {
  grey: (s: string) => `\x1b[90m${s}${R}`,
  cyan: (s: string) => `\x1b[36m${s}${R}`,
  green: (s: string) => `\x1b[32m${s}${R}`,
  yellow: (s: string) => `\x1b[33m${s}${R}`,
  red: (s: string) => `\x1b[31m${s}${R}`,
  magenta: (s: string) => `\x1b[35m${s}${R}`,
  blue: (s: string) => `\x1b[34m${s}${R}`,
  bold: (s: string) => `${BOLD}${s}${R}`,
  dim: (s: string) => `${DIM}${s}${R}`,
};

// ── Level config ──────────────────────────────────────────────────────────────
type Level = "debug" | "info" | "warn" | "error" | "db" | "cron" | "http" | "socket";

const LEVEL_META: Record<
  Level,
  { label: string; colour: (s: string) => string; stream: "out" | "err" }
> = {
  debug: { label: "DEBUG ", colour: c.grey, stream: "out" },
  info: { label: "INFO  ", colour: c.cyan, stream: "out" },
  warn: { label: "WARN  ", colour: c.yellow, stream: "err" },
  error: { label: "ERROR ", colour: c.red, stream: "err" },
  db: { label: "DB    ", colour: c.green, stream: "out" },
  cron: { label: "CRON  ", colour: c.magenta, stream: "out" },
  http: { label: "HTTP  ", colour: c.blue, stream: "out" },
  socket: { label: "SOCKET", colour: c.cyan, stream: "out" },
};

// ── Timestamp ─────────────────────────────────────────────────────────────────
function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

// ── Error serialiser ──────────────────────────────────────────────────────────
function serializeError(err: unknown): {
  message: string;
  name: string;
  stack?: string;
  code?: string | number;
  [k: string]: unknown;
} {
  if (err instanceof Error) {
    const e = err as Error & {
      code?: string | number;
      status?: number;
      statusCode?: number;
      details?: unknown;
    };
    return {
      name: e.name,
      message: e.message,
      code: e.code,
      status: e.status ?? e.statusCode,
      details: e.details,
      stack: e.stack,
    };
  }
  return { name: "UnknownError", message: String(err) };
}

// ── Core emit ─────────────────────────────────────────────────────────────────
function emit(level: Level, message: string, extra?: unknown): void {
  if (IS_TEST) return;

  const meta = LEVEL_META[level];

  if (IS_PROD) {
    // JSON lines — machine-parseable
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level: level.trim(),
      message,
    };
    if (extra !== undefined) {
      entry.data = extra instanceof Error ? serializeError(extra) : extra;
    }
    const line = JSON.stringify(entry);
    if (meta.stream === "err") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
    return;
  }

  // ── Dev pretty-print ───────────────────────────────────────────────────────
  const timestamp = c.dim(ts());
  const badge = meta.colour(c.bold(`[${meta.label.trimEnd()}]`));
  const msg = meta.stream === "err" ? c.bold(message) : message;

  const parts: string[] = [`${timestamp}  ${badge}  ${msg}`];

  if (extra !== undefined) {
    if (extra instanceof Error) {
      const e = serializeError(extra);
      if (e.name && e.name !== "Error") parts.push(c.yellow(`  ↳ ${e.name}: ${e.message}`));
      else parts.push(c.yellow(`  ↳ ${e.message}`));
      if (e.code) parts.push(c.grey(`  ↳ code    : ${e.code}`));
      if (e.status) parts.push(c.grey(`  ↳ status  : ${e.status}`));
      if (e.details) parts.push(c.grey(`  ↳ details : ${JSON.stringify(e.details)}`));
      if (e.stack) {
        const frames = e.stack
          .split("\n")
          .slice(1)
          .filter((l) => !l.includes("node_modules") && !l.includes("node:internal"))
          .slice(0, 5);
        if (frames.length) parts.push(c.grey(frames.map((f) => `       ${f.trim()}`).join("\n")));
      }
    } else if (typeof extra === "object" && extra !== null) {
      parts.push(c.grey(`  ↳ ${JSON.stringify(extra)}`));
    } else {
      parts.push(c.grey(`  ↳ ${extra}`));
    }
  }

  const out = parts.join("\n");
  if (meta.stream === "err") process.stderr.write(`${out}\n`);
  else process.stdout.write(`${out}\n`);
}

// ── Public API ────────────────────────────────────────────────────────────────
export const logger = {
  debug: (msg: string, extra?: unknown) => emit("debug", msg, extra),
  info: (msg: string, extra?: unknown) => emit("info", msg, extra),
  warn: (msg: string, extra?: unknown) => emit("warn", msg, extra),
  error: (msg: string, extra?: unknown) => emit("error", msg, extra),
  db: (msg: string, extra?: unknown) => emit("db", msg, extra),
  cron: (msg: string, extra?: unknown) => emit("cron", msg, extra),
  http: (msg: string, extra?: unknown) => emit("http", msg, extra),
  socket: (msg: string, extra?: unknown) => emit("socket", msg, extra),
};
