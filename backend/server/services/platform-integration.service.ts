import createError from "http-errors";
import nodemailer from "nodemailer";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import {
  PlatformIntegrationModel,
  type PlatformIntegrationProvider,
} from "../models/platform-integration.model";
import { cryptoUtil } from "../utils/crypto.util";
import { logger } from "../utils/logger.util";

type ProviderConfig = Record<string, string | number | boolean>;

const PROVIDERS: PlatformIntegrationProvider[] = [
  "google_drive",
  "agora",
  "firebase",
  "smtp",
  "cloudinary",
];
const DEFINITIONS = {
  google_drive: {
    group: "Google",
    label: "Google Drive backup",
    description: "OAuth connection for tenant-owned encrypted Drive backups.",
    features: ["Encrypted backups", "Scheduled retention", "Tenant Drive authorization"],
    secretLabel: "OAuth client secret",
    fields: [
      { key: "clientId", label: "OAuth client ID", placeholder: "0000.apps.googleusercontent.com" },
      {
        key: "callbackUrl",
        label: "Authorized redirect URI",
        placeholder: "https://api.example.com/api/v1/tenant-backup/google/callback",
      },
    ],
  },
  agora: {
    group: "Agora",
    label: "Video and voice",
    description: "Video meetings and voice calling for entitled tenant workspaces.",
    features: ["Video meetings", "Voice calls", "Meeting rooms"],
    secretLabel: "App certificate",
    fields: [{ key: "appId", label: "Agora App ID", placeholder: "32-character application ID" }],
  },
  firebase: {
    group: "Firebase",
    label: "Push notifications",
    description: "Platform push delivery for browser, Android and iOS devices.",
    features: ["Web push", "Mobile push", "Delivery readiness"],
    secretLabel: "Service account private key",
    multilineSecret: true,
    fields: [
      { key: "projectId", label: "Project ID", placeholder: "your-firebase-project" },
      {
        key: "clientEmail",
        label: "Service account email",
        placeholder: "firebase-adminsdk@project.iam.gserviceaccount.com",
      },
      { key: "apiKey", label: "Web API key", placeholder: "Firebase web API key" },
      { key: "authDomain", label: "Auth domain", placeholder: "project.firebaseapp.com" },
      { key: "messagingSenderId", label: "Messaging sender ID", placeholder: "Numeric sender ID" },
      { key: "appId", label: "Web application ID", placeholder: "1:000:web:xxxx" },
      { key: "vapidKey", label: "Web push VAPID key", placeholder: "Public VAPID key" },
    ],
  },
  smtp: {
    group: "SMTP",
    label: "Email delivery",
    description: "Central transactional email transport for platform messages.",
    features: ["Transactional email", "Branded sender", "Connection verification"],
    secretLabel: "SMTP password",
    fields: [
      { key: "host", label: "SMTP host", placeholder: "smtp.example.com" },
      { key: "port", label: "Port", placeholder: "587", type: "number" },
      { key: "secure", label: "Use TLS immediately", type: "toggle" },
      { key: "username", label: "Username", placeholder: "mailer@example.com" },
      { key: "fromName", label: "Sender name", placeholder: "Devvelocity" },
      { key: "fromEmail", label: "Sender email", placeholder: "noreply@example.com" },
      { key: "replyTo", label: "Reply-to email", placeholder: "support@example.com" },
    ],
  },
  cloudinary: {
    group: "Cloudinary",
    label: "File and media storage",
    description: "Managed storage for documents, images and meeting recordings.",
    features: ["Document uploads", "Optimized images", "Meeting recordings"],
    secretLabel: "API secret",
    fields: [
      { key: "cloudName", label: "Cloud name", placeholder: "Your Cloudinary cloud name" },
      { key: "apiKey", label: "API key", placeholder: "Cloudinary API key" },
    ],
  },
} satisfies Record<PlatformIntegrationProvider, Record<string, unknown>>;

function required(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw createError(400, `${label} is required.`);
  return result;
}

function validate(provider: PlatformIntegrationProvider, input: Record<string, unknown>) {
  if (provider === "google_drive") {
    const clientId = required(input.clientId, "Google client ID");
    const callbackUrl = required(input.callbackUrl, "Google Drive callback URL");
    if (!clientId.endsWith(".apps.googleusercontent.com"))
      throw createError(400, "Google client ID must end with .apps.googleusercontent.com.");
    try {
      const parsed = new URL(callbackUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error();
    } catch {
      throw createError(400, "Google Drive callback must be an HTTPS URL.");
    }
    return { clientId, callbackUrl };
  }
  if (provider === "agora") {
    const appId = required(input.appId, "Agora App ID");
    if (!/^[a-f0-9]{32}$/i.test(appId))
      throw createError(400, "Agora App ID must contain 32 hexadecimal characters.");
    return { appId };
  }
  if (provider === "firebase") {
    return {
      projectId: required(input.projectId, "Firebase project ID"),
      clientEmail: required(input.clientEmail, "Firebase client email").toLowerCase(),
      apiKey: required(input.apiKey, "Firebase web API key"),
      authDomain: required(input.authDomain, "Firebase auth domain"),
      messagingSenderId: required(input.messagingSenderId, "Messaging sender ID"),
      appId: required(input.appId, "Firebase web app ID"),
      vapidKey: required(input.vapidKey, "Firebase VAPID key"),
    };
  }
  if (provider === "smtp") {
    const port = Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw createError(400, "SMTP port must be between 1 and 65535.");
    return {
      host: required(input.host, "SMTP host"),
      port,
      secure: Boolean(input.secure),
      username: required(input.username, "SMTP username"),
      fromName: required(input.fromName, "Sender name"),
      fromEmail: required(input.fromEmail, "Sender email").toLowerCase(),
      replyTo: String(input.replyTo ?? "")
        .trim()
        .toLowerCase(),
    };
  }
  return {
    cloudName: required(input.cloudName, "Cloudinary cloud name"),
    apiKey: required(input.apiKey, "Cloudinary API key"),
  };
}

async function record(provider: PlatformIntegrationProvider, includeSecret = false) {
  const query = PlatformIntegrationModel.findOne({ provider });
  return includeSecret ? query.select("+secretCiphertext").lean() : query.lean();
}

async function verifyProvider(
  provider: PlatformIntegrationProvider,
  config: ProviderConfig,
  secret: string,
) {
  if (provider === "google_drive") {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: String(config.clientId),
        client_secret: secret,
        code: "devvelocity-readiness-check",
        redirect_uri: String(config.callbackUrl),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok && result.error !== "invalid_grant")
      throw new Error(
        result.error === "invalid_client"
          ? "Google OAuth client ID or secret is invalid."
          : `Google OAuth readiness failed: ${result.error || response.status}`,
      );
    return;
  }
  if (provider === "agora") {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      String(config.appId),
      secret,
      "integration-readiness",
      "health-check",
      RtcRole.SUBSCRIBER,
      expiresAt,
      expiresAt,
    );
    if (!token) throw new Error("Agora token generation failed.");
    return;
  }
  if (provider === "firebase") {
    const admin = require("firebase-admin") as typeof import("firebase-admin");
    const credential = admin.credential.cert({
      projectId: String(config.projectId),
      clientEmail: String(config.clientEmail),
      privateKey: secret.replace(/\\n/g, "\n"),
    });
    await credential.getAccessToken();
    return;
  }
  if (provider === "smtp") {
    const transporter = nodemailer.createTransport({
      host: String(config.host),
      port: Number(config.port),
      secure: Boolean(config.secure),
      auth: { user: String(config.username), pass: secret },
    });
    await transporter.verify();
    transporter.close();
    return;
  }
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(String(config.cloudName))}/resources/image?max_results=1`;
  const username = String(config.apiKey);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${DEFINITIONS[provider].label} credentials were rejected.`);
}

export const platformIntegrationService = {
  async list() {
    const rows = await PlatformIntegrationModel.find().select("+secretCiphertext").lean();
    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    return PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return {
        ...DEFINITIONS[provider],
        provider,
        enabled: row?.enabled ?? false,
        status: row?.status ?? "not_configured",
        config: row?.config ?? {},
        hasSecret: Boolean(row?.secretCiphertext),
        lastTestedAt: row?.lastTestedAt,
        lastSucceededAt: row?.lastSucceededAt,
        lastError: row?.lastError,
      };
    });
  },

  async save(
    provider: PlatformIntegrationProvider,
    input: {
      enabled?: boolean;
      config?: Record<string, unknown>;
      secret?: string;
      updatedBy?: string;
    },
  ) {
    const existing = await record(provider, true);
    const config = validate(provider, input.config ?? existing?.config ?? {});
    const suppliedSecret = String(input.secret || "").trim();
    const secretCiphertext = suppliedSecret
      ? cryptoUtil.encrypt(suppliedSecret)
      : existing?.secretCiphertext;
    if (!secretCiphertext)
      throw createError(400, `${String(DEFINITIONS[provider].secretLabel)} is required.`);
    const enabled = Boolean(input.enabled);
    return PlatformIntegrationModel.findOneAndUpdate(
      { provider },
      {
        $set: {
          provider,
          enabled,
          config,
          secretCiphertext,
          status: enabled ? "configured" : "disabled",
          updatedBy: input.updatedBy,
        },
        $unset: { lastError: 1 },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
  },

  async test(provider: PlatformIntegrationProvider) {
    const row = await record(provider, true);
    if (!row?.secretCiphertext) throw createError(409, "Save the integration credentials first.");
    const testedAt = new Date();
    try {
      await verifyProvider(
        provider,
        row.config as ProviderConfig,
        cryptoUtil.decrypt(row.secretCiphertext),
      );
      return PlatformIntegrationModel.findOneAndUpdate(
        { provider },
        {
          $set: {
            status: row.enabled ? "healthy" : "disabled",
            lastTestedAt: testedAt,
            lastSucceededAt: testedAt,
          },
          $unset: { lastError: 1 },
        },
        { returnDocument: "after" },
      ).lean();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Integration test failed.";
      await PlatformIntegrationModel.updateOne(
        { provider },
        { $set: { status: "error", lastTestedAt: testedAt, lastError: message } },
      );
      throw createError(502, message);
    }
  },

  async getFirebaseClientConfig() {
    const creds = await this.credentials<Record<string, unknown>>("firebase");
    if (!creds) throw createError(409, "Platform Firebase is not enabled and connection-tested.");
    const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, vapidKey } =
      creds.config;
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      vapidKey,
    };
  },

  async credentials<TConfig extends Record<string, unknown>>(
    provider: PlatformIntegrationProvider,
  ): Promise<{ config: TConfig; secret: string } | null> {
    const row = await record(provider, true);
    if (!row?.enabled || row.status !== "healthy" || !row.secretCiphertext) return null;
    try {
      const secret = cryptoUtil.decrypt(row.secretCiphertext);
      return {
        config: row.config as TConfig,
        secret,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[PlatformIntegration] Could not decrypt secret for provider '${provider}'. The ENCRYPTION_KEY may have changed or record is corrupted. Details: ${msg}`,
      );
      return null;
    }
  },
};
