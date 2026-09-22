import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { BadRequest, NotFound, Unauthorized, Forbidden, TooManyRequests } from "http-errors";
import { configs } from "../configs";
import { userRepository } from "../repositories/user.repository";
import { roleRepository } from "../repositories/role.repository";
import { OtpModel, OtpPurpose } from "../models/otp.model";
import { SystemRole } from "../constants/roles";
import type { IUser } from "../models/user.model";
import type { IRole } from "../models/role.model";
import { tokenUtil, randomUUID } from "../utils/token.util";
import { otpUtil } from "../utils/otp.util";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { Module } from "../constants/permissions";
import type { Request } from "express";
import { emailService } from "../email/email.service";
import { resolveRequestAppBaseUrl } from "../utils/tenant-app-url.util";
import { logger } from "../utils/logger.util";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import { StudentProfileModel } from "../models/student-profile.model";
import {
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
} from "../models/student-section-allotment.model";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { passwordVerifier } from "../utils/password-verifier.util";
import { UserModel } from "../models/user.model";

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;
const REFRESH_ROTATION_GRACE_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return passwordVerifier.compare(plain, hashed);
}

/**
 * Build the role payload returned to the frontend. Permissions and navigation
 * always come from the selected active role so the browser and API enforce the
 * same least-privilege boundary. Other assigned roles are exposed only as role
 * switch choices and never contribute dormant permissions.
 */
async function assignedRoleNames(user: IUser) {
  if (!(user.customRoleIds ?? []).length) return [...user.roles];
  const customRoles = await roleRepository.findAssigned(user.customRoleIds ?? []);
  return [...user.roles, ...customRoles.map((role) => role.name)];
}

/**
 * Choose the safest useful portal when a multi-role user has not explicitly
 * selected one. HOD accounts commonly also hold Faculty so they can teach;
 * opening Faculty merely because it was stored first hides their department
 * governance workspace. Explicit login and role-switch choices still win.
 */
export function preferredDefaultRole(roles: readonly SystemRole[]): SystemRole | undefined {
  if (roles.includes(SystemRole.HOD)) return SystemRole.HOD;
  return roles[0];
}

async function resolveRole(user: IUser, selected?: string) {
  if (selected && !user.roles.includes(selected as SystemRole)) {
    const roleById = await roleRepository.findById(selected);
    if (roleById) {
      const assignedSystemRole =
        roleById.isSystem && user.roles.includes(roleById.baseRole as SystemRole);
      const assignedCustomRole = (user.customRoleIds ?? []).some(
        (roleId) => String(roleId) === selected,
      );
      if (!assignedSystemRole && !assignedCustomRole) {
        throw new Forbidden(`You do not have the '${roleById.name}' role`);
      }
      if (roleById.isActive === false) throw new Forbidden("Selected role is inactive");
      return { role: roleById, baseRole: roleById.baseRole };
    }
    const custom = await roleRepository.findAssigned(user.customRoleIds ?? []);
    const role = custom.find(
      (candidate) =>
        candidate.name === selected.toLowerCase() || String(candidate._id) === selected,
    );
    if (!role) throw new Forbidden(`You do not have the '${selected}' role`);
    return { role, baseRole: role.baseRole };
  }
  const baseRole =
    (selected as SystemRole | undefined) ?? preferredDefaultRole(user.roles as SystemRole[]);
  if (!baseRole) throw new Forbidden("No active role is assigned to this account");
  if (!user.roles.includes(baseRole)) throw new Forbidden(`You do not have the '${baseRole}' role`);
  const role = await roleRepository.findByName(baseRole);
  if (!role) throw new Forbidden("Selected role configuration is missing");
  if (role.isActive === false) throw new Forbidden("Selected role is inactive");
  return { role, baseRole };
}

async function buildRolePayload(
  activeDoc: Pick<
    IRole,
    "_id" | "name" | "displayName" | "permissions" | "allowedNavItems" | "isSystem" | "baseRole"
  >,
  user: IUser,
) {
  const allRoles = await assignedRoleNames(user);

  return {
    _id: String(activeDoc._id),
    name: activeDoc.name,
    displayName: activeDoc.displayName,
    permissions: activeDoc.permissions ?? [],
    allowedNavItems: (activeDoc.allowedNavItems ?? []).map((id) => String(id)),
    isSystem: activeDoc.isSystem,
    baseRole: activeDoc.baseRole,
    /** All role names the user holds — frontend uses this for the role switcher. */
    assignedRoles: allRoles,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export function createMfaLoginChallenge(user: IUser, role: SystemRole, roleId: string) {
  const mfaToken = jwt.sign(
    {
      userId: user._id.toString(),
      role,
      roleId,
      purpose: "mfa",
    },
    configs.JWT_SECRET,
    { expiresIn: "5m" },
  );
  return {
    mfaRequired: true,
    mfaToken,
    email: user.email,
  } as const;
}

export const authService = {
  /** Resolve a tenant-scoped, single-use account invitation. */
  async resolveInviteToken(rawToken: string) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await UserModel.findOne({
      passwordSetToken: tokenHash,
      passwordSetTokenExpires: { $gt: new Date() },
      status: "pending_verification",
    })
      .select(
        "+passwordSetToken +passwordSetTokenExpires name email facultyId studentId employeeId",
      )
      .lean();
    if (!user) throw new BadRequest("Invite link is invalid or expired");
    return {
      name: user.name,
      email: user.email,
      facultyId: user.facultyId,
      studentId: user.studentId,
      employeeId: user.employeeId,
    };
  },

  /** Verify the email, choose the initial password and activate the account. */
  async completeInvite(rawToken: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8)
      throw new BadRequest("Password must be at least 8 characters");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await UserModel.findOne({
      passwordSetToken: tokenHash,
      passwordSetTokenExpires: { $gt: new Date() },
      status: "pending_verification",
    }).select("+passwordSetToken +passwordSetTokenExpires");
    if (!user) throw new BadRequest("Invite link is invalid or expired");

    user.password = await hashPassword(newPassword);
    user.status = "active";
    user.isEmailVerified = true;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.passwordSetToken = undefined;
    user.passwordSetTokenExpires = undefined;
    await user.save();
  },

  /**
   * Login — validates credentials, enforces account state,
   * issues access + refresh tokens, records audit log.
   */
  async login(
    identifier: string,
    password: string,
    selectedRole: string | undefined,
    req: Request,
  ) {
    const startedAt = performance.now();
    const identityStartedAt = performance.now();
    const user = await userRepository.findByLoginIdentifier(identifier, true);
    const identityDurationMs = performance.now() - identityStartedAt;
    if (!user) throw new Unauthorized("Invalid login ID or password");

    const platformLogin = req.headers["x-platform-context"] === "true" && !req.tenantId;
    if (platformLogin && !user.roles.includes(SystemRole.SUPER_ADMIN)) {
      throw new Unauthorized("Invalid email or password");
    }

    if (user.status === "pending_verification")
      throw new Forbidden(
        "Your email is not verified. Please check your inbox for the activation link.",
      );
    if (user.status === "blocked")
      throw new Forbidden("Your account has been blocked. Contact administrator.");
    if (user.status === "suspended")
      throw new Forbidden("Your account has been suspended. Contact administrator.");
    if (user.status === "inactive")
      throw new Forbidden("Your account is inactive. Contact administrator.");

    const passwordStartedAt = performance.now();
    let isMatch: boolean;
    try {
      isMatch = await comparePassword(password, user.password);
    } catch (error) {
      logger.error("Password verification unavailable", {
        requestId: req.headers["x-request-id"],
        tenantId: req.tenantId,
        error: error instanceof Error ? error.message : "Unknown password verification failure",
      });
      throw new TooManyRequests("Authentication is temporarily busy. Please retry shortly.");
    }
    const passwordDurationMs = performance.now() - passwordStartedAt;
    if (!isMatch) throw new Unauthorized("Invalid login ID or password");

    // If no role is supplied, choose the account's preferred governance role.
    const roleStartedAt = performance.now();
    const resolved = await resolveRole(user, platformLogin ? SystemRole.SUPER_ADMIN : selectedRole);
    const roleDurationMs = performance.now() - roleStartedAt;

    // If MFA is enabled, defer token issuance until the user passes the TOTP step.
    if (user.mfaEnabled) {
      return createMfaLoginChallenge(user, resolved.baseRole, String(resolved.role._id));
    }

    const issuanceStartedAt = performance.now();
    const result = await this.issueLoginTokens(user, resolved.baseRole, resolved.role, req);
    const issuanceDurationMs = performance.now() - issuanceStartedAt;
    const totalDurationMs = performance.now() - startedAt;
    if (totalDurationMs >= 500) {
      logger.warn("Slow authentication", {
        requestId: req.headers["x-request-id"],
        tenantId: req.tenantId,
        context: platformLogin ? "platform" : "tenant",
        identityDurationMs: Math.round(identityDurationMs),
        passwordDurationMs: Math.round(passwordDurationMs),
        roleDurationMs: Math.round(roleDurationMs),
        issuanceDurationMs: Math.round(issuanceDurationMs),
        totalDurationMs: Math.round(totalDurationMs),
      });
    }
    return result;
  },

  /**
   * Verify a TOTP code presented during login (after a successful password
   * check that returned `mfaRequired: true`). Issues the real access/refresh
   * tokens on success.
   */
  async loginVerifyMfa(mfaToken: string, code: string, req: Request) {
    let payload: { userId: string; role: SystemRole; roleId?: string; purpose: string };
    try {
      payload = jwt.verify(mfaToken, configs.JWT_SECRET) as typeof payload;
    } catch {
      throw new Unauthorized("MFA challenge expired. Please sign in again.");
    }
    if (payload.purpose !== "mfa") throw new Unauthorized("Invalid MFA challenge token");
    if (req.headers["x-platform-context"] === "true" && payload.role !== SystemRole.SUPER_ADMIN) {
      throw new Unauthorized("Invalid MFA challenge token");
    }

    const user = (await userRepository.findById(payload.userId, true)) as
      | (IUser & { mfaSecret?: string })
      | null;
    if (!user) throw new Unauthorized("User not found");
    if (!user.mfaEnabled || !user.mfaSecret)
      throw new BadRequest("MFA is not enabled for this account");

    if (!code || !/^\d{6}$/.test(code)) throw new Unauthorized("Invalid or expired code");
    const { cryptoUtil } = await import("../utils/crypto.util");
    const { verify: totpVerifyFn } = await import("otplib");
    const plainSecret = cryptoUtil.decrypt(user.mfaSecret);
    let isValid = false;
    try {
      const result = (await totpVerifyFn({
        token: code.trim(),
        secret: plainSecret,
        strategy: "totp",
        epochTolerance: 30,
      })) as unknown;
      if (typeof result === "boolean") {
        isValid = result;
      } else if (result && typeof result === "object") {
        const r = result as { valid?: boolean; isValid?: boolean };
        isValid = r.valid === true || r.isValid === true;
      }
    } catch {
      isValid = false;
    }
    if (!isValid) throw new Unauthorized("Invalid or expired code");

    const resolved = payload.roleId
      ? await resolveRole(user, payload.roleId)
      : await resolveRole(user, payload.role);
    return this.issueLoginTokens(user, resolved.baseRole, resolved.role, req);
  },

  /**
   * Internal: mint access+refresh tokens, persist the session, write audit log.
   * Shared by the standard login path and the MFA login path.
   */
  async issueLoginTokens(user: IUser, resolvedRole: SystemRole, activeDoc: IRole, req: Request) {
    const platformLogin = req.headers["x-platform-context"] === "true" && !req.tenantId;
    // Update last login
    const jti = randomUUID();
    const sessionUpdate = userRepository.updateById(user._id, {
      lastLogin: new Date(),
      lastLoginIp: req.ip,
      $push: {
        activeSessions: {
          $each: [
            {
              jti,
              device: (req.headers["user-agent"] ?? "unknown").slice(0, 120),
              ip: req.ip ?? "",
              createdAt: new Date(),
            },
          ],
          $slice: -10, // keep only the 10 most recent sessions
        },
      },
    });

    const accessToken = tokenUtil.signAccessToken({
      userId: user._id.toString(),
      role: resolvedRole,
      roleId: String(activeDoc._id),
      jti,
      tenantId: req.tenantId,
    });

    const refreshToken = tokenUtil.signRefreshToken({
      userId: user._id.toString(),
      role: resolvedRole,
      roleId: String(activeDoc._id),
      jti,
      tenantId: req.tenantId,
    });

    const auditWrite = auditLogRepository.create({
      user: user as unknown as IUser,
      action: "USER_LOGIN",
      module: Module.USER_MANAGEMENT,
      description: `User logged in with role: ${resolvedRole}`,
      req,
    });

    const {
      password: _p,
      mfaSecret: _m,
      ...safeUser
    } = user as IUser & { password?: string; mfaSecret?: string };

    if (activeDoc.isActive === false) throw new Forbidden("Selected role is inactive");
    const rolePayloadPromise = buildRolePayload(activeDoc, user);

    // For students still in the admission pipeline, expose the current application
    // status so the frontend can lock them to the self-service application form.
    const applicationStatusPromise = (async (): Promise<string | undefined> => {
      if (!user.roles.includes(SystemRole.STUDENT)) return undefined;
      let applicationStatus: string | undefined;
      const app = await AdmissionApplicationModel.findOne({ enrolledUserId: user._id })
        .select("status")
        .lean()
        .exec();
      if (app && app.status !== "enrolled") {
        applicationStatus = app.status;
      }

      if (!applicationStatus) {
        // Enrolled, but check BPUT registration number & section allotment
        const profile = await StudentProfileModel.findOne({ userId: user._id }).lean();
        if (!profile || !profile.registrationNumber) {
          applicationStatus = "pending_registration";
        } else {
          const allotment = await StudentSectionAllotmentModel.findOne({
            studentId: user._id,
            status: StudentSectionAllotmentStatus.ACTIVE,
          }).lean();
          if (!allotment) {
            applicationStatus = "pending_allotment";
          }
        }
      }
      return applicationStatus;
    })();

    const institutionSettingPromise = platformLogin
      ? Promise.resolve(null)
      : InstitutionSettingModel.findOne().select("onboardingStatus").lean().exec();
    const [rolePayload, applicationStatus, institutionSetting] = await Promise.all([
      rolePayloadPromise,
      applicationStatusPromise,
      institutionSettingPromise,
      sessionUpdate,
      auditWrite,
    ]);
    const onboardingRequired = platformLogin
      ? false
      : institutionSetting?.onboardingStatus !== "completed";

    // Add the resolved/active role to the response so frontend knows which role was used
    return {
      user: { ...safeUser, role: resolvedRole, applicationStatus },
      role: rolePayload,
      accessToken,
      refreshToken,
      mustChangePassword: !!user.mustChangePassword,
      applicationStatus,
      onboardingRequired,
    };
  },

  /**
   * Refresh access token using a valid refresh token.
   * Implements token rotation: old refresh token is invalidated, new pair issued.
   */
  async refreshToken(refreshToken: string) {
    const payload = tokenUtil.verifyRefreshToken(refreshToken);
    // activeSessions is select:false because it must never leak in normal user
    // payloads. Refresh validation must explicitly opt in to that field.
    const user = await userRepository.findByIdWithSessions(payload.userId);
    if (!user) throw new Unauthorized("User not found");
    if (user.status !== "active") throw new Forbidden("Account is not active");
    if (!payload.tenantId && !user.roles.includes(SystemRole.SUPER_ADMIN)) {
      throw new Unauthorized("Invalid platform refresh token");
    }

    const currentSession = payload.jti
      ? user.activeSessions?.find((session) => session.jti === payload.jti)
      : undefined;
    if (payload.jti && !currentSession) throw new Unauthorized("Refresh token has been revoked");

    // Determine role: use the role from the old token if present, else fallback
    const resolved = payload.roleId
      ? await resolveRole(user, payload.roleId)
      : await resolveRole(user, payload.role ?? preferredDefaultRole(user.roles as SystemRole[]));

    // A hard reload can abort the response after the server rotated the token.
    // Keep the predecessor valid for a tiny grace window and make concurrent
    // requests converge on the same successor JTI.
    const now = new Date();
    let newJti = currentSession?.rotatedToJti;
    if (currentSession?.rotatedAt) {
      const rotationAge = now.getTime() - new Date(currentSession.rotatedAt).getTime();
      if (!newJti || rotationAge > REFRESH_ROTATION_GRACE_MS) {
        throw new Unauthorized("Refresh token has been revoked");
      }
    } else if (payload.jti) {
      const candidateJti = randomUUID();
      const rotated = await userRepository.rotateSession(user._id, payload.jti, candidateJti, now);
      if (rotated) {
        newJti = candidateJti;
      } else {
        const latest = await userRepository.findByIdWithSessions(user._id);
        const predecessor = latest?.activeSessions?.find((session) => session.jti === payload.jti);
        const rotationAge = predecessor?.rotatedAt
          ? now.getTime() - new Date(predecessor.rotatedAt).getTime()
          : Number.POSITIVE_INFINITY;
        if (!predecessor?.rotatedToJti || rotationAge > REFRESH_ROTATION_GRACE_MS) {
          throw new Unauthorized("Refresh token has been revoked");
        }
        newJti = predecessor.rotatedToJti;
      }
    }
    if (!newJti) throw new Unauthorized("Refresh token session is invalid");
    await userRepository.pruneRotatedSessions(
      user._id,
      new Date(now.getTime() - REFRESH_ROTATION_GRACE_MS),
    );

    const activeTenantId = (payload as { tenantId?: string }).tenantId;

    const accessToken = tokenUtil.signAccessToken({
      userId: user._id.toString(),
      role: resolved.baseRole,
      roleId: String(resolved.role._id),
      jti: newJti,
      tenantId: activeTenantId,
    });
    const newRefreshToken = tokenUtil.signRefreshToken({
      userId: user._id.toString(),
      role: resolved.baseRole,
      roleId: String(resolved.role._id),
      jti: newJti,
      tenantId: activeTenantId,
    });

    const rolePayload = await buildRolePayload(resolved.role as unknown as IRole, user);

    return { accessToken, refreshToken: newRefreshToken, role: rolePayload };
  },

  /** Rotate the current session into another explicitly assigned active role. */
  async switchRole(
    userId: string,
    currentJti: string | undefined,
    targetRole: string,
    req: Request,
  ) {
    const user = await userRepository.findByIdWithSessions(userId);
    if (!user) throw new Unauthorized("User not found");
    if (user.status !== "active") throw new Forbidden("Account is not active");
    const resolved = await resolveRole(user, targetRole);
    if (currentJti && !user.activeSessions?.some((session) => session.jti === currentJti)) {
      throw new Unauthorized("Current session has been revoked");
    }

    const newJti = randomUUID();
    if (currentJti) {
      await userRepository.updateById(user._id, {
        $pull: { activeSessions: { jti: currentJti } },
      } as Record<string, unknown>);
    }
    await userRepository.updateById(user._id, {
      $push: {
        activeSessions: {
          $each: [{ jti: newJti, device: "role_switch", ip: req.ip ?? "", createdAt: new Date() }],
          $slice: -10,
        },
      },
    } as Record<string, unknown>);

    const tokenPayload = {
      userId: user._id.toString(),
      role: resolved.baseRole,
      roleId: String(resolved.role._id),
      jti: newJti,
      tenantId: req.tenantId,
    };
    const accessToken = tokenUtil.signAccessToken(tokenPayload);
    const refreshToken = tokenUtil.signRefreshToken(tokenPayload);
    const role = await buildRolePayload(resolved.role as unknown as IRole, user);

    await auditLogRepository.create({
      user: user as unknown as IUser,
      action: "ACTIVE_ROLE_SWITCHED",
      module: Module.USER_MANAGEMENT,
      description: `Active role switched to: ${resolved.role.name}`,
      req,
    });

    return { accessToken, refreshToken, role, activeRole: resolved.baseRole };
  },

  /**
   * Send email OTP for password reset.
   */
  async forgotPassword(email: string, req?: Request) {
    const user = await userRepository.findByEmail(email);
    // Return silently even if user not found to avoid user enumeration
    if (!user) return;

    // Invalidate any existing OTPs for this email+purpose
    await OtpModel.deleteMany({ email, purpose: OtpPurpose.FORGOT_PASSWORD });

    const rawOtp = otpUtil.generate();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);

    await OtpModel.create({
      userId: user._id,
      email: user.email,
      otp: hashedOtp,
      purpose: OtpPurpose.FORGOT_PASSWORD,
      expiresAt: otpUtil.expiryDate(),
    });

    const portalUrl = resolveRequestAppBaseUrl(req);

    // Send OTP via email (fire-and-forget — don't block response on SMTP failure)
    emailService
      .sendPasswordReset(user.email, user.name ?? user.email, rawOtp, "", portalUrl)
      .catch((err: unknown) => logger.error("[auth] Failed to send password-reset email", err));

    return { otp: configs.NODE_ENV !== "production" ? rawOtp : undefined };
  },

  /**
   * Reset password after OTP verification.
   */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const otpDoc = await OtpModel.findOne({
      email,
      purpose: OtpPurpose.FORGOT_PASSWORD,
      isUsed: false,
    }).select("+otp");

    if (!otpDoc) throw new BadRequest("Invalid or expired OTP");
    if (otpUtil.isExpired(otpDoc.expiresAt)) throw new BadRequest("OTP has expired");
    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS)
      throw new TooManyRequests("Too many wrong attempts. Request a new OTP.");

    const isMatch = await bcrypt.compare(otp, otpDoc.otp);
    if (!isMatch) {
      await OtpModel.findByIdAndUpdate(otpDoc._id, { $inc: { attempts: 1 } });
      throw new BadRequest("Incorrect OTP");
    }

    // Mark OTP used
    await OtpModel.findByIdAndUpdate(otpDoc._id, { isUsed: true });

    const hashed = await hashPassword(newPassword);
    await userRepository.updateById(otpDoc.userId!, {
      password: hashed,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      status: "active",
      isEmailVerified: true,
    });
  },

  /**
   * Verify email using OTP.
   */
  async verifyEmail(email: string, otp: string) {
    const otpDoc = await OtpModel.findOne({
      email,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      isUsed: false,
    }).select("+otp");

    if (!otpDoc) throw new BadRequest("Invalid or expired OTP");
    if (otpUtil.isExpired(otpDoc.expiresAt)) throw new BadRequest("OTP has expired");

    const isMatch = await bcrypt.compare(otp, otpDoc.otp);
    if (!isMatch) {
      await OtpModel.findByIdAndUpdate(otpDoc._id, { $inc: { attempts: 1 } });
      throw new BadRequest("Incorrect OTP");
    }

    await OtpModel.findByIdAndUpdate(otpDoc._id, { isUsed: true });
    await userRepository.updateById(otpDoc.userId!, { isEmailVerified: true });
  },

  /**
   * Change own password (authenticated).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId, true);
    if (!user) throw new NotFound("User not found");

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) throw new Unauthorized("Current password is incorrect");

    const hashed = await hashPassword(newPassword);
    await userRepository.updateById(userId, {
      password: hashed,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });
  },

  // ─── Session management (M1 — Concurrent Session / Force Logout) ───────────

  async getSessions(userId: string) {
    const user = await userRepository.findByIdWithSessions(userId);
    return user?.activeSessions ?? [];
  },

  async revokeSession(userId: string, jti: string) {
    await userRepository.updateById(userId, {
      $pull: { activeSessions: { jti } },
    } as Record<string, unknown>);
  },

  async revokeAllSessions(userId: string, exceptJti?: string) {
    if (exceptJti) {
      // keep the current session, remove all others
      await userRepository.updateById(userId, {
        $pull: { activeSessions: { jti: { $ne: exceptJti } } },
      } as Record<string, unknown>);
    } else {
      await userRepository.updateById(userId, {
        $set: { activeSessions: [] },
      });
    }
  },
};
