/**
 * @file domain-registry.ts
 * @description Resolves and validates ownership boundaries for backend route modules.
 */

import { backendDomainManifests } from "../domains";
import { BackendDomain, type BackendDomainId, type RouteModuleDefinition } from "./domain.types";

const explicitRouteOwners = new Map<string, BackendDomainId>();
for (const manifest of backendDomainManifests) {
  for (const route of manifest.routes) {
    if (explicitRouteOwners.has(route)) {
      throw new Error(`Route module "${route}" is owned by more than one backend domain`);
    }
    explicitRouteOwners.set(route, manifest.id);
  }
}

export function resolveBackendDomain(route: string): BackendDomainId {
  return explicitRouteOwners.get(route) ?? BackendDomain.COLLEGE_ERP;
}

export function defineRouteModules(routes: string[]): RouteModuleDefinition[] {
  const uniqueRoutes = new Set(routes);
  if (uniqueRoutes.size !== routes.length)
    throw new Error("Duplicate backend route modules detected");

  return routes
    .map((route) => ({ route, domain: resolveBackendDomain(route) }))
    .sort((left, right) => {
      const domainOrder = left.domain.localeCompare(right.domain);
      return domainOrder === 0 ? left.route.localeCompare(right.route) : domainOrder;
    });
}

export function summarizeRouteDomains(
  definitions: RouteModuleDefinition[],
): Record<BackendDomainId, number> {
  const summary: Record<BackendDomainId, number> = {
    [BackendDomain.PLATFORM_CORE]: 0,
    [BackendDomain.SHARED_FOUNDATION]: 0,
    [BackendDomain.COLLEGE_ERP]: 0,
  };
  for (const definition of definitions) summary[definition.domain] += 1;
  return summary;
}

export function validateDomainArchitecture(routes: string[]): void {
  const routeSet = new Set(routes);
  for (const [route, owner] of explicitRouteOwners) {
    if (!routeSet.has(route)) {
      throw new Error(`Domain "${owner}" declares missing route module "${route}"`);
    }
  }

  const manifestIds = new Set(backendDomainManifests.map((manifest) => manifest.id));
  for (const manifest of backendDomainManifests) {
    for (const dependency of manifest.dependencies) {
      if (!manifestIds.has(dependency)) {
        throw new Error(`Domain "${manifest.id}" has unknown dependency "${dependency}"`);
      }
      if (dependency === manifest.id) {
        throw new Error(`Domain "${manifest.id}" cannot depend on itself`);
      }
    }
  }
}
