import type { NextFunction, Request, Response } from "express";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { permissionForRequest } from "../constants/route-permissions";
import { logger } from "../utils/logger.util";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_KEY = /password|secret|token|authorization|cookie|otp|mfa|signature|privateKey/i;

export function shouldAuditBusinessMutation(input: {
  method: string;
  statusCode: number;
  authenticated: boolean;
  baseUrl: string;
}) {
  return (
    MUTATIONS.has(input.method) &&
    input.authenticated &&
    input.statusCode >= 200 &&
    input.statusCode < 400 &&
    !input.baseUrl.endsWith("/audit-log")
  );
}

function safeSnapshot(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safeSnapshot(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}…`;
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : safeSnapshot(nested, depth + 1);
  }
  return result;
}

function responseEntity(payload: unknown): { targetId?: string; after?: unknown } {
  if (!payload || typeof payload !== "object") return {};
  const body = payload as Record<string, unknown>;
  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return { after: safeSnapshot(data) };
  const record = data as Record<string, unknown>;
  return {
    targetId: typeof record._id === "string" ? record._id : undefined,
    after: safeSnapshot(record),
  };
}

export function businessAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  let responsePayload: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responsePayload = body;
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    if (
      !shouldAuditBusinessMutation({
        method: req.method,
        statusCode: res.statusCode,
        authenticated: Boolean(req.user),
        baseUrl: req.baseUrl,
      })
    )
      return;
    const permission = permissionForRequest(req);
    const entity = responseEntity(responsePayload);
    const routeFamily = req.baseUrl.split("/").filter(Boolean).at(-1) ?? "unknown";
    const targetId = entity.targetId ?? req.params.id ?? req.params._id;
    void auditLogRepository
      .create({
        user: req.user,
        action: `BUSINESS_${req.method}_${routeFamily.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`,
        module: permission?.module ?? routeFamily,
        targetId,
        targetModel: routeFamily,
        description: `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`,
        reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
        metadata: {
          source: "central_mutation_audit",
          permission: permission
            ? { module: permission.module, action: permission.action }
            : undefined,
          requestedChanges: safeSnapshot(req.body),
          after: entity.after,
          statusCode: res.statusCode,
        },
        req,
      })
      .catch((error) => {
        logger.error("Central business audit write failed", {
          requestId: req.headers["x-request-id"],
          method: req.method,
          path: req.originalUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
  next();
}
