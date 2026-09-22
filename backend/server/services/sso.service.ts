import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import createError from "http-errors";
import type { Request } from "express";
import { SystemRole } from "../constants/roles";
import { SsoConfigurationModel, SsoStateModel, type TSsoProvider } from "../models/sso.model";
import type { IUser } from "../models/user.model";
import type { IRole } from "../models/role.model";
import { userRepository } from "../repositories/user.repository";
import { roleRepository } from "../repositories/role.repository";
import { cryptoUtil } from "../utils/crypto.util";
import { authService, createMfaLoginChallenge } from "./auth.service";

const CALLBACK_PATH = "/auth/sso/callback";
const providerSet = new Set<TSsoProvider>(["google", "microsoft"]);
const provisionableRoles = new Set<SystemRole>([
  SystemRole.FACULTY,
  SystemRole.STUDENT,
  SystemRole.PARENT,
  SystemRole.ADMISSION_COUNSELOR,
  SystemRole.ADMINISTRATION_OFFICE,
]);
const PROVIDER_TIMEOUT_MS = 12_000;

function provider(value: string): TSsoProvider {
  if (!providerSet.has(value as TSsoProvider)) throw createError(400, "Unsupported SSO provider");
  return value as TSsoProvider;
}
function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
function callbackUrl(returnUrl: string) {
  const url = new URL(returnUrl);
  return `${url.origin}${url.pathname}`;
}
export function normalizeSsoReturnUrl(value: string, requestOrigin?: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw createError(400, "Invalid SSO return URL");
  if (!requestOrigin || new URL(requestOrigin).origin !== url.origin)
    throw createError(400, "SSO return URL must match the requesting application origin");
  if (!new RegExp(`^(?:/[a-z0-9-]+)?${CALLBACK_PATH}$`, "i").test(url.pathname))
    throw createError(400, "Invalid SSO callback path");
  return `${url.origin}${url.pathname}`;
}
export function resolveSsoLoginRole(roles: SystemRole[], platformContext: boolean) {
  if (platformContext) {
    if (!roles.includes(SystemRole.SUPER_ADMIN))
      throw createError(403, "This portal is restricted to platform administrators");
    return SystemRole.SUPER_ADMIN;
  }
  const role = roles[0];
  if (!role) throw createError(403, "Your ERP account has no assigned role");
  return role;
}
function endpoints(providerName: TSsoProvider, tenantId?: string) {
  if (providerName === "google") {
    return {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
    };
  }
  const tenant = tenantId?.trim() || "common";
  if (!/^[a-zA-Z0-9.-]{3,100}$/.test(tenant)) throw createError(400, "Invalid Microsoft tenant ID");
  return {
    authorization: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    userinfo: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile User.Read",
  };
}
function discoveryUrl(providerName: TSsoProvider, tenantId?: string) {
  return providerName === "google"
    ? "https://accounts.google.com/.well-known/openid-configuration"
    : `https://login.microsoftonline.com/${tenantId?.trim() || "common"}/v2.0/.well-known/openid-configuration`;
}
async function providerFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch {
    throw createError(502, "Identity provider could not be reached. Please try again.");
  }
}
async function recordProviderFailure(id: string, message: string) {
  await SsoConfigurationModel.updateOne(
    { _id: id },
    {
      $set: {
        status: "error",
        lastTestedAt: new Date(),
        lastError: message.slice(0, 500),
      },
    },
  );
}
function publicConfig(row: {
  provider: TSsoProvider;
  enabled: boolean;
  clientId: string;
  clientSecretCiphertext?: string;
  microsoftTenantId?: string;
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole?: string;
  updatedAt?: Date;
  status?: string;
  lastTestedAt?: Date;
  lastSucceededAt?: Date;
  lastError?: string;
}) {
  return {
    provider: row.provider,
    enabled: row.enabled,
    clientId: row.clientId,
    hasClientSecret: Boolean(row.clientSecretCiphertext),
    microsoftTenantId: row.microsoftTenantId,
    allowedDomains: row.allowedDomains,
    autoProvision: row.autoProvision,
    defaultRole: row.defaultRole,
    updatedAt: row.updatedAt,
    status: row.enabled ? (row.status ?? "configured") : "disabled",
    lastTestedAt: row.lastTestedAt,
    lastSucceededAt: row.lastSucceededAt,
    lastError: row.lastError,
  };
}

export const ssoService = {
  async providers() {
    const rows = await SsoConfigurationModel.find({ enabled: true }).select("provider").lean();
    return rows.map((row) => row.provider);
  },
  async configurations() {
    const rows = await SsoConfigurationModel.find().select("+clientSecretCiphertext").lean();
    const providers = (["google", "microsoft"] as TSsoProvider[]).map((name) => {
      const row = rows.find((item) => item.provider === name);
      return row
        ? publicConfig(row)
        : {
            provider: name,
            enabled: false,
            hasClientSecret: false,
            allowedDomains: [],
            autoProvision: false,
            status: "disabled",
          };
    });
    return { providers, provisionableRoles: Array.from(provisionableRoles) };
  },
  async saveConfiguration(
    providerValue: string,
    input: {
      enabled?: boolean;
      clientId?: string;
      clientSecret?: string;
      microsoftTenantId?: string;
      allowedDomains?: string[];
      autoProvision?: boolean;
      defaultRole?: string;
    },
    userId: string,
    platformContext = false,
  ) {
    const providerName = provider(providerValue);
    const existing = await SsoConfigurationModel.findOne({ provider: providerName }).select(
      "+clientSecretCiphertext",
    );
    const clientId = String(input.clientId ?? existing?.clientId ?? "").trim();
    const secret = String(input.clientSecret ?? "").trim();
    if (providerName === "google" && !clientId.endsWith(".apps.googleusercontent.com"))
      throw createError(400, "Google client ID must end with .apps.googleusercontent.com");
    const secretCiphertext = secret ? cryptoUtil.encrypt(secret) : existing?.clientSecretCiphertext;
    if (!clientId || !secretCiphertext)
      throw createError(400, "Client ID and client secret are required");
    const allowedDomains = Array.from(
      new Set(
        (input.allowedDomains ?? existing?.allowedDomains ?? [])
          .map((domain) => domain.trim().toLowerCase())
          .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)),
      ),
    );
    const autoProvision = platformContext ? false : Boolean(input.autoProvision);
    const defaultRole = platformContext ? undefined : (input.defaultRole ?? existing?.defaultRole);
    if (autoProvision && !provisionableRoles.has(defaultRole as SystemRole))
      throw createError(400, "Choose a permitted default role for automatic provisioning");
    const row = await SsoConfigurationModel.findOneAndUpdate(
      { provider: providerName },
      {
        $set: {
          enabled: Boolean(input.enabled),
          clientId,
          clientSecretCiphertext: secretCiphertext,
          microsoftTenantId:
            providerName === "microsoft"
              ? String(input.microsoftTenantId ?? "common").trim()
              : undefined,
          allowedDomains,
          autoProvision,
          defaultRole,
          status: input.enabled ? "configured" : "disabled",
          lastError: undefined,
          updatedBy: userId,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .select("+clientSecretCiphertext")
      .lean();
    if (!row) throw createError(500, "SSO configuration could not be saved");
    return publicConfig(row);
  },
  async testConfiguration(providerValue: string) {
    const providerName = provider(providerValue);
    const config = await SsoConfigurationModel.findOne({ provider: providerName })
      .select("+clientSecretCiphertext")
      .lean();
    if (!config?.clientId || !config.clientSecretCiphertext)
      throw createError(400, "Save the client ID and client secret before testing");
    try {
      const response = await providerFetch(discoveryUrl(providerName, config.microsoftTenantId));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const discovery = (await response.json()) as {
        issuer?: string;
        authorization_endpoint?: string;
        token_endpoint?: string;
      };
      if (!discovery.issuer || !discovery.authorization_endpoint || !discovery.token_endpoint)
        throw new Error("Invalid discovery document");
      const testedAt = new Date();
      await SsoConfigurationModel.updateOne(
        { provider: providerName },
        {
          $set: { status: "healthy", lastTestedAt: testedAt, lastSucceededAt: testedAt },
          $unset: { lastError: 1 },
        },
      );
      return {
        provider: providerName,
        status: "healthy",
        testedAt,
        message: "Provider discovery and tenant configuration are reachable",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Provider validation failed";
      await SsoConfigurationModel.updateOne(
        { provider: providerName },
        { $set: { status: "error", lastTestedAt: new Date(), lastError: message } },
      );
      if (createError.isHttpError(error)) throw error;
      throw createError(502, "Identity provider configuration could not be verified");
    }
  },
  async start(providerValue: string, returnUrlValue: string, requestOrigin?: string) {
    const providerName = provider(providerValue);
    const config = await SsoConfigurationModel.findOne({ provider: providerName, enabled: true })
      .select("+clientSecretCiphertext")
      .lean();
    if (!config) throw createError(404, `${providerName} SSO is not enabled`);
    const returnUrl = normalizeSsoReturnUrl(returnUrlValue, requestOrigin);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    await SsoStateModel.create({
      stateHash: sha256(state),
      provider: providerName,
      codeVerifierCiphertext: cryptoUtil.encrypt(verifier),
      returnUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const endpoint = endpoints(providerName, config.microsoftTenantId);
    const url = new URL(endpoint.authorization);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl(returnUrl));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", endpoint.scope);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", sha256(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return { authorizationUrl: url.toString() };
  },
  async complete(code: string, state: string, req: Request) {
    const platformContext = req.headers["x-platform-context"] === "true";
    const stateRow = await SsoStateModel.findOneAndDelete({
      stateHash: sha256(state),
      expiresAt: { $gt: new Date() },
    }).select("+codeVerifierCiphertext");
    if (!stateRow) throw createError(401, "SSO state is invalid, expired or already used");
    const config = await SsoConfigurationModel.findOne({
      provider: stateRow.provider,
      enabled: true,
    }).select("+clientSecretCiphertext");
    if (!config?.clientSecretCiphertext) throw createError(401, "SSO provider is unavailable");
    const endpoint = endpoints(config.provider, config.microsoftTenantId);
    let tokenResponse: Response;
    try {
      tokenResponse = await providerFetch(endpoint.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: cryptoUtil.decrypt(config.clientSecretCiphertext),
          code,
          code_verifier: cryptoUtil.decrypt(stateRow.codeVerifierCiphertext),
          redirect_uri: callbackUrl(stateRow.returnUrl),
          grant_type: "authorization_code",
        }),
      });
    } catch (error) {
      await recordProviderFailure(
        config._id.toString(),
        "Identity provider token endpoint is unreachable",
      );
      throw error;
    }
    if (!tokenResponse.ok) {
      await recordProviderFailure(
        config._id.toString(),
        "Identity provider rejected the authorization code",
      );
      throw createError(401, "Identity provider rejected the authorization code");
    }
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token)
      throw createError(401, "Identity provider did not return an access token");
    let profileResponse: Response;
    try {
      profileResponse = await providerFetch(endpoint.userinfo, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
    } catch (error) {
      await recordProviderFailure(
        config._id.toString(),
        "Identity provider profile endpoint is unreachable",
      );
      throw error;
    }
    if (!profileResponse.ok) {
      await recordProviderFailure(config._id.toString(), "Unable to verify the identity profile");
      throw createError(401, "Unable to verify the identity profile");
    }
    const profile = (await profileResponse.json()) as {
      email?: string;
      preferred_username?: string;
      name?: string;
      email_verified?: boolean;
    };
    const email = String(profile.email ?? profile.preferred_username ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw createError(401, "Identity provider did not return a valid email address");
    if (config.provider === "google" && profile.email_verified !== true)
      throw createError(401, "Google email address is not verified");
    const domain = email.split("@")[1] ?? "";
    if (config.allowedDomains.length && !config.allowedDomains.includes(domain))
      throw createError(403, "Your email domain is not permitted for this institution");
    let user = (await userRepository.findByEmail(email, true)) as unknown as IUser | null;
    if (!user && config.autoProvision && !platformContext) {
      const role = config.defaultRole as SystemRole;
      if (!provisionableRoles.has(role))
        throw createError(403, "Automatic provisioning role is invalid");
      user = (await userRepository.create({
        name: String(profile.name ?? email.split("@")[0]).slice(0, 255),
        email,
        password: await bcrypt.hash(randomBytes(48).toString("base64url"), 12),
        roles: [role],
        status: "active",
        isEmailVerified: true,
      })) as unknown as IUser;
    }
    if (!user) throw createError(403, "No ERP account is linked to this email address");
    if (user.status !== "active") throw createError(403, "Your ERP account is not active");
    const role = resolveSsoLoginRole(user.roles, platformContext);
    const roleDoc = await roleRepository.findByName(role);
    if (!roleDoc || roleDoc.isActive === false)
      throw createError(403, "Your assigned ERP role is inactive");
    const result = user.mfaEnabled
      ? createMfaLoginChallenge(user as IUser, role, String(roleDoc._id))
      : await authService.issueLoginTokens(user as IUser, role, roleDoc as unknown as IRole, req);
    await SsoConfigurationModel.updateOne(
      { _id: config._id },
      { $set: { status: "healthy", lastSucceededAt: new Date() }, $unset: { lastError: 1 } },
    );
    return result;
  },
};
