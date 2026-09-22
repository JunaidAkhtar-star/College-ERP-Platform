import {
  API_MODULE_ENTITLEMENTS,
  canonicalEntitlementSlug,
  entitlementForPath,
} from "../constants/module-entitlements";
import { ProductModuleModel } from "../models/platform.model";

const normalizeApiFamily = (route: string): string | null => {
  const match = route.trim().match(/^\/?(?:api\/v\d+\/)?([^/?[\]]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
};

const fallbackPermissionModule = (family: string): string =>
  family.toLowerCase().replace(/-/g, "_");

interface PolicyEntry {
  entitlement: string;
  permissionModule: string;
}

let cachedPolicies: Map<string, PolicyEntry> | null = null;

export function invalidatePlatformPolicyCache(): void {
  cachedPolicies = null;
}

async function policies(): Promise<Map<string, PolicyEntry>> {
  if (cachedPolicies) return cachedPolicies;

  const map = new Map<string, PolicyEntry>();
  Object.entries(API_MODULE_ENTITLEMENTS).forEach(([family, entitlement]) => {
    map.set(family, {
      entitlement,
      permissionModule: fallbackPermissionModule(family),
    });
  });

  // Only active catalogue entries may override the stable route-entitlement map.
  // Retired legacy modules remain stored as `maintenance` for audit/history and
  // must never replace a current commercial entitlement with an obsolete slug.
  const modules = await ProductModuleModel.find({ status: "active" })
    .select("slug apiRoute apiRoutes permissionModule")
    .lean();
  modules.forEach((productModule) => {
    const routes = [productModule.apiRoute, ...(productModule.apiRoutes ?? [])];
    routes.forEach((route) => {
      const family = normalizeApiFamily(route);
      if (!family) return;
      map.set(family, {
        entitlement: canonicalEntitlementSlug(productModule.slug),
        permissionModule: productModule.permissionModule || fallbackPermissionModule(family),
      });
    });
  });

  cachedPolicies = map;
  return map;
}

export const platformPolicyService = {
  async entitlementForRequest(path: string): Promise<string | undefined> {
    if (/^\/api\/v1\/tenant-integrations\/[^/?]+\/(?:checkout|webhook)(?:[/?]|$)/.test(path))
      return "fees";
    if (/^\/api\/v1\/parent\//.test(path)) return entitlementForPath(path);
    const family = normalizeApiFamily(path.replace(/^\/api\/v\d+\//i, ""));
    if (!family) return entitlementForPath(path);
    const entitlement = (await policies()).get(family)?.entitlement ?? entitlementForPath(path);
    return entitlement ? canonicalEntitlementSlug(entitlement) : undefined;
  },

  async permissionModuleForRequest(path: string): Promise<string | undefined> {
    const family = normalizeApiFamily(path.replace(/^\/api\/v\d+\//i, ""));
    return family ? (await policies()).get(family)?.permissionModule : undefined;
  },
};
