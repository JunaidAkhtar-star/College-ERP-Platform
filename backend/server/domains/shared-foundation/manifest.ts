import { BackendDomain, type DomainManifest } from "../../platform/domain.types";

export const sharedFoundationManifest: DomainManifest = {
  id: BackendDomain.SHARED_FOUNDATION,
  displayName: "Shared Foundation",
  description: "Identity, access and infrastructure capabilities shared by every product.",
  routes: [
    "audit-log",
    "auth",
    "health",
    "nav",
    "notification",
    "role",
    "search",
    "sso",
    "upload",
    "user",
  ],
  capabilities: [
    "identity",
    "sessions",
    "rbac",
    "audit",
    "notifications",
    "search",
    "uploads",
    "single-sign-on",
  ],
  dependencies: [],
};
