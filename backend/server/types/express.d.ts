declare global {
  namespace Express {
    interface Request {
      user?: import("../models/user.model").IUser;
      activeRole?: string;
      /** Exact configured role selected for this session. */
      activeRoleId?: string;
      /** Active role document resolved from JWT role name. */
      role?: import("../models/role.model").IRole;
      /** Permission grid of the active role. */
      permissions?: import("../constants/permissions").IPermission[];
      /** NavItem ObjectId strings the active role can access. Empty = legacy fallback. */
      allowedNavItems?: string[];
      /** JWT ID of the current access token — set by authenticate middleware */
      jti?: string;
      /** Tenant identification string */
      tenantId?: string;
      /** Optional authorized campus context selected for a multi-campus request. */
      campusId?: string;
      /** Commercial module slugs enabled for the resolved tenant. */
      enabledModuleSlugs?: string[];
      /** Whether commercial module restrictions are active for this tenant. */
      entitlementEnforced?: boolean;
      /** Mongoose connection for the active tenant */
      tenantDb?: import("mongoose").Connection;
      /** Exact JSON bytes retained for payment webhook signature verification. */
      rawBody?: Buffer;
      /** Server-resolved modular-monolith ownership context. */
      backendDomain?: import("../platform").BackendDomainId;
    }
  }
}

export {};
