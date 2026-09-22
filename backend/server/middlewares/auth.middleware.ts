import type { Request, Response, NextFunction } from "express";
import { Unauthorized, Forbidden } from "http-errors";
import { userRepository } from "../repositories/user.repository";
import { roleRepository } from "../repositories/role.repository";
import { tokenUtil } from "../utils/token.util";
import type { SystemRole } from "../constants/roles";
import type { Module, PermissionAction, IPermission } from "../constants/permissions";
import type { IRole } from "../models/role.model";
import { institutionSettingService } from "../services/institution-setting.service";
import { permissionForRequest } from "../constants/route-permissions";

/**
 * Core authentication middleware.
 * Verifies the JWT access token, loads the user + active role doc, and attaches
 * `req.user`, `req.activeRole`, `req.role`, `req.permissions`, `req.allowedNavItems`.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Unauthorized("Authorization header is missing or malformed");
    }

    const token = authHeader.split(" ")[1];
    const payload = tokenUtil.verifyAccessToken(token);

    // Verify tenant scoping to prevent token replay attacks
    const tokenTenant = (payload as { tenantId?: string }).tenantId;
    if (tokenTenant !== req.tenantId) {
      throw new Unauthorized("Token is not valid for this tenant.");
    }

    const onboardingAllowed =
      req.originalUrl.includes("/auth/") ||
      req.originalUrl.includes("/institution-setting") ||
      req.originalUrl.includes("/tenant-domain");
    const [user, onboardingComplete, baseRoleDoc] = await Promise.all([
      userRepository.findById(payload.userId),
      tokenTenant && !onboardingAllowed
        ? institutionSettingService.isOnboardingComplete(tokenTenant)
        : Promise.resolve(true),
      roleRepository.findByName(payload.role),
    ]);
    if (!user) throw new Unauthorized("User not found");

    if (user.status === "suspended")
      throw new Forbidden("Account suspended. Contact administrator.");
    if (user.status === "inactive") throw new Forbidden("Account inactive. Contact administrator.");

    // Validate both the legacy base role and the exact configured role selected
    // for this session. Removing a custom assignment invalidates its tokens.
    if (!user.roles.includes(payload.role as SystemRole)) {
      throw new Unauthorized("Token base role no longer valid. Please login again.");
    }

    if (!onboardingComplete) {
      throw new Forbidden("Complete the required institution setup before accessing ERP modules.");
    }

    req.user = user as unknown as import("../models/user.model").IUser;
    req.activeRole = payload.role;
    req.activeRoleId = payload.roleId;
    req.jti = payload.jti;

    // Resolve permissions only from the explicitly selected active role. Unioning
    // every assigned role here would let a low-privilege token inherit a user's
    // dormant administrative permissions.
    const activeDoc = payload.roleId
      ? String(baseRoleDoc?._id) === payload.roleId
        ? baseRoleDoc
        : await roleRepository.findAssignedById(payload.roleId, user.customRoleIds ?? [])
      : baseRoleDoc;

    if (activeDoc && activeDoc.isActive !== false) {
      const typed = activeDoc as unknown as IRole;
      req.role = typed;

      const permMap = new Map<string, Set<string>>();
      const navIds = new Set<string>();
      const merge = (doc: typeof activeDoc | null) => {
        if (!doc || doc.isActive === false) return;
        (doc.permissions ?? []).forEach((p) => {
          if (!permMap.has(p.module)) permMap.set(p.module, new Set());
          const set = permMap.get(p.module);
          if (set) (p.actions ?? []).forEach((a) => set.add(a));
        });
        (doc.allowedNavItems ?? []).forEach((id) => navIds.add(String(id)));
      };
      merge(activeDoc);

      req.permissions = Array.from(permMap.entries()).map(([module, actions]) => ({
        module: module as Module,
        actions: Array.from(actions) as PermissionAction[],
      })) as IPermission[];
      req.allowedNavItems = Array.from(navIds);
    } else {
      req.permissions = [];
      req.allowedNavItems = [];
    }

    const selfService =
      req.baseUrl.endsWith("/auth") ||
      (req.baseUrl.endsWith("/user") && /^\/me(?:\/|$)/.test(req.path));
    if (!selfService) {
      const required = permissionForRequest(req);
      if (required && !hasPermission(req.permissions, required.module, required.action)) {
        throw new Forbidden(`Missing permission: ${required.module}:${required.action}`);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role guard — restricts a route to specific active roles.
 * Usage: router.get('/route', authenticate, requireRoles([SystemRole.SUPER_ADMIN]))
 */
export function requireRoles(roles: SystemRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const required = permissionForRequest(req);

    // Mapped ERP routes are governed by the selected role document. Keep the
    // role-name list only as a compatibility boundary for unmapped endpoints.
    if (required) {
      if (!hasPermission(req.permissions, required.module, required.action)) {
        next(new Forbidden(`Missing permission: ${required.module}:${required.action}`));
        return;
      }
      next();
      return;
    }

    if (!req.activeRole || !roles.includes(req.activeRole as SystemRole)) {
      next(new Forbidden(`Access denied. Required role(s): ${roles.join(", ")}`));
      return;
    }
    next();
  };
}

/**
 * Compatibility alias for routes that accept one of several active roles.
 * Only the role embedded in the current JWT is considered; dormant assigned
 * roles never grant authority to the active session.
 */
export function requireAnyRole(roles: SystemRole[]) {
  return requireRoles(roles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission-based guards (Phase 1 of dynamic RBAC).
// Prefer these over role-name guards for new routes; both can coexist.
// ─────────────────────────────────────────────────────────────────────────────

function hasPermission(
  perms: IPermission[] | undefined,
  module: Module,
  action: PermissionAction,
): boolean {
  if (!perms || !perms.length) return false;
  return perms.some((p) => p.module === module && p.actions.includes(action));
}

/** Allow only if the active role grants `module:action`. */
export function requirePermission(module: Module, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!hasPermission(req.permissions, module, action)) {
      next(new Forbidden(`Missing permission: ${module}:${action}`));
      return;
    }
    next();
  };
}

/** Allow if the active role grants ANY of the listed `module:action` pairs. */
export function requireAnyPermission(checks: Array<[Module, PermissionAction]>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ok = checks.some(([m, a]) => hasPermission(req.permissions, m, a));
    if (!ok) {
      next(
        new Forbidden(
          `Missing permission. Required one of: ${checks.map(([m, a]) => `${m}:${a}`).join(", ")}`,
        ),
      );
      return;
    }
    next();
  };
}
