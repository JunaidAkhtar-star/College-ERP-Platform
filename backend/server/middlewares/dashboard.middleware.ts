import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { configs } from "../configs";
import { ipWhitelist } from "./ip-whitelist.middleware";
import { logger } from "../utils/logger.util";

const dashboardHeaders = helmet({
  crossOriginResourcePolicy: { policy: "same-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
});

const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: configs.NODE_ENV === "production" ? 600 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Dashboard request limit exceeded",
});

function safelyEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireDashboardCredentials(req: Request, res: Response, next: NextFunction): void {
  const configured = Boolean(configs.DASHBOARD_USERNAME && configs.DASHBOARD_PASSWORD);
  if (!configured && configs.NODE_ENV !== "production") {
    next();
    return;
  }
  if (!configured) {
    res.status(503).send("Operational dashboard credentials are not configured");
    return;
  }
  if (configs.NODE_ENV === "production" && configs.DASHBOARD_PASSWORD.length < 16) {
    res.status(503).send("Operational dashboard password must contain at least 16 characters");
    return;
  }

  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  const decoded = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString() : "";
  const separator = decoded.indexOf(":");
  const username = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";
  if (
    !safelyEqual(username, configs.DASHBOARD_USERNAME) ||
    !safelyEqual(password, configs.DASHBOARD_PASSWORD)
  ) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Devvelocity Operations", charset="UTF-8"');
    res.status(401).send("Authentication required");
    return;
  }
  next();
}

function requireProductionWhitelist(_req: Request, res: Response, next: NextFunction): void {
  if (configs.NODE_ENV === "production" && !configs.ADMIN_IP_WHITELIST.trim()) {
    res.status(503).send("Operational dashboard IP whitelist is not configured");
    return;
  }
  next();
}

function auditDashboardAccess(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  res.on("finish", () => {
    logger.info(
      `[operations-dashboard] ${req.method} ${req.path} status=${res.statusCode} ip=${req.ip || "unknown"}`,
    );
  });
  next();
}

export const dashboardProtection = [
  dashboardHeaders,
  dashboardLimiter,
  auditDashboardAccess,
  requireProductionWhitelist,
  ipWhitelist,
  requireDashboardCredentials,
];
