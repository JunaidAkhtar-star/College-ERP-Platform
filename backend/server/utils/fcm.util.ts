/**
 * FCM Push Notification Utility
 * Uses firebase-admin to send push to web/android/ios tokens.
 * Firebase is lazily initialised from the single healthy platform Integration
 * Center configuration. Tenant context controls recipients and branding.
 */
import type { IFcmDeviceToken, IFcmToken } from "../models/user.model";
import { platformIntegrationService } from "../services/platform-integration.service";

let _app: import("firebase-admin/app").App | null = null;

async function getApp(): Promise<import("firebase-admin/app").App | null> {
  if (_app) return _app;

  const dynamic = await platformIntegrationService.credentials<{
    projectId: string;
    clientEmail: string;
  }>("firebase");
  if (!dynamic) return null;
  const projectId = dynamic.config.projectId;
  const clientEmail = dynamic.config.clientEmail;
  const privateKey = String(dynamic.secret || "").replace(/\\n/g, "\n");

  try {
    const admin = require("firebase-admin") as typeof import("firebase-admin");
    if (!admin.apps.length) {
      _app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      _app = admin.apps[0] as import("firebase-admin/app").App;
    }
  } catch (err) {
    console.error("[FCM] Failed to initialise Firebase Admin:", err);
    return null;
  }
  return _app;
}

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface FcmDeliveryResult {
  successCount: number;
  invalidTokens: string[];
}

/**
 * Send push to all tokens of a user (web, ios, android).
 * Silently skips if Firebase is not configured or tokens are missing.
 */
export async function sendFcmToUser(
  fcmToken: IFcmToken | undefined,
  payload: FcmPayload,
  deviceTokens: IFcmDeviceToken[] = [],
): Promise<FcmDeliveryResult> {
  if (!fcmToken && !deviceTokens.length) return { successCount: 0, invalidTokens: [] };
  const app = await getApp();
  if (!app) return { successCount: 0, invalidTokens: [] };

  const tokenEntries = (
    deviceTokens.length
      ? deviceTokens.map(({ platform, token }) => ({ platform, token: token.trim() }))
      : (["web", "ios", "android"] as const).map((platform) => ({
          platform,
          token: fcmToken?.[platform]?.trim(),
        }))
  )
    .filter((entry): entry is { platform: "web" | "ios" | "android"; token: string } =>
      Boolean(entry.token),
    )
    .filter(
      (entry, index, entries) => entries.findIndex((item) => item.token === entry.token) === index,
    );
  if (!tokenEntries.length) return { successCount: 0, invalidTokens: [] };

  const admin = require("firebase-admin") as typeof import("firebase-admin");
  const messaging = admin.messaging(app);

  const notification = {
    title: payload.title,
    body: payload.body,
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
  };
  const data = {
    title: payload.title,
    body: payload.body,
    ...(payload.data ?? {}),
  };

  // Web receives a data-only payload so our service worker owns display and
  // click routing. Native clients receive a standard notification payload.
  const res = await messaging.sendEach(
    tokenEntries.map(({ platform, token }) =>
      platform === "web" ? { token, data } : { token, notification, data },
    ),
  );
  let successCount = 0;
  const invalidTokens: string[] = [];
  res.responses.forEach((resp, idx) => {
    if (!resp.success) {
      if (
        [
          "messaging/registration-token-not-registered",
          "messaging/invalid-registration-token",
        ].includes(resp.error?.code ?? "") &&
        tokenEntries[idx]?.token
      ) {
        invalidTokens.push(tokenEntries[idx]!.token);
      }
      console.error(
        `[FCM] Push token ${tokenEntries[idx]?.token.slice(0, 15)}... failed:`,
        resp.error,
      );
    } else {
      successCount++;
      console.info(
        `[FCM] Push token ${tokenEntries[idx]?.token.slice(0, 15)}... delivered! Message ID: ${resp.messageId}`,
      );
    }
  });
  if (successCount === 0) {
    if (invalidTokens.length === tokenEntries.length) return { successCount, invalidTokens };
    const firstError = res.responses[0]?.error?.message ?? "FCM rejected push tokens.";
    throw new Error(`FCM push delivery failed: ${firstError}`);
  }
  return { successCount, invalidTokens };
}

/**
 * Send push to multiple users at once (token batches, max 500 per call).
 */
export async function sendFcmMulticast(tokens: string[], payload: FcmPayload): Promise<void> {
  const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
  if (!uniqueTokens.length) return;
  const app = await getApp();
  if (!app) return;

  const admin = require("firebase-admin") as typeof import("firebase-admin");
  const messaging = admin.messaging(app);
  const notification = {
    title: payload.title,
    body: payload.body,
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
  };

  // Batch into chunks of 500 (FCM limit)
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    await messaging.sendEachForMulticast({ tokens: chunk, notification }).catch((err: unknown) => {
      console.error("[FCM] batch push error:", err);
    });
  }
}
