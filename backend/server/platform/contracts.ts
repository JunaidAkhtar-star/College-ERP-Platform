/** Stable contracts allowed to cross backend domain boundaries. */
export interface TenantIdentityContract {
  tenantId: string;
  productSlug: string;
  status: "provisioning" | "active" | "suspended" | "failed";
}

export interface ProductEntitlementContract {
  tenantId: string;
  productSlug: string;
  planId: string;
  enabledModuleSlugs: readonly string[];
  enabledAddonSlugs: readonly string[];
  enforced: boolean;
  expiresAt: string;
}

export interface AuthenticatedPrincipalContract {
  userId: string;
  tenantId?: string;
  activeRole: string;
  activeRoleId?: string;
  sessionId: string;
}

export interface SubscriptionContract {
  tenantId: string;
  productSlug: string;
  planId: string;
  status: "trial" | "active" | "past_due" | "suspended" | "expired";
  startsAt: string;
  expiresAt: string;
}
