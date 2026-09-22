import { createHash, createHmac, timingSafeEqual } from "crypto";
import { lookup } from "dns/promises";
import https from "https";
import { isIP } from "net";
import createError from "http-errors";
import type { Types } from "mongoose";
import {
  ConnectorExecutionModel,
  ConnectorSecretVersionModel,
  ExternalConnectorModel,
  type TConnectorProvider,
} from "../models/external-connector.model";
import { CommunicationCampaignModel } from "../models/communication-hub.model";
import { cryptoUtil } from "../utils/crypto.util";
import { configs } from "../configs";
import { redisUtil } from "../utils/redis.util";

type Values = Record<string, unknown>;
type Secrets = Record<string, string>;
type OAuthConnector = {
  _id: Types.ObjectId;
  config: Values;
  secretCiphertext: string;
  secretVersion: number;
  createdBy: Types.ObjectId;
};

export const CONNECTOR_CATALOG: Record<
  TConnectorProvider,
  { label: string; capabilities: string[] }
> = {
  twilio_sms: { label: "Twilio SMS", capabilities: ["sms.send"] },
  tally_bridge: { label: "Tally Bridge", capabilities: ["accounting.export"] },
  quickbooks: { label: "QuickBooks", capabilities: ["accounting.sync"] },
  google_workspace: {
    label: "Google Workspace",
    capabilities: ["documents.upload", "meetings.create"],
  },
  microsoft_graph: {
    label: "Microsoft Graph",
    capabilities: ["documents.upload", "meetings.create"],
  },
  google_meet: { label: "Google Meet", capabilities: ["meetings.create"] },
  bigbluebutton: { label: "BigBlueButton", capabilities: ["meetings.create"] },
  canvas_lms: {
    label: "Canvas LMS",
    capabilities: [
      "lms.course.sync",
      "lms.roster.sync",
      "lms.assignment.sync",
      "lms.grade.sync",
      "lms.catalog.read",
      "lms.progress.read",
      "lms.certificate.read",
    ],
  },
  moodle_lms: {
    label: "Moodle LMS",
    capabilities: [
      "lms.course.sync",
      "lms.roster.sync",
      "lms.assignment.sync",
      "lms.grade.sync",
      "lms.catalog.read",
      "lms.progress.read",
      "lms.certificate.read",
    ],
  },
  oneroster_1_2: {
    label: "OneRoster 1.2",
    capabilities: [
      "lms.course.sync",
      "lms.roster.sync",
      "lms.assignment.sync",
      "lms.grade.sync",
      "lms.catalog.read",
      "lms.progress.read",
      "lms.certificate.read",
    ],
  },
  coursera: {
    label: "Coursera for Campus",
    capabilities: [
      "lms.course.sync",
      "lms.catalog.read",
      "lms.roster.sync",
      "lms.assignment.sync",
      "lms.grade.sync",
      "lms.progress.read",
      "lms.certificate.read",
    ],
  },
  custom_webhook: { label: "Custom Webhook", capabilities: ["webhook.send"] },
};

const PRIVATE_HOST = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|::1$|fc|fd)/i;

export function isPrivateConnectorAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:"))
    return isPrivateConnectorAddress(normalized.slice("::ffff:".length));
  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  if (isIP(normalized) !== 4) return true;
  const [first, second] = normalized.split(".").map(Number);
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && [18, 19].includes(second))
  );
}

function hostAllowed(hostname: string): boolean {
  const allowed = configs.CONNECTOR_EGRESS_HOSTS.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return configs.NODE_ENV !== "production";
  return allowed.some((entry) =>
    entry.startsWith("*.")
      ? hostname.endsWith(entry.slice(1)) && hostname !== entry.slice(2)
      : hostname === entry,
  );
}

async function resolvePinnedPublicAddress(url: URL) {
  if (!hostAllowed(url.hostname))
    throw createError(403, "Connector host is not on the egress allowlist.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((row) => isPrivateConnectorAddress(row.address)))
    throw createError(400, "Connector DNS resolved to a prohibited network.");
  return addresses[0];
}

export function safeConnectorUrl(value: unknown): string {
  let url: URL;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw createError(400, "A valid connector URL is required.");
  }
  if (
    url.protocol !== "https:" ||
    PRIVATE_HOST.test(url.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
  ) {
    throw createError(400, "Connector URL must use HTTPS and cannot target a private network.");
  }
  return url.toString();
}

function required(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw createError(400, `${label} is required.`);
  return text;
}

function objectValue(value: unknown): Values | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Values)
    : undefined;
}

function rateLimit(value: unknown) {
  const parsed = Number(value ?? 60);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
    throw createError(400, "Rate limit must be a whole number between 1 and 1000.");
  return parsed;
}

function optionalOAuthConfig(config: Values) {
  if (!config.oauthTokenEndpoint) return {};
  const tokenExpiresAt = config.tokenExpiresAt
    ? new Date(String(config.tokenExpiresAt))
    : undefined;
  if (tokenExpiresAt && Number.isNaN(tokenExpiresAt.getTime()))
    throw createError(400, "OAuth token expiry must be a valid date.");
  return {
    oauthTokenEndpoint: safeConnectorUrl(config.oauthTokenEndpoint),
    ...(tokenExpiresAt ? { tokenExpiresAt: tokenExpiresAt.toISOString() } : {}),
  };
}

function normalized(provider: TConnectorProvider, config: Values) {
  if (!CONNECTOR_CATALOG[provider]) throw createError(400, "Unsupported connector provider.");
  if (provider === "twilio_sms") {
    const rateLimitPerMinute = rateLimit(config.rateLimitPerMinute);
    return {
      config: {
        accountSid: required(config.accountSid, "Account SID"),
        fromNumber: required(config.fromNumber, "Sender number"),
        rateLimitPerMinute,
      },
      requiredSecret: "authToken",
    };
  }
  const rateLimitPerMinute = rateLimit(config.rateLimitPerMinute);
  if (provider === "quickbooks") {
    return {
      config: {
        realmId: required(config.realmId, "QuickBooks company ID"),
        environment: config.environment === "production" ? "production" : "sandbox",
        rateLimitPerMinute,
        oauthTokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        tokenExpiresAt: config.tokenExpiresAt
          ? new Date(String(config.tokenExpiresAt)).toISOString()
          : new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      },
      requiredSecret: "refreshToken",
    };
  }
  if (provider === "google_workspace") {
    return {
      config: {
        customerId: required(config.customerId ?? "my_customer", "Google customer ID"),
        domain: String(config.domain ?? "")
          .trim()
          .toLowerCase(),
        rateLimitPerMinute,
        oauthTokenEndpoint: "https://oauth2.googleapis.com/token",
        tokenExpiresAt: config.tokenExpiresAt
          ? new Date(String(config.tokenExpiresAt)).toISOString()
          : new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      },
      requiredSecret: "refreshToken",
    };
  }
  if (provider === "microsoft_graph") {
    return {
      config: {
        tenantId: required(config.tenantId, "Microsoft tenant ID"),
        clientId: required(config.clientId, "Microsoft application client ID"),
        rateLimitPerMinute,
      },
      requiredSecret: "clientSecret",
    };
  }
  if (provider === "google_meet") {
    return {
      config: {
        rateLimitPerMinute,
        oauthTokenEndpoint: "https://oauth2.googleapis.com/token",
        tokenExpiresAt: config.tokenExpiresAt
          ? new Date(String(config.tokenExpiresAt)).toISOString()
          : new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      },
      requiredSecret: "refreshToken",
    };
  }
  if (provider === "bigbluebutton") {
    const endpoint = safeConnectorUrl(config.endpoint);
    return {
      config: {
        endpoint: endpoint.replace(/\/$/, ""),
        checksumAlgorithm: ["sha1", "sha256", "sha384", "sha512"].includes(
          String(config.checksumAlgorithm),
        )
          ? String(config.checksumAlgorithm)
          : "sha256",
        rateLimitPerMinute,
      },
      requiredSecret: "sharedSecret",
    };
  }
  if (["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"].includes(provider)) {
    return {
      config: {
        endpoint: safeConnectorUrl(config.endpoint).replace(/\/$/, ""),
        accountId: String(config.accountId ?? "").trim(),
        organizationId:
          provider === "coursera"
            ? required(config.organizationId, "Coursera organization ID")
            : String(config.organizationId ?? "").trim(),
        rateLimitPerMinute,
      },
      requiredSecret: "accessToken",
    };
  }
  const endpoint = safeConnectorUrl(config.endpoint);
  return {
    config: { ...config, endpoint, rateLimitPerMinute, ...optionalOAuthConfig(config) },
    requiredSecret:
      provider === "custom_webhook" || provider === "tally_bridge"
        ? "signingSecret"
        : "accessToken",
  };
}

function decrypt(value?: string): Secrets {
  return value ? (JSON.parse(cryptoUtil.decrypt(value)) as Secrets) : {};
}

function publicRecord(record: Values) {
  const { secretCiphertext: _secret, ...safe } = record;
  return { ...safe, hasSecret: Boolean(_secret) };
}

async function callHttp(endpoint: string, payload: Values, token?: string, signingSecret?: string) {
  const url = new URL(safeConnectorUrl(endpoint));
  const pinned = await resolvePinnedPublicAddress(url);
  const body = JSON.stringify(payload);
  const statusCode = await new Promise<number>((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(signingSecret
          ? {
              "x-devvelocity-signature": createHmac("sha256", signingSecret)
                .update(body)
                .digest("hex"),
            }
          : {}),
      },
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      timeout: 15_000,
    });
    request.on("timeout", () => request.destroy(new Error("Provider request timed out")));
    request.on("error", reject);
    request.on("response", (response) => {
      response.resume();
      resolve(response.statusCode ?? 502);
    });
    request.end(body);
  });
  if (statusCode < 200 || statusCode >= 300)
    throw new Error(`Provider returned HTTP ${statusCode}`);
  return { statusCode };
}

/** SSRF-hardened, DNS-pinned delivery primitive shared by governed tenant webhooks. */
export async function deliverSignedWebhook(
  endpoint: string,
  payload: Record<string, unknown>,
  signingSecret: string,
) {
  return callHttp(endpoint, payload, undefined, signingSecret);
}

async function refreshOAuthToken(connector: OAuthConnector, secrets: Secrets): Promise<Secrets> {
  const tokenEndpoint = String(connector.config.oauthTokenEndpoint ?? "");
  const expiresAt = Date.parse(String(connector.config.tokenExpiresAt ?? ""));
  if (
    !tokenEndpoint ||
    !secrets.refreshToken ||
    !Number.isFinite(expiresAt) ||
    expiresAt > Date.now() + 60_000
  )
    return secrets;
  if (!secrets.clientId || !secrets.clientSecret)
    throw createError(503, "OAuth connector is missing refresh credentials.");
  const url = new URL(safeConnectorUrl(tokenEndpoint));
  const pinned = await resolvePinnedPublicAddress(url);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: secrets.refreshToken,
    ...(connector.config.oauthTokenEndpoint ===
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
      ? {}
      : { client_id: secrets.clientId, client_secret: secrets.clientSecret }),
  }).toString();
  const responseBody = await new Promise<string>((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": Buffer.byteLength(body),
        ...(connector.config.oauthTokenEndpoint ===
        "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
          ? {
              authorization: `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString("base64")}`,
              accept: "application/json",
            }
          : {}),
      },
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      timeout: 15_000,
    });
    request.on("timeout", () => request.destroy(new Error("OAuth refresh timed out")));
    request.on("error", reject);
    request.on("response", (response) => {
      let responseText = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        responseText += chunk;
        if (responseText.length > 1_000_000)
          request.destroy(new Error("OAuth refresh response exceeded the size limit"));
      });
      response.on("end", () => {
        if ((response.statusCode ?? 502) < 200 || (response.statusCode ?? 502) >= 300)
          reject(new Error(`OAuth provider returned HTTP ${response.statusCode ?? 502}`));
        else resolve(responseText);
      });
    });
    request.end(body);
  });
  const token = JSON.parse(responseBody) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!token.access_token) throw new Error("OAuth provider did not return an access token");
  const refreshed = {
    ...secrets,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || secrets.refreshToken,
  };
  const nextVersion = Number(connector.secretVersion ?? 1) + 1;
  await ConnectorSecretVersionModel.create({
    connectorId: connector._id,
    version: connector.secretVersion ?? 1,
    secretCiphertext: connector.secretCiphertext,
    rotatedAt: new Date(),
    rotatedBy: connector.createdBy,
    reason: "Automatic OAuth access-token refresh",
  });
  await ExternalConnectorModel.updateOne(
    { _id: connector._id, secretVersion: connector.secretVersion ?? 1 },
    {
      $set: {
        secretCiphertext: cryptoUtil.encrypt(JSON.stringify(refreshed)),
        "config.tokenExpiresAt": new Date(
          Date.now() + Math.max(60, Number(token.expires_in ?? 3600)) * 1000,
        ).toISOString(),
        secretVersion: nextVersion,
      },
    },
  ).exec();
  return refreshed;
}

interface ITwilioMessageResponse {
  sid?: string;
  status?: string;
  message?: string;
}

async function sendTwilioSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string,
): Promise<{ providerMessageId: string; status: string }> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json().catch(() => ({}))) as ITwilioMessageResponse;
  if (!response.ok || !result.sid) {
    throw new Error(result.message || `Twilio returned HTTP ${response.status}`);
  }
  return { providerMessageId: result.sid, status: result.status || "queued" };
}

async function fixedProviderRequest(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  if (!text) return { statusCode: response.status };
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { statusCode: response.status, response: text.slice(0, 2000) };
  }
}

async function microsoftGraphToken(config: Values, secrets: Secrets) {
  const tenantId = required(config.tenantId, "Microsoft tenant ID");
  const response = await fixedProviderRequest(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required(config.clientId, "Microsoft client ID"),
        client_secret: required(secrets.clientSecret, "Microsoft client secret"),
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  return required(response.access_token, "Microsoft Graph access token");
}

function bigBlueButtonUrl(
  endpoint: string,
  callName: string,
  params: Record<string, string>,
  sharedSecret: string,
  algorithm: string,
) {
  const query = new URLSearchParams(params).toString();
  const checksum = createHash(algorithm).update(`${callName}${query}${sharedSecret}`).digest("hex");
  return `${endpoint}/${callName}?${query}&checksum=${checksum}`;
}

async function testNativeConnector(
  connector: OAuthConnector & { provider: TConnectorProvider },
  secrets: Secrets,
) {
  if (connector.provider === "twilio_sms") {
    const accountSid = required(connector.config.accountSid, "Twilio account SID");
    return fixedProviderRequest(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${required(secrets.authToken, "Twilio auth token")}`).toString("base64")}`,
        },
      },
    );
  }
  if (connector.provider === "quickbooks") {
    const refreshed = await refreshOAuthToken(connector, secrets);
    const realmId = required(connector.config.realmId, "QuickBooks company ID");
    const host =
      connector.config.environment === "production"
        ? "quickbooks.api.intuit.com"
        : "sandbox-quickbooks.api.intuit.com";
    return fixedProviderRequest(
      `https://${host}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`,
      { headers: { Authorization: `Bearer ${required(refreshed.accessToken, "Access token")}` } },
    );
  }
  if (connector.provider === "google_workspace") {
    const refreshed = await refreshOAuthToken(connector, secrets);
    const customer = encodeURIComponent(
      required(connector.config.customerId, "Google customer ID"),
    );
    return fixedProviderRequest(
      `https://admin.googleapis.com/admin/directory/v1/users?customer=${customer}&maxResults=1`,
      {
        headers: {
          Authorization: `Bearer ${required(refreshed.accessToken, "Access token")}`,
        },
      },
    );
  }
  if (connector.provider === "google_meet") {
    const refreshed = await refreshOAuthToken(connector, secrets);
    return fixedProviderRequest(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(required(refreshed.accessToken, "Access token"))}`,
      {},
    );
  }
  if (connector.provider === "microsoft_graph") {
    const token = await microsoftGraphToken(connector.config, secrets);
    return fixedProviderRequest(
      "https://graph.microsoft.com/v1.0/organization?$select=id,displayName",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }
  if (connector.provider === "bigbluebutton") {
    const endpoint = required(connector.config.endpoint, "BigBlueButton API endpoint");
    const url = bigBlueButtonUrl(
      endpoint,
      "getMeetings",
      {},
      required(secrets.sharedSecret, "BigBlueButton shared secret"),
      String(connector.config.checksumAlgorithm ?? "sha256"),
    );
    const response = await fixedProviderRequest(url, {});
    if (!String(response.response ?? "").includes("<returncode>SUCCESS</returncode>"))
      throw new Error("BigBlueButton did not return a successful API response");
    return { statusCode: 200 };
  }
  return callHttp(
    String(connector.config.endpoint),
    { type: "health_check", sentAt: new Date().toISOString() },
    secrets.accessToken,
    secrets.signingSecret,
  );
}

async function executeNativeConnector(
  connector: OAuthConnector & { provider: TConnectorProvider },
  operation: string,
  payload: Values,
  secrets: Secrets,
): Promise<Values> {
  if (
    ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"].includes(connector.provider) &&
    [
      "lms.course.sync",
      "lms.roster.sync",
      "lms.assignment.sync",
      "lms.grade.sync",
      "lms.catalog.read",
      "lms.progress.read",
      "lms.certificate.read",
    ].includes(operation)
  ) {
    return callHttp(
      String(connector.config.endpoint),
      {
        standard:
          connector.provider === "oneroster_1_2"
            ? "OneRoster 1.2"
            : connector.provider === "coursera"
              ? "Coursera Institutional Canonical v1"
              : "Devvelocity LMS Canonical v1",
        provider: connector.provider,
        operation,
        accountId: connector.config.accountId,
        organizationId: connector.config.organizationId,
        data: payload,
      },
      required(secrets.accessToken, "LMS access token"),
    );
  }
  if (connector.provider === "quickbooks" && operation === "accounting.sync") {
    const refreshed = await refreshOAuthToken(connector, secrets);
    const realmId = required(connector.config.realmId, "QuickBooks company ID");
    const entity = required(payload.entity, "QuickBooks entity");
    const allowedEntities = new Set(["Customer", "Vendor", "Invoice", "Payment", "JournalEntry"]);
    if (!allowedEntities.has(entity)) throw createError(400, "Unsupported QuickBooks entity.");
    const host =
      connector.config.environment === "production"
        ? "quickbooks.api.intuit.com"
        : "sandbox-quickbooks.api.intuit.com";
    return fixedProviderRequest(
      `https://${host}/v3/company/${encodeURIComponent(realmId)}/${entity.toLowerCase()}?minorversion=75`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${required(refreshed.accessToken, "QuickBooks access token")}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(objectValue(payload.data) ?? {}),
      },
    );
  }
  if (
    (connector.provider === "google_workspace" && operation === "meetings.create") ||
    (connector.provider === "google_meet" && operation === "meetings.create")
  ) {
    const refreshed = await refreshOAuthToken(connector, secrets);
    return fixedProviderRequest("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${required(refreshed.accessToken, "Google access token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(objectValue(payload.config) ?? {}),
    });
  }
  if (connector.provider === "google_workspace" && operation === "documents.upload") {
    const refreshed = await refreshOAuthToken(connector, secrets);
    const name = required(payload.name, "File name");
    const mimeType = required(payload.mimeType ?? "application/octet-stream", "MIME type");
    const content = Buffer.from(required(payload.contentBase64, "Base64 file content"), "base64");
    if (content.length > 10 * 1024 * 1024)
      throw createError(413, "Google Drive connector upload cannot exceed 10 MB.");
    const boundary = `devvelocity-${Date.now().toString(36)}`;
    const metadata = {
      name,
      ...(Array.isArray(payload.parents) ? { parents: payload.parents.map(String) } : {}),
    };
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      ),
      content,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    return fixedProviderRequest(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${required(refreshed.accessToken, "Google access token")}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
  }
  if (connector.provider === "microsoft_graph") {
    const token = await microsoftGraphToken(connector.config, secrets);
    if (operation === "meetings.create") {
      const organizer = encodeURIComponent(required(payload.organizerUserId, "Organizer user ID"));
      return fixedProviderRequest(
        `https://graph.microsoft.com/v1.0/users/${organizer}/onlineMeetings`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDateTime: required(payload.startDateTime, "Meeting start"),
            endDateTime: required(payload.endDateTime, "Meeting end"),
            subject: required(payload.subject, "Meeting subject"),
          }),
        },
      );
    }
    if (operation === "documents.upload") {
      const driveId = encodeURIComponent(required(payload.driveId, "Microsoft drive ID"));
      const path = required(payload.path, "Destination path")
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const content = Buffer.from(required(payload.contentBase64, "Base64 file content"), "base64");
      if (content.length > 4 * 1024 * 1024)
        throw createError(413, "Microsoft simple upload cannot exceed 4 MB.");
      return fixedProviderRequest(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${path}:/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": required(payload.mimeType ?? "application/octet-stream", "MIME type"),
          },
          body: content,
        },
      );
    }
  }
  if (connector.provider === "bigbluebutton" && operation === "meetings.create") {
    const meetingId = required(payload.meetingId, "Meeting ID");
    const endpoint = required(connector.config.endpoint, "BigBlueButton API endpoint");
    const params = {
      name: required(payload.name, "Meeting name"),
      meetingID: meetingId,
      attendeePW: required(payload.attendeePassword, "Attendee password"),
      moderatorPW: required(payload.moderatorPassword, "Moderator password"),
      ...(payload.duration ? { duration: String(payload.duration) } : {}),
      ...(payload.record !== undefined ? { record: String(Boolean(payload.record)) } : {}),
    };
    const url = bigBlueButtonUrl(
      endpoint,
      "create",
      params,
      required(secrets.sharedSecret, "BigBlueButton shared secret"),
      String(connector.config.checksumAlgorithm ?? "sha256"),
    );
    const result = await fixedProviderRequest(url, {});
    if (!String(result.response ?? "").includes("<returncode>SUCCESS</returncode>"))
      throw new Error("BigBlueButton meeting creation failed");
    return { meetingId, status: "created" };
  }
  if (connector.provider === "tally_bridge" && operation === "accounting.export") {
    return callHttp(
      String(connector.config.endpoint),
      { operation, data: payload, format: payload.format ?? "xml" },
      undefined,
      required(secrets.signingSecret, "Tally bridge signing secret"),
    );
  }
  if (connector.provider === "custom_webhook" && operation === "webhook.send") {
    return callHttp(
      String(connector.config.endpoint),
      { operation, data: payload },
      undefined,
      required(secrets.signingSecret, "Webhook signing secret"),
    );
  }
  throw createError(400, `${connector.provider} does not implement operation '${operation}'.`);
}

export const externalConnectorService = {
  metadata: () =>
    Object.entries(CONNECTOR_CATALOG).map(([provider, value]) => ({ provider, ...value })),

  async list() {
    const rows = await ExternalConnectorModel.find()
      .select("+secretCiphertext")
      .sort({ provider: 1, name: 1 })
      .lean()
      .exec();
    return rows.map((row) => publicRecord(row as unknown as Values));
  },

  async save(input: Values, userId: string, id?: string) {
    const provider = String(input.provider) as TConnectorProvider;
    const existing = id
      ? await ExternalConnectorModel.findById(id).select("+secretCiphertext").lean().exec()
      : null;
    const incoming = Object.fromEntries(
      Object.entries((input.secrets ?? {}) as Values)
        .filter(([, value]) => String(value ?? "").trim())
        .map(([key, value]) => [key, String(value)]),
    );
    const secrets = { ...decrypt(existing?.secretCiphertext), ...incoming };
    if (
      existing &&
      Object.keys(incoming).length &&
      String(input.rotationReason ?? "").trim().length < 10
    )
      throw createError(400, "A meaningful secret rotation reason is required.");
    const result = normalized(provider, (input.config ?? {}) as Values);
    if (!secrets[result.requiredSecret])
      throw createError(400, `${result.requiredSecret} is required.`);
    const update = {
      name: required(input.name, "Connector name"),
      provider,
      enabled: Boolean(input.enabled),
      config: result.config,
      secretCiphertext: cryptoUtil.encrypt(JSON.stringify(secrets)),
      capabilities: CONNECTOR_CATALOG[provider].capabilities,
      status: (input.enabled ? "configured" : "disabled") as "configured" | "disabled",
      failureCount: 0,
      lastError: undefined,
      createdBy: existing?.createdBy ?? userId,
      secretVersion: existing
        ? (existing.secretVersion ?? 1) + (Object.keys(incoming).length ? 1 : 0)
        : 1,
    };
    if (existing && Object.keys(incoming).length) {
      await ConnectorSecretVersionModel.create({
        connectorId: existing._id,
        version: existing.secretVersion ?? 1,
        secretCiphertext: existing.secretCiphertext,
        rotatedAt: new Date(),
        rotatedBy: userId,
        reason: String(input.rotationReason).trim(),
      });
    }
    const row = id
      ? await ExternalConnectorModel.findByIdAndUpdate(
          id,
          { $set: update },
          { returnDocument: "after", runValidators: true },
        )
          .select("+secretCiphertext")
          .lean()
          .exec()
      : await new ExternalConnectorModel(update)
          .save()
          .then((created) =>
            ExternalConnectorModel.findById(created._id).select("+secretCiphertext").lean().exec(),
          );
    if (!row) throw createError(404, "Connector not found.");
    return publicRecord(row as unknown as Values);
  },

  async executions() {
    return ConnectorExecutionModel.find().sort({ createdAt: -1 }).limit(100).lean().exec();
  },

  async enabledFor(capability: string) {
    return ExternalConnectorModel.findOne({ enabled: true, capabilities: capability })
      .select("_id name provider")
      .lean()
      .exec();
  },

  async execute(
    connectorId: string,
    operation: string,
    payload: Values,
    idempotencyKey: string,
    requestedBy?: string,
  ) {
    const connector = await ExternalConnectorModel.findById(connectorId)
      .select("+secretCiphertext")
      .lean()
      .exec();
    if (!connector?.enabled) throw createError(400, "Connector is not enabled.");
    if (!connector.capabilities.includes(operation))
      throw createError(400, "Connector does not support this operation.");
    if (connector.circuitOpenUntil && connector.circuitOpenUntil > new Date())
      throw createError(503, "Connector circuit is temporarily open.");
    const prior = await ConnectorExecutionModel.findOne({ idempotencyKey }).lean().exec();
    if (prior) return prior;
    const rate = await redisUtil.consumeFixedWindow(
      `connector-rate:${connector._id}`,
      Number(connector.config.rateLimitPerMinute ?? 60),
      60,
    );
    if (!rate.allowed)
      throw createError(429, `Provider rate limit reached; retry in ${rate.retryAfterSeconds}s`);
    const execution = await ConnectorExecutionModel.create({
      connectorId,
      provider: connector.provider,
      operation,
      idempotencyKey,
      payloadHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      status: "running",
      attempts: 1,
      requestedBy,
      startedAt: new Date(),
    });
    try {
      const secrets = await refreshOAuthToken(
        connector as unknown as OAuthConnector,
        decrypt(connector.secretCiphertext),
      );
      let result: Values;
      if (payload.type === "health_check") {
        result = await testNativeConnector(
          connector as unknown as OAuthConnector & { provider: TConnectorProvider },
          secrets,
        );
      } else if (connector.provider === "twilio_sms" && operation === "sms.send") {
        result = await sendTwilioSms(
          String(connector.config.accountSid),
          secrets.authToken,
          String(connector.config.fromNumber),
          required(payload.to, "Recipient"),
          required(payload.body, "Message"),
        );
      } else {
        result = await executeNativeConnector(
          connector as unknown as OAuthConnector & { provider: TConnectorProvider },
          operation,
          payload,
          secrets,
        );
      }
      await Promise.all([
        ConnectorExecutionModel.updateOne(
          { _id: execution._id },
          {
            $set: {
              status:
                connector.provider === "twilio_sms" && result.providerMessageId
                  ? "accepted"
                  : "succeeded",
              completedAt: new Date(),
              resultSummary: result,
              providerReference: result.providerMessageId,
            },
          },
        ).exec(),
        ExternalConnectorModel.updateOne(
          { _id: connector._id },
          {
            $set: { status: "healthy", failureCount: 0, lastSucceededAt: new Date() },
            $unset: { circuitOpenUntil: 1, lastError: 1 },
          },
        ).exec(),
      ]);
      return ConnectorExecutionModel.findById(execution._id).lean().exec();
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : "Provider request failed";
      const failures = connector.failureCount + 1;
      await Promise.all([
        ConnectorExecutionModel.updateOne(
          { _id: execution._id },
          { $set: { status: "failed", completedAt: new Date(), error: message } },
        ).exec(),
        ExternalConnectorModel.updateOne(
          { _id: connector._id },
          {
            $set: {
              status: "degraded",
              failureCount: failures,
              lastError: message,
              ...(failures >= 5 ? { circuitOpenUntil: new Date(Date.now() + 300_000) } : {}),
            },
          },
        ).exec(),
      ]);
      throw createError(502, message);
    }
  },

  async test(id: string, userId?: string) {
    const connector = await ExternalConnectorModel.findById(id).lean().exec();
    if (!connector) throw createError(404, "Connector not found.");
    const payload = { type: "health_check", sentAt: new Date().toISOString() };
    const result = await this.execute(
      id,
      connector.capabilities[0],
      payload,
      `test:${id}:${Date.now()}`,
      userId,
    );
    await ExternalConnectorModel.updateOne(
      { _id: id },
      { $set: { lastTestedAt: new Date() } },
    ).exec();
    return result;
  },

  async processTwilioReceipt(
    connectorId: string,
    signature: string,
    params: Record<string, string>,
  ) {
    const connector = await ExternalConnectorModel.findOne({
      _id: connectorId,
      provider: "twilio_sms",
      enabled: true,
    })
      .select("+secretCiphertext")
      .lean();
    if (!connector) throw createError(404, "SMS connector not found");
    if (!configs.CONNECTOR_WEBHOOK_BASE_URL)
      throw createError(503, "Connector webhook base URL is not configured");
    const url = `${configs.CONNECTOR_WEBHOOK_BASE_URL.replace(/\/$/, "")}/${configs.API_VERSION.replace(/^\/|\/$/g, "")}/external-connector/webhooks/twilio/${connectorId}`;
    const signed = `${url}${Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("")}`;
    const expected = createHmac("sha1", decrypt(connector.secretCiphertext).authToken)
      .update(signed)
      .digest("base64");
    const suppliedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    )
      throw createError(401, "Invalid provider webhook signature");
    const providerReference = String(params.MessageSid ?? "");
    const providerStatus = String(params.MessageStatus ?? "").toLowerCase();
    const terminal =
      providerStatus === "delivered"
        ? "delivered"
        : ["failed", "undelivered"].includes(providerStatus)
          ? "failed"
          : null;
    if (!providerReference || !terminal) return { accepted: true, terminal: false };
    const execution = await ConnectorExecutionModel.findOneAndUpdate(
      {
        connectorId,
        providerReference,
        status: { $nin: ["delivered", "failed"] },
      },
      {
        $set: {
          status: terminal,
          completedAt: new Date(),
          ...(terminal === "failed"
            ? {
                error: String(
                  params.ErrorMessage ?? params.ErrorCode ?? "Provider delivery failed",
                ),
              }
            : {}),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!execution) return { accepted: true, terminal: true, duplicate: true };
    const campaignId = execution.idempotencyKey.match(/^campaign:([^:]+):/)?.[1];
    if (campaignId) {
      await CommunicationCampaignModel.updateOne(
        { _id: campaignId, "channelStats.channel": "sms" },
        {
          $inc:
            terminal === "delivered"
              ? { "channelStats.$.delivered": 1 }
              : { "channelStats.$.failed": 1 },
        },
      );
      const campaign = await CommunicationCampaignModel.findById(campaignId).lean();
      const sms = campaign?.channelStats.find((item) => item.channel === "sms");
      if (campaign && sms && sms.delivered + sms.failed >= campaign.recipientCount) {
        await CommunicationCampaignModel.updateOne(
          { _id: campaignId, "channelStats.channel": "sms" },
          {
            $set: {
              "channelStats.$.status": sms.failed === campaign.recipientCount ? "failed" : "sent",
            },
          },
        );
      }
    }
    return { accepted: true, terminal: true, status: terminal };
  },
};
