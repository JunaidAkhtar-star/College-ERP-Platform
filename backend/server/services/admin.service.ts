import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request } from "express";
import { BadRequest, Conflict, Forbidden, NotFound } from "http-errors";
import { Types } from "mongoose";
import { Module } from "../constants/permissions";
import { SystemRole } from "../constants/roles";
import { emailService } from "../email/email.service";
import { AdmissionApplicationModel, StudentProfileModel } from "../models";
import { DepartmentModel } from "../models/department.model";
import type { IUser } from "../models/user.model";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { roleRepository } from "../repositories/role.repository";
import { userRepository } from "../repositories/user.repository";
import type { PaginationQuery } from "../types";
import { logger } from "../utils/logger.util";
import { resolveRequestAppBaseUrl, tenantActivationUrl } from "../utils/tenant-app-url.util";

const INVITE_TOKEN_TTL_HOURS = 24;

const PRIVILEGED_ROLES = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HR_DEPARTMENT,
  SystemRole.ACCOUNTS_DEPARTMENT,
]);

const PROFILE_BOUND_ROLES = new Set<SystemRole>([
  SystemRole.STUDENT,
  SystemRole.PARENT,
  SystemRole.FACULTY,
  SystemRole.HOD,
]);

function assertRoleAssignment(actor: IUser, roles: SystemRole[]) {
  if (actor.roles.includes(SystemRole.SUPER_ADMIN)) return;
  if (roles.some((role) => PRIVILEGED_ROLES.has(role)))
    throw new Forbidden("Only a Super Admin can assign privileged roles");
}

function departmentId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function assertTargetAuthority(actor: IUser, target: IUser, activeRole?: string) {
  if (
    target.roles.includes(SystemRole.SUPER_ADMIN) &&
    !actor.roles.includes(SystemRole.SUPER_ADMIN)
  ) {
    throw new Forbidden("Cannot manage a Super Admin account");
  }
  if (
    activeRole === SystemRole.HOD &&
    departmentId(actor.department) !== departmentId(target.department)
  ) {
    throw new Forbidden("This account is outside your department scope");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ID generation helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateEmployeeId(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = crypto.randomInt(10000, 100000);
  return `EMP${year}${rand}`;
}

function generateStudentId(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = crypto.randomInt(100000, 1000000);
  return `STU${year}${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const adminService = {
  /**
   * Create a new user — used by admin/super_admin.
   */
  async createUser(
    data: {
      name: string;
      email: string;
      password?: string;
      roles: SystemRole[];
      department?: string;
      phone?: string;
    },
    actorUser: IUser,
    req: Request,
  ) {
    if (
      !data.name?.trim() ||
      !data.email?.trim() ||
      !Array.isArray(data.roles) ||
      !data.roles.length
    )
      throw new BadRequest("Name, email and at least one role are required");
    assertRoleAssignment(actorUser, data.roles);
    const profileBoundRole = data.roles.find((role) => PROFILE_BOUND_ROLES.has(role));
    if (profileBoundRole) {
      throw new BadRequest(
        `The ${profileBoundRole.replace(/_/g, " ")} role requires its dedicated onboarding workflow`,
      );
    }
    const exists = await userRepository.existsByEmail(data.email);
    if (exists) throw new Conflict("A user with this email already exists");

    const isStudent = data.roles.includes(SystemRole.STUDENT);
    // Store a non-loginable placeholder until the recipient verifies their
    // email and chooses a password through the single-use invitation link.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpires = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const newUser = await userRepository.create({
      ...data,
      password: placeholderHash,
      mustChangePassword: true,
      status: "pending_verification",
      isEmailVerified: false,
      passwordSetToken: tokenHash,
      passwordSetTokenExpires: tokenExpires,
      ...(isStudent ? { studentId: generateStudentId() } : { employeeId: generateEmployeeId() }),
      department: data.department ? new Types.ObjectId(data.department) : undefined,
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "USER_CREATED",
      module: Module.USER_MANAGEMENT,
      targetId: newUser._id.toString(),
      targetModel: "User",
      description: `Created user '${newUser.name}' with role(s): ${data.roles.join(", ")}`,
      req,
    });

    if (!req.tenantId) throw new Error("Tenant context is required to create an invitation.");
    const setupUrl = await tenantActivationUrl(req.tenantId, rawToken);
    const department = newUser.department
      ? await DepartmentModel.findById(newUser.department).select("name").lean().exec()
      : null;
    emailService
      .sendAccountInvite(
        newUser.email,
        newUser.name,
        newUser.studentId ?? newUser.employeeId ?? newUser.email,
        newUser.roles?.[0] ?? "USER",
        department?.name ?? "",
        setupUrl,
      )
      .catch((err: unknown) => logger.error("[admin] Failed to send account invitation", err));

    const { password: _p, ...safeUser } = newUser as IUser & { password?: string };

    return safeUser;
  },

  /**
   * Get all users with pagination and search.
   */
  async listUsers(query: PaginationQuery, filter: Record<string, unknown> = {}) {
    return userRepository.paginate(filter, query);
  },

  async getUserDirectorySummary(filter: Record<string, unknown> = {}) {
    return userRepository.getDirectorySummary(filter);
  },

  /**
   * Get a single user by ID.
   */
  async getUserById(id: string, actorUser: IUser, viewerRole?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFound("User not found");
    if (viewerRole !== SystemRole.SUPER_ADMIN && user.roles.includes(SystemRole.SUPER_ADMIN)) {
      throw new NotFound("User not found");
    }
    assertTargetAuthority(actorUser, user as IUser, viewerRole);
    return user;
  },

  async getUserAccess(id: string, actorUser: IUser, viewerRole?: string) {
    const user = await userRepository.findByIdWithAccess(id);
    if (!user) throw new NotFound("User not found");
    if (viewerRole !== SystemRole.SUPER_ADMIN && user.roles.includes(SystemRole.SUPER_ADMIN)) {
      throw new NotFound("User not found");
    }
    assertTargetAuthority(actorUser, user as IUser, viewerRole);
    const customRoles = await roleRepository.findAssigned(user.customRoleIds ?? []);
    const permissionMap = new Map<string, Set<string>>();
    for (const role of customRoles) {
      for (const permission of role.permissions ?? []) {
        const actions = permissionMap.get(String(permission.module)) ?? new Set<string>();
        permission.actions.forEach((action) => actions.add(String(action)));
        permissionMap.set(String(permission.module), actions);
      }
    }
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        status: user.status,
        department: user.department,
        isEmailVerified: user.isEmailVerified,
        mustChangePassword: user.mustChangePassword,
        lastLogin: user.lastLogin,
        mfaEnabled: user.mfaEnabled,
      },
      customRoles: customRoles.map((role) => ({
        _id: role._id,
        displayName: role.displayName,
        baseRole: role.baseRole,
      })),
      effectivePermissions: Array.from(permissionMap, ([module, actions]) => ({
        module,
        actions: Array.from(actions).sort(),
      })).sort((a, b) => a.module.localeCompare(b.module)),
      sessions: (user.activeSessions ?? []).map((session) => ({
        device: session.device,
        ip: session.ip,
        createdAt: session.createdAt,
      })),
    };
  },

  async revokeUserSessions(id: string, actorUser: IUser, req: Request, activeRole?: string) {
    if (String(actorUser._id) === id)
      throw new BadRequest("Use your Security settings to revoke your own sessions");
    const user = await userRepository.findById(id);
    if (!user) throw new NotFound("User not found");
    assertTargetAuthority(actorUser, user as IUser, activeRole);
    await userRepository.revokeAllSessions(id);
    await auditLogRepository.create({
      user: actorUser,
      action: "USER_SESSIONS_REVOKED",
      module: Module.USER_MANAGEMENT,
      targetId: id,
      targetModel: "User",
      description: `Revoked all sessions for user '${user.name}'`,
      req,
    });
  },

  /**
   * Update user details (admin action).
   */
  async updateUser(
    id: string,
    update: Partial<Pick<IUser, "name" | "phone" | "status" | "roles" | "department">>,
    actorUser: IUser,
    req: Request,
    activeRole?: string,
  ) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFound("User not found");
    assertTargetAuthority(actorUser, user as IUser, activeRole);
    if (String(actorUser._id) === id && update.roles)
      throw new BadRequest("You cannot change your own roles from User Management");

    // Super admin is the only one who can modify another super admin
    if (
      user.roles.includes(SystemRole.SUPER_ADMIN) &&
      !actorUser.roles.includes(SystemRole.SUPER_ADMIN)
    ) {
      throw new Forbidden("Cannot modify a Super Admin account");
    }
    if (update.roles) assertRoleAssignment(actorUser, update.roles as SystemRole[]);
    if (!actorUser.roles.includes(SystemRole.SUPER_ADMIN)) delete update.roles;

    const authorityChanged =
      Array.isArray(update.roles) &&
      [...update.roles].map(String).sort().join("|") !==
        [...user.roles].map(String).sort().join("|");
    const updated = await userRepository.updateById(
      id,
      authorityChanged ? { ...update, activeSessions: [] } : update,
    );

    await auditLogRepository.create({
      user: actorUser,
      action: "USER_UPDATED",
      module: Module.USER_MANAGEMENT,
      targetId: id,
      targetModel: "User",
      description: `Updated user '${user.name}'`,
      metadata: { fields: Object.keys(update) },
      req,
    });

    return updated;
  },

  /**
   * Deactivate / suspend a user.
   */
  async setUserStatus(
    id: string,
    status: "pending_verification" | "active" | "inactive" | "suspended" | "blocked",
    reason: string,
    actorUser: IUser,
    req: Request,
    activeRole?: string,
  ) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFound("User not found");
    assertTargetAuthority(actorUser, user as IUser, activeRole);
    if (
      !(
        ["pending_verification", "active", "inactive", "suspended", "blocked"] as string[]
      ).includes(status)
    )
      throw new BadRequest("Invalid user status");
    if (String(actorUser._id) === id && status !== "active")
      throw new BadRequest("You cannot deactivate or suspend your own account");

    if (
      user.roles.includes(SystemRole.SUPER_ADMIN) &&
      !actorUser.roles.includes(SystemRole.SUPER_ADMIN)
    ) {
      throw new Forbidden("Cannot modify a Super Admin account status");
    }

    await userRepository.updateById(
      id,
      status === "active" ? { status } : { status, activeSessions: [] },
    );

    await auditLogRepository.create({
      user: actorUser,
      action: `USER_STATUS_${status.toUpperCase()}`,
      module: Module.USER_MANAGEMENT,
      targetId: id,
      targetModel: "User",
      description: `Set user '${user.name}' status to '${status}'`,
      metadata: { previousStatus: user.status, nextStatus: status, reason },
      req,
    });
  },

  /**
   * Admin reset user password (generates temp password, sends email).
   */
  async adminResetPassword(
    id: string,
    actorUser: IUser,
    req: Request,
    sendEmail = true,
    activeRole?: string,
  ) {
    if (String(actorUser._id) === id)
      throw new BadRequest("Use your Security settings to change your own password");
    const user = await userRepository.findById(id);
    if (!user) throw new NotFound("User not found");
    assertTargetAuthority(actorUser, user as IUser, activeRole);

    const tempPassword = `${crypto.randomBytes(9).toString("base64url")}A1!`;
    const hashed = await bcrypt.hash(tempPassword, 12);

    await userRepository.updateById(id, {
      password: hashed,
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      activeSessions: [],
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "ADMIN_PASSWORD_RESET",
      module: Module.USER_MANAGEMENT,
      targetId: id,
      targetModel: "User",
      description: `Admin reset password for user '${user.name}'`,
      req,
    });

    const [application, profile] = await Promise.all([
      user.roles.includes(SystemRole.STUDENT)
        ? AdmissionApplicationModel.findOne({ enrolledUserId: user._id })
            .select("applicationNumber")
            .lean()
        : null,
      user.roles.includes(SystemRole.STUDENT)
        ? StudentProfileModel.findOne({ userId: user._id })
            .select("registrationNumber department")
            .lean()
        : null,
    ]);
    const loginId =
      user.studentId ??
      user.facultyId ??
      user.employeeId ??
      application?.applicationNumber ??
      profile?.registrationNumber ??
      user.email;

    const loginUrl = resolveRequestAppBaseUrl(req);

    if (sendEmail) {
      const departmentId = user.department ?? profile?.department;
      const department = departmentId
        ? await DepartmentModel.findById(departmentId).select("name code").lean()
        : null;
      const primaryRole = user.roles?.[0] ?? SystemRole.STUDENT;
      const roleLabel = primaryRole
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      emailService
        .sendWelcome(
          user.email,
          user.name ?? user.email,
          loginId,
          roleLabel,
          department?.name ?? department?.code ?? "Not assigned",
          tempPassword,
          loginUrl,
        )
        .catch((err: unknown) => logger.error("[admin] Failed to send temp-password email", err));
    }

    return {
      tempPassword,
      emailRequested: sendEmail,
      loginId,
      loginUrl,
    };
  },

  /**
   * Get self profile.
   */
  async getSelf(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFound("Account not found");
    return user;
  },

  /**
   * Update own profile (avatar, phone, emergency contact).
   */
  async updateSelfProfile(
    userId: string,
    update: {
      name?: string;
      phone?: string;
      bloodGroup?: string;
      emergencyContact?: IUser["emergencyContact"];
      avatar?: string;
    },
  ) {
    const user = await userRepository.updateById(userId, update);
    if (!user) throw new NotFound("Account not found");
    return user;
  },

  /**
   * GDPR data erasure (SRS §10.3) — anonymise all PII for a given user.
   * Hard-deletes are not done; instead PII fields are overwritten with
   * anonymised values and the account is suspended, so referential integrity
   * (grades, audit logs, etc.) is preserved.
   */
  async eraseUserData(targetId: string, actorUser: IUser, req: Request, activeRole?: string) {
    if (String(actorUser._id) === targetId)
      throw new BadRequest("You cannot erase your own active account");
    const user = await userRepository.findById(targetId);
    if (!user) throw new NotFound("User not found");
    assertTargetAuthority(actorUser, user as IUser, activeRole);

    const anonymised = {
      name: `DELETED_USER_${targetId.slice(-6)}`,
      email: `deleted_${targetId}@erased.invalid`,
      phone: undefined,
      avatar: undefined,
      address: undefined,
      emergencyContact: undefined,
      status: "inactive",
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: actorUser._id,
    };

    await userRepository.updateById(targetId, anonymised);

    await auditLogRepository.create({
      user: actorUser,
      action: "USER_DATA_ERASED",
      module: Module.USER_MANAGEMENT,
      targetId,
      targetModel: "User",
      description: `GDPR data erasure executed for user ${targetId}`,
      req,
    });

    return { erased: true, userId: targetId };
  },
};
