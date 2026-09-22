import type { RequestHandler } from "express";
import type { UploadedFile } from "express-fileupload";
import { adminService } from "../services/admin.service";
import { responseUtil } from "../utils/response.util";
import { uploadUtil } from "../utils/upload.util";
import { parsePagination } from "../utils/pagination.util";

function getDirectoryScope(req: Parameters<RequestHandler>[0]): Record<string, unknown> {
  const constraints: Record<string, unknown>[] = [];
  if (req.activeRole !== "super_admin") constraints.push({ roles: { $ne: "super_admin" } });
  if (req.activeRole === "hod") {
    if (!req.user?.department) constraints.push({ _id: { $exists: false } });
    else constraints.push({ department: req.user.department });
  }
  return constraints.length ? { $and: constraints } : {};
}

export const adminController: Record<string, RequestHandler> = {
  /** GET /users/me */
  async getSelf(req, res, next) {
    try {
      const user = await adminService.getSelf(req.user!._id.toString());
      responseUtil.success(res, user);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /users/me */
  async updateSelf(req, res, next) {
    try {
      const { name, phone, bloodGroup, emergencyContact } = req.body;
      const user = await adminService.updateSelfProfile(req.user!._id.toString(), {
        name,
        phone,
        bloodGroup,
        emergencyContact,
      });
      responseUtil.success(res, user, "Profile updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /users/me/avatar — multipart form field "avatar" */
  async updateSelfAvatar(req, res, next) {
    try {
      const file = req.files?.avatar as UploadedFile | undefined;
      if (!file) {
        res.status(400).json({
          success: false,
          error: { message: 'File field "avatar" is required' },
        });
        return;
      }
      const upload = await uploadUtil.uploadAvatar(file);
      const user = await adminService.updateSelfProfile(req.user!._id.toString(), {
        avatar: upload.url,
      });
      responseUtil.success(res, user, "Avatar updated");
    } catch (err) {
      next(err);
    }
  },

  /** POST /admin/users */
  async createUser(req, res, next) {
    try {
      const user = await adminService.createUser(req.body, req.user!, req);
      responseUtil.created(res, user, "User created successfully");
    } catch (err) {
      next(err);
    }
  },

  /** GET /admin/users */
  async listUsers(req, res, next) {
    try {
      const query = parsePagination(req.query as Record<string, unknown>);
      const filters: Record<string, unknown>[] = [getDirectoryScope(req)];
      const filter: Record<string, unknown> = {};
      if (req.query.role) filter.roles = req.query.role;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.department) filter.department = req.query.department;
      filters.push(filter);
      const result = await adminService.listUsers(query, { $and: filters });
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getUserDirectorySummary(req, res, next) {
    try {
      const data = await adminService.getUserDirectorySummary(getDirectoryScope(req));
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /admin/users/:id */
  async getUserById(req, res, next) {
    try {
      const user = await adminService.getUserById(req.params.id, req.user!, req.activeRole);
      responseUtil.success(res, user);
    } catch (err) {
      next(err);
    }
  },

  async getUserAccess(req, res, next) {
    try {
      const data = await adminService.getUserAccess(req.params.id, req.user!, req.activeRole);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  async revokeUserSessions(req, res, next) {
    try {
      await adminService.revokeUserSessions(req.params.id, req.user!, req, req.activeRole);
      responseUtil.success(res, undefined, "All user sessions revoked");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admin/users/:id */
  async updateUser(req, res, next) {
    try {
      const { name, phone, status, roles, department } = req.body;
      const user = await adminService.updateUser(
        req.params.id,
        { name, phone, status, roles, department },
        req.user!,
        req,
        req.activeRole,
      );
      responseUtil.success(res, user, "User updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /admin/users/:id/status */
  async setUserStatus(req, res, next) {
    try {
      const { status, reason } = req.body;
      await adminService.setUserStatus(
        req.params.id,
        status,
        reason,
        req.user!,
        req,
        req.activeRole,
      );
      responseUtil.success(res, undefined, `User ${status} successfully`);
    } catch (err) {
      next(err);
    }
  },

  /** POST /admin/users/:id/reset-password */
  async resetPassword(req, res, next) {
    try {
      const result = await adminService.adminResetPassword(
        req.params.id,
        req.user!,
        req,
        req.body.sendEmail !== false,
        req.activeRole,
      );
      responseUtil.success(res, result, "Password reset successfully");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /users/:id/data — GDPR data erasure (SRS §10.3) */
  async eraseUserData(req, res, next) {
    try {
      const result = await adminService.eraseUserData(
        req.params.id,
        req.user!,
        req,
        req.activeRole,
      );
      responseUtil.success(res, result, "User data erased (GDPR)");
    } catch (err) {
      next(err);
    }
  },
};
