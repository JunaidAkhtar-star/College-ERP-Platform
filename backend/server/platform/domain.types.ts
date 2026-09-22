export const BackendDomain = {
  PLATFORM_CORE: "platform-core",
  SHARED_FOUNDATION: "shared-foundation",
  COLLEGE_ERP: "product:college-erp",
} as const;

export type BackendDomainId = (typeof BackendDomain)[keyof typeof BackendDomain];

export interface DomainManifest {
  id: BackendDomainId;
  displayName: string;
  description: string;
  routes: readonly string[];
  capabilities: readonly string[];
  dependencies: readonly BackendDomainId[];
}

export interface RouteModuleDefinition {
  route: string;
  domain: BackendDomainId;
}
