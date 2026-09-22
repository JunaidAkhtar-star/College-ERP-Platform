import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.util";
import { configs } from "../configs";

interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: string | number;
  meta?: { cause?: string };
  details?: unknown;
}

/**
 * Centralized error handler.
 * Maps known error types to appropriate HTTP status codes and response shapes.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let status = err.status ?? err.statusCode ?? 500;
  let message = err.message ?? "Something went wrong";

  // Mongoose duplicate key
  if (Number(err.code) === 11000) {
    status = 409;
    message = "A record with this value already exists";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Token has expired";
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid ID format";
  }

  if (err.name === "ValidationError") {
    status = 400;
    message = err.message || "Validation failed";
  }

  // Authentication expiry and other expected client failures are operational
  // outcomes, not server faults. Keep error telemetry actionable and avoid a
  // full stack trace for every normal token renewal.
  if (configs.NODE_ENV !== "test") {
    const summary = `${err.name ?? "Error"} — ${message}`;
    if (status >= 500) logger.error(summary, err);
    else if (status === 429) logger.warn(summary, { status });
    else if (status !== 401)
      logger.warn(summary, { status, ...(err.details ? { details: err.details } : {}) });
    else logger.debug(summary, { status });
  }

  res.status(status).json({
    success: false,
    error: {
      code: typeof err.code === "string" ? err.code : undefined,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
