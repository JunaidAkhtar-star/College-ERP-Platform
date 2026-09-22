import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { configs } from "../configs";

export interface AccessTokenPayload {
  userId: string;
  role: string; // active role chosen at login
  roleId?: string; // exact configured Role document selected for this session
  jti?: string; // JWT ID for session tracking
  tenantId?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  role?: string; // retained from login role for rotation
  roleId?: string;
  jti?: string;
  tenantId?: string;
}

/** 1 hour for access token, 7 days for refresh token. */
const ACCESS_EXPIRES = "1h";
const REFRESH_EXPIRES = "7d";

export const tokenUtil = {
  signAccessToken(payload: AccessTokenPayload): string {
    const jti = payload.jti ?? randomUUID();
    return jwt.sign({ ...payload, jti }, configs.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
  },

  signRefreshToken(payload: RefreshTokenPayload): string {
    const jti = payload.jti ?? randomUUID();
    return jwt.sign({ ...payload, jti }, configs.JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES,
    });
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, configs.JWT_SECRET) as AccessTokenPayload;
  },

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, configs.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  },
};

export { randomUUID };
