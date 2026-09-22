import { BackendDomain, type DomainManifest } from "../../platform/domain.types";

export const platformCoreManifest: DomainManifest = {
  id: BackendDomain.PLATFORM_CORE,
  displayName: "Platform Core",
  description: "Devvelocity company administration and product-agnostic commercial operations.",
  routes: [
    "super-admin",
    "tenant-backup",
    "tenant-domain",
    "tenant-integrations",
    "tenant-subscription",
  ],
  capabilities: [
    "tenant-registry",
    "tenant-provisioning",
    "product-catalog",
    "subscriptions",
    "billing",
    "licensing",
    "managed-integrations",
  ],
  dependencies: [BackendDomain.SHARED_FOUNDATION],
};
