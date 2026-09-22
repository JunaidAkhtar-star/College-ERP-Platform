import type { Request, Response, NextFunction } from "express";
import { roleService } from "../services/role.service";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { Module } from "../constants/permissions";

async function auditRoleChange(
  req: Request,
  action: string,
  targetId: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await auditLogRepository.create({
    user: req.user,
    action,
    module: Module.ROLE_MANAGEMENT,
    targetId,
    targetModel: "Role",
    description,
    metadata,
    reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    req,
  });
}

function roleSnapshot(role: unknown) {
  const obj = role as Record<string, unknown> | null | undefined;
  const plain =
    obj && typeof obj.toObject === "function"
      ? (obj.toObject as () => Record<string, unknown>)()
      : obj;
  return {
    name: plain?.name,
    displayName: plain?.displayName,
    baseRole: plain?.baseRole,
    permissions: plain?.permissions,
    allowedNavItems: plain?.allowedNavItems,
    isActive: plain?.isActive,
  };
}

export const roleController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const result = await roleService.getAll(
        includeInactive,
        req.query as Record<string, unknown>,
      );
      if (result && typeof result === "object" && "pagination" in result) {
        res.json({ success: true, ...result });
      } else {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await roleService.getById(req.params.id);
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = (req.user!._id as unknown as string).toString();
      const role = await roleService.create({ ...req.body, createdBy });
      await auditRoleChange(req, "ROLE_CREATED", String(role._id), `Created role '${role.name}'`, {
        after: roleSnapshot(role),
      });
      res.status(201).json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await roleService.getById(req.params.id);
      const role = await roleService.update(req.params.id, req.body);
      await auditRoleChange(req, "ROLE_UPDATED", req.params.id, `Updated role '${before.name}'`, {
        before: roleSnapshot(before),
        after: role ? roleSnapshot(role) : undefined,
      });
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  updatePermissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { permissions } = req.body;
      const before = await roleService.getById(req.params.id);
      const role = await roleService.updatePermissions(req.params.id, permissions ?? []);
      await auditRoleChange(
        req,
        "ROLE_PERMISSIONS_UPDATED",
        req.params.id,
        `Updated permissions for role '${before.name}'`,
        { before: before.permissions, after: role?.permissions },
      );
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  updateNavItems: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { allowedNavItems } = req.body;
      const before = await roleService.getById(req.params.id);
      const role = await roleService.updateNavItems(req.params.id, allowedNavItems ?? []);
      await auditRoleChange(
        req,
        "ROLE_NAVIGATION_UPDATED",
        req.params.id,
        `Updated navigation for role '${before.name}'`,
        { before: before.allowedNavItems, after: role?.allowedNavItems },
      );
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await roleService.getById(req.params.id);
      await roleService.delete(req.params.id, String(req.user!._id));
      await auditRoleChange(req, "ROLE_DELETED", req.params.id, `Deleted role '${before.name}'`, {
        before: roleSnapshot(before),
      });
      res.json({ success: true, message: "Role deactivated and archived" });
    } catch (err) {
      next(err);
    }
  },

  toggleActive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await roleService.getById(req.params.id);
      const role = await roleService.toggleActive(req.params.id);
      await auditRoleChange(
        req,
        role?.isActive ? "ROLE_ACTIVATED" : "ROLE_DEACTIVATED",
        req.params.id,
        `${role?.isActive ? "Activated" : "Deactivated"} role '${before.name}'`,
        { before: before.isActive, after: role?.isActive },
      );
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  assignUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await roleService.assignToUser(
        req.params.id,
        req.params.userId,
        req.body.assigned,
      );
      await auditRoleChange(
        req,
        req.body.assigned ? "ROLE_ASSIGNED" : "ROLE_UNASSIGNED",
        req.params.id,
        `${req.body.assigned ? "Assigned" : "Removed"} role for user '${req.params.userId}'`,
        { userId: req.params.userId, assigned: req.body.assigned },
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
