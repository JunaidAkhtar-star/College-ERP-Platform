import { AuditLogModel } from "../models/audit-log.model";
import type { IUser } from "../models/user.model";
import type { Request } from "express";
import { createHmac, randomUUID } from "crypto";
import { configs } from "../configs";

interface CreateAuditLogParams {
  user?: IUser | null;
  action: string;
  module: string;
  targetId?: string;
  targetModel?: string;
  description: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  req?: Request;
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";

  const obj = value as Record<string, unknown>;

  if (value && typeof obj.toHexString === "function") {
    return JSON.stringify((obj.toHexString as () => string)());
  }

  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;

  if (value && typeof value === "object") {
    let plain: unknown = value;
    if (typeof obj.toObject === "function") {
      plain = (obj.toObject as () => unknown)();
    } else if (typeof obj.toJSON === "function") {
      plain = (obj.toJSON as () => unknown)();
    }

    if (typeof plain !== "object" || plain === null) {
      return JSON.stringify(plain);
    }

    const record = plain as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter(
        (key) => !key.startsWith("$") && !key.startsWith("_") && typeof record[key] !== "function",
      )
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const auditLogRepository = {
  async create(params: CreateAuditLogParams) {
    const createdAt = new Date();
    const event = {
      userId: params.user?._id,
      userName: params.user?.name,
      userRole: params.req?.activeRole ?? params.user?.roles?.[0],
      roleId: params.req?.activeRoleId,
      tenantId: params.req?.tenantId,
      requestId:
        typeof params.req?.headers["x-request-id"] === "string"
          ? params.req.headers["x-request-id"]
          : randomUUID(),
      action: params.action,
      module: params.module,
      targetId: params.targetId,
      targetModel: params.targetModel,
      description: params.description,
      metadata: params.metadata,
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers["user-agent"],
      reason: params.reason,
      createdAt,
    };
    const eventHash = createHmac("sha256", configs.AUDIT_HMAC_SECRET || configs.JWT_SECRET)
      .update(canonical(event))
      .digest("hex");
    return AuditLogModel.create({ ...event, eventHash, hashVersion: 1 });
  },

  async paginate(filter: Record<string, unknown>, page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      AuditLogModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
