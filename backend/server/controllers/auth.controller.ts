import type { RequestHandler } from "express";
import { authService } from "../services/auth.service";
import { responseUtil } from "../utils/response.util";
import { cryptoUtil } from "../utils/crypto.util";
import { generateSecret, generateURI } from "otplib";
import { verify as totpVerifyFn } from "otplib";
import QRCode from "qrcode";
import { UserModel } from "../models/user.model";
import { configs } from "../configs";

const totp = {
  verify: async (token: string, secret: string): Promise<boolean> => {
    if (!token || !/^\d{6}$/.test(token)) return false;
    try {
      const result = (await totpVerifyFn({
        token: token.trim(),
        secret,
        strategy: "totp",
        epochTolerance: 30,
      })) as unknown;
      if (typeof result === "boolean") return result;
      if (result && typeof result === "object") {
        const r = result as { valid?: boolean; isValid?: boolean };
        return r.valid === true || r.isValid === true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

export const authController: Record<string, RequestHandler> = {
  /** GET /auth/context — authoritative active-role policy for client hydration. */
  async context(req, res, next) {
    try {
      const role = req.role;
      responseUtil.success(res, {
        activeRole: req.activeRole,
        role: role
          ? {
              _id: String(role._id),
              name: role.name,
              displayName: role.displayName,
              permissions: role.permissions ?? [],
              allowedNavItems: (role.allowedNavItems ?? []).map(String),
              isSystem: role.isSystem,
              baseRole: role.baseRole,
            }
          : null,
      });
    } catch (err) {
      next(err);
    }
  },
  /** GET /auth/invite/:token */
  async resolveInvite(req, res, next) {
    try {
      const result = await authService.resolveInviteToken(req.params["token"] ?? "");
      responseUtil.success(res, result, "Invite resolved");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/invite/complete */
  async completeInvite(req, res, next) {
    try {
      await authService.completeInvite(req.body.token, req.body.password);
      responseUtil.success(res, undefined, "Account activated. You can now log in.");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/login */
  async login(req, res, next) {
    try {
      const { identifier, email, password, role } = req.body;
      const result = await authService.login(identifier ?? email, password, role, req);
      responseUtil.success(res, result, "Login successful");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/mfa/login-verify — finish login by submitting TOTP code */
  async mfaLoginVerify(req, res, next) {
    try {
      const { mfaToken, code } = req.body;
      const result = await authService.loginVerifyMfa(mfaToken, code, req);
      responseUtil.success(res, result, "Login successful");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/refresh-token */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      responseUtil.success(res, result, "Token refreshed");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/switch-role — rotate tokens into another assigned role. */
  async switchRole(req, res, next) {
    try {
      const result = await authService.switchRole(
        req.user!._id.toString(),
        req.jti,
        req.body.role,
        req,
      );
      responseUtil.success(res, result, "Active role switched");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/forgot-password */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email, req);
      responseUtil.success(res, result, "If the email exists, an OTP has been sent");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/reset-password */
  async resetPassword(req, res, next) {
    try {
      const { email, otp, newPassword } = req.body;
      await authService.resetPassword(email, otp, newPassword);
      responseUtil.success(res, undefined, "Password reset successfully");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/verify-email */
  async verifyEmail(req, res, next) {
    try {
      const { email, otp } = req.body;
      await authService.verifyEmail(email, otp);
      responseUtil.success(res, undefined, "Email verified successfully");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/change-password */
  async changePassword(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(userId, currentPassword, newPassword);
      responseUtil.success(res, undefined, "Password changed successfully");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/mfa/setup — generate TOTP secret + QR code */
  async mfaSetup(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const user = (await UserModel.findById(userId).select("+mfaSecret").lean().exec()) as
        | (import("../models/user.model").IUser & { mfaSecret?: string })
        | null;
      if (!user) return next({ status: 404, message: "User not found" });
      const realSecret = generateSecret();
      const otpAuthUrl = generateURI({
        issuer: configs.APP_NAME,
        label: user.email,
        secret: realSecret,
        strategy: "totp",
      });
      const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
      // Encrypt secret before persisting (AES-256-GCM, SRS §10.2)
      const encryptedSecret = cryptoUtil.encrypt(realSecret);
      await UserModel.findByIdAndUpdate(userId, { $set: { mfaSecret: encryptedSecret } }).exec();
      responseUtil.success(
        res,
        { qrDataUrl, secret: realSecret },
        "Scan the QR code with your authenticator app",
      );
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/mfa/verify — confirm TOTP token to activate MFA */
  async mfaVerify(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const { token } = req.body;
      const user = (await UserModel.findById(userId).select("+mfaSecret").lean().exec()) as
        | (import("../models/user.model").IUser & { mfaSecret?: string })
        | null;
      if (!user?.mfaSecret) return next({ status: 400, message: "Run MFA setup first" });
      // Decrypt before use
      const plainSecret = cryptoUtil.decrypt(user.mfaSecret);
      const isValid = await totp.verify(token, plainSecret);
      if (!isValid)
        return next({
          status: 400,
          message:
            "Invalid or expired authenticator code. Enable automatic date and time on your device and try the newest code.",
        });
      await UserModel.findByIdAndUpdate(userId, { $set: { mfaEnabled: true } }).exec();
      responseUtil.success(res, undefined, "MFA enabled successfully");
    } catch (err) {
      next(err);
    }
  },

  /** POST /auth/mfa/disable — disable MFA (requires current TOTP token) */
  async mfaDisable(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const { token } = req.body;
      const user = (await UserModel.findById(userId).select("+mfaSecret").lean().exec()) as
        | (import("../models/user.model").IUser & { mfaSecret?: string })
        | null;
      if (!user?.mfaSecret) return next({ status: 400, message: "MFA is not set up" });
      const plainSecret = cryptoUtil.decrypt(user.mfaSecret);
      const isValid = await totp.verify(token, plainSecret);
      if (!isValid)
        return next({
          status: 400,
          message:
            "Invalid or expired authenticator code. Enable automatic date and time on your device and try the newest code.",
        });
      await UserModel.findByIdAndUpdate(userId, {
        $set: { mfaEnabled: false, mfaSecret: null },
      }).exec();
      responseUtil.success(res, undefined, "MFA disabled");
    } catch (err) {
      next(err);
    }
  },

  // ─── Session Management (M1) ───────────────────────────────────────────────
  /** GET /auth/sessions — list active sessions for current user */
  async listSessions(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const sessions = await authService.getSessions(userId);
      const currentJti = req.jti;
      const enriched = sessions.map((s) => ({
        jti: s.jti,
        device: s.device,
        ip: s.ip,
        createdAt: s.createdAt,
        isCurrent: s.jti === currentJti,
      }));
      responseUtil.success(res, enriched);
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /auth/sessions/:jti — revoke a specific session */
  async revokeSession(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      await authService.revokeSession(userId, req.params.jti);
      responseUtil.success(res, undefined, "Session revoked");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /auth/sessions — revoke ALL sessions (force logout everywhere) */
  async revokeAllSessions(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const currentJti = req.jti;
      const { keepCurrent } = req.query;
      await authService.revokeAllSessions(userId, keepCurrent === "true" ? currentJti : undefined);
      responseUtil.success(res, undefined, "All sessions revoked");
    } catch (err) {
      next(err);
    }
  },

  // ── Mobile MPIN ─────────────────────────────────────────────────────────────

  /**
   * POST /auth/mpin/setup
   * Store a bcrypt hash of the user's mobile MPIN server-side.
   * The mobile client hashes the raw 4–6 digit PIN with bcrypt (cost 10) before
   * sending it here — we store the hash as-is so the raw PIN never touches the wire.
   */
  async mpinSetup(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const { mpinHash } = req.body as { mpinHash: string };

      await UserModel.findByIdAndUpdate(userId, { mpinHash });
      responseUtil.success(res, undefined, "MPIN saved successfully");
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /auth/mpin
   * Clear the stored MPIN hash (e.g., when user resets MPIN from settings).
   * The mobile app will redirect to setup-mpin on next unlock attempt.
   */
  async mpinClear(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      await UserModel.findByIdAndUpdate(userId, { $unset: { mpinHash: 1 } });
      responseUtil.success(res, undefined, "MPIN cleared");
    } catch (err) {
      next(err);
    }
  },
};
