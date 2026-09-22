import { configs } from "../configs";
import { TenantModel } from "../models/tenant.model";

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

/** Resolve the browser origin that should be used for tenant-scoped email links. */
export async function tenantAppBaseUrl(tenantId: string): Promise<string> {
  const normalizedTenantId = tenantId.trim().toLowerCase();
  const tenant = await TenantModel.findOne({ tenantId: normalizedTenantId })
    .select("customDomain customDomainStatus")
    .lean()
    .exec();

  if (tenant?.customDomain && tenant.customDomainStatus === "active") {
    return `https://${withoutTrailingSlash(tenant.customDomain)}`;
  }

  return withoutTrailingSlash(
    configs.TENANT_APP_URL_TEMPLATE.replace("{tenant}", normalizedTenantId),
  );
}

import type { Request } from "express";
import { tenantLocalStorage } from "../configs/connectionManager";

export async function tenantActivationUrl(tenantId: string, token: string): Promise<string> {
  const origin = await tenantAppBaseUrl(tenantId);
  return `${origin}/auth/activate?token=${encodeURIComponent(token)}`;
}

/**
 * Resolve the dynamic application base URL for tenant links from current request headers
 * or active AsyncLocalStorage tenant context, falling back to global FRONTEND_URL.
 */
export function resolveRequestAppBaseUrl(req?: Request): string {
  if (req) {
    const originHeader = req.headers.origin || req.headers.referer;
    if (originHeader) {
      try {
        const parsed = new URL(originHeader);
        return withoutTrailingSlash(parsed.origin);
      } catch {
        /* ignore invalid URL */
      }
    }
    const host = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http") as string;
    if (host) {
      return withoutTrailingSlash(`${proto}://${host}`);
    }
  }

  const tenantId = tenantLocalStorage.getStore()?.tenantId;
  if (tenantId && tenantId !== "global") {
    return withoutTrailingSlash(
      configs.TENANT_APP_URL_TEMPLATE.replace("{tenant}", tenantId.trim().toLowerCase()),
    );
  }

  return withoutTrailingSlash(configs.FRONTEND_URL);
}
