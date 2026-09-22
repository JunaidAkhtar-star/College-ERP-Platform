/**
 * @file tenant.middleware.ts
 * @description Express middleware to resolve the active tenant from request headers,
 *              query parameters, or subdomains, and run the request lifecycle within
 *              the tenant's database connection context.
 * @module server/middlewares
 */

import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import {
  getTenantConnection,
  normalizeTenantId,
  tenantLocalStorage,
  waitForActiveConnection,
} from "../configs/connectionManager";
import { TenantModel } from "../models/tenant.model";
import { tokenUtil } from "../utils/token.util";
import { platformPolicyService } from "../services/platform-policy.service";
import { canonicalEntitlementSlug } from "../constants/module-entitlements";
import { configs } from "../configs";
import { SystemRole } from "../constants/roles";

interface CachedTenant {
  record: import("../models/tenant.model").ITenant;
  expiresAt: number;
}

const tenantRecordCache = new Map<string, CachedTenant>();
const TENANT_CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

export function invalidateTenantRecordCache(tenantId?: string): void {
  if (tenantId) tenantRecordCache.delete(normalizeTenantId(tenantId));
  else tenantRecordCache.clear();
}

/**
 * Resolve only hosts owned by the configured tenant wildcard. Treating every
 * three-label hostname as a tenant would turn platform hosts such as
 * `api.devvelocity.in` into a bogus tenant named `api`.
 */
export function managedTenantFromHost(hostname: string, tenantRootDomain: string): string | null {
  const host = hostname.toLowerCase().trim().replace(/\.$/, "").split(":", 1)[0];
  const root = tenantRootDomain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .split(":", 1)[0];

  if (host.endsWith(".localhost")) {
    const candidate = host.slice(0, -".localhost".length);
    return candidate && !candidate.includes(".") ? candidate : null;
  }
  if (!root || host === root || !host.endsWith(`.${root}`)) return null;
  const candidate = host.slice(0, -(root.length + 1));
  return candidate && !candidate.includes(".") ? candidate : null;
}

/**
 * Middleware that resolves the tenant, validates their subscription/active status,
 * and executes the request within the AsyncLocalStorage context of the tenant connection.
 */
export async function tenantResolver(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Bypass tenant resolution for non-API routes, health check, or SaaS control center
  const path = req.path;
  const apiPrefix = `/${configs.API_VERSION.replace(/^\/+|\/+$/g, "")}/`;
  const isPlatformAuthRequest =
    req.headers["x-platform-context"] === "true" &&
    [
      "/api/v1/auth/login",
      "/api/v1/auth/mfa/login-verify",
      "/api/v1/auth/refresh-token",
      "/api/v1/auth/forgot-password",
      "/api/v1/auth/reset-password",
    ].includes(path);
  const isPlatformSsoRequest =
    req.headers["x-platform-context"] === "true" && path.startsWith("/api/v1/sso/");
  const isPlatformSelfServiceRequest =
    req.headers["x-platform-context"] === "true" &&
    (path === "/api/v1/user/me" ||
      path.startsWith("/api/v1/user/me/") ||
      [
        "/api/v1/auth/change-password",
        "/api/v1/auth/mfa/setup",
        "/api/v1/auth/mfa/verify",
        "/api/v1/auth/mfa/disable",
      ].includes(path));
  if (
    !path.startsWith(apiPrefix) ||
    path === "/" ||
    path.startsWith("/__") ||
    path.startsWith("/api-docs") ||
    path.includes("/health") ||
    path.startsWith("/api/v1/super-admin") ||
    path === "/api/v1/tenant-domain/active" ||
    path === "/api/v1/tenant-domain/resolve" ||
    path === "/api/v1/tenant-domain/access-status" ||
    path === "/api/v1/tenant-backup/google/callback" ||
    isPlatformAuthRequest ||
    isPlatformSsoRequest ||
    isPlatformSelfServiceRequest
  ) {
    next();
    return;
  }

  // Bypass tenant resolution for SaaS global Super Admins
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payload = tokenUtil.verifyAccessToken(token);
      if (payload && payload.role === SystemRole.SUPER_ADMIN && !payload.tenantId) {
        next();
        return;
      }
    } catch {
      // Ignore token verification errors here, handled in authentication middleware
    }
  }

  let tenantId: string | undefined;

  // A verified tenant-bound access token is the authoritative identity. This
  // prevents stale cookies or role-like path segments from selecting another
  // tenant after a reload. A conflicting explicit header fails closed.
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (bearerToken) {
    try {
      const payload = tokenUtil.verifyAccessToken(bearerToken);
      if (payload.tenantId) {
        const requestedTenant =
          typeof req.headers["x-tenant-id"] === "string"
            ? normalizeTenantId(req.headers["x-tenant-id"])
            : undefined;
        const tokenTenant = normalizeTenantId(payload.tenantId);
        if (requestedTenant && requestedTenant !== tokenTenant) {
          next(createError(403, "Tenant context does not match the authenticated session."));
          return;
        }
        tenantId = tokenTenant;
      }
    } catch (error) {
      // Do not turn an expired authenticated request into the misleading
      // "tenant header required" response. Authentication expiry is a normal
      // 401 contract that clients know how to refresh and retry.
      if (
        error instanceof Error &&
        ["TokenExpiredError", "JsonWebTokenError"].includes(error.name)
      ) {
        next(error);
        return;
      }
    }
  }

  // 1. Resolve from custom header
  const headerTenant = req.headers["x-tenant-id"];
  if (!tenantId && typeof headerTenant === "string") {
    tenantId = headerTenant;
  }

  // 2. Resolve from query param (fallback)
  if (!tenantId && typeof req.query.tenantId === "string") {
    tenantId = req.query.tenantId;
  }

  // 3. Resolve from a verified custom domain or the managed subdomain.
  if (!tenantId) {
    const host = (req.hostname || "").toLowerCase().replace(/\.$/, "");
    const customTenant = await TenantModel.findOne({
      customDomain: host,
      customDomainStatus: "active",
    })
      .select("tenantId")
      .lean()
      .exec();
    if (customTenant) tenantId = customTenant.tenantId;

    if (!tenantId) {
      tenantId = managedTenantFromHost(host, configs.TENANT_ROOT_DOMAIN) ?? undefined;
    }
  }

  if (!tenantId) {
    next(createError(400, "X-Tenant-ID header or valid tenant subdomain is required."));
    return;
  }

  try {
    const sanitizedId = normalizeTenantId(tenantId);
    let tenantRecord: import("../models/tenant.model").ITenant | null = null;
    const cached = tenantRecordCache.get(sanitizedId);
    if (cached && cached.expiresAt > Date.now()) {
      tenantRecord = cached.record;
    } else {
      tenantRecord = (await TenantModel.findOne({ tenantId: sanitizedId })
        .lean()
        .exec()) as unknown as import("../models/tenant.model").ITenant | null;
      if (tenantRecord) {
        tenantRecordCache.set(sanitizedId, {
          record: tenantRecord,
          expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
        });
      }
    }
    if (!tenantRecord) {
      next(createError(404, `Tenant '${tenantId}' does not exist.`));
      return;
    }

    if (tenantRecord.status !== "active") {
      next(
        createError(
          403,
          `Tenant subscription for '${tenantRecord.name}' is currently ${tenantRecord.status}.`,
        ),
      );
      return;
    }

    const now = Date.now();
    const billingStatus = tenantRecord.billingStatus ?? "active";
    if (
      tenantRecord.subscriptionExpiresAt &&
      new Date(tenantRecord.subscriptionExpiresAt).getTime() < now &&
      !["trialing", "free"].includes(billingStatus)
    ) {
      next(createError(403, `Tenant subscription for '${tenantRecord.name}' has expired.`));
      return;
    }

    const trialActive =
      billingStatus === "trialing" &&
      Boolean(tenantRecord.trialEndsAt && new Date(tenantRecord.trialEndsAt).getTime() >= now);
    const graceActive =
      billingStatus === "past_due" &&
      Boolean(tenantRecord.graceEndsAt && new Date(tenantRecord.graceEndsAt).getTime() >= now);
    const billingActive = ["active", "free"].includes(billingStatus);
    if (!billingActive && !trialActive && !graceActive) {
      next(
        createError(
          402,
          billingStatus === "trialing"
            ? `The trial for '${tenantRecord.name}' has ended.`
            : `Billing access for '${tenantRecord.name}' is ${billingStatus}.`,
        ),
      );
      return;
    }

    const requiredModule = await platformPolicyService.entitlementForRequest(
      req.originalUrl || req.path,
    );
    const firstYearMeetingBenefitActive =
      requiredModule === "virtual-classrooms" &&
      Boolean(
        tenantRecord.unlimitedMeetingsUntil &&
        new Date(tenantRecord.unlimitedMeetingsUntil).getTime() >= now,
      );
    if (
      requiredModule &&
      tenantRecord.entitlementEnforced &&
      !tenantRecord.enabledModuleSlugs
        .map(canonicalEntitlementSlug)
        .includes(canonicalEntitlementSlug(requiredModule)) &&
      !firstYearMeetingBenefitActive
    ) {
      next(
        createError(
          403,
          `The '${requiredModule}' module is not included in this tenant's subscription.`,
          {
            code: "SUBSCRIPTION_MODULE_REQUIRED",
            details: { module: requiredModule },
          },
        ),
      );
      return;
    }

    await waitForActiveConnection();
    const tenantDb = getTenantConnection(sanitizedId, tenantRecord.databaseName);

    // Attach resolved properties to the Express request
    req.tenantId = sanitizedId;
    req.tenantDb = tenantDb;
    req.enabledModuleSlugs = tenantRecord.enabledModuleSlugs;
    req.entitlementEnforced = tenantRecord.entitlementEnforced;

    // Execute the request lifecycle in the AsyncLocalStorage context
    tenantLocalStorage.run({ tenantId: sanitizedId, tenantDb }, () => {
      next();
    });
  } catch (err) {
    next(err);
  }
}
