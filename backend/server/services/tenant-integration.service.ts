import nodemailer from "nodemailer";
import createError from "http-errors";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { isValidObjectId } from "mongoose";
import { cryptoUtil } from "../utils/crypto.util";
import {
  TenantIntegrationModel,
  type TenantIntegrationProvider,
} from "../models/tenant-integration.model";
import { TenantPaymentWebhookEventModel } from "../models/tenant-payment-webhook-event.model";
import { TenantPaymentAttemptModel } from "../models/tenant-payment-attempt.model";
import { platformIntegrationService } from "./platform-integration.service";
import { FeePaymentMode } from "../models/fee.model";
import { studentProfileRepository } from "../repositories/student-profile.repository";
import { SystemRole } from "../constants/roles";
import PaytmChecksum from "paytmchecksum";
import { InstitutionSettingModel } from "../models/institution-setting.model";

type IntegrationConfig = Record<string, unknown>;
type IntegrationSecrets = Record<string, string>;
type CheckoutPaymentProvider = "razorpay" | "stripe" | "paytm" | "phonepe" | "cashfree";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_PROVIDERS = new Set<TenantIntegrationProvider>([
  "razorpay",
  "stripe",
  "paytm",
  "phonepe",
  "cashfree",
]);
const PROVIDER_TIMEOUT_MS = 12_000;

function isCheckoutPaymentProvider(
  provider: TenantIntegrationProvider,
): provider is CheckoutPaymentProvider {
  return (
    provider === "razorpay" ||
    provider === "stripe" ||
    provider === "paytm" ||
    provider === "phonepe" ||
    provider === "cashfree"
  );
}

const ALL_PROVIDERS: TenantIntegrationProvider[] = [
  "smtp",
  "sms",
  "razorpay",
  "stripe",
  "paytm",
  "phonepe",
  "cashfree",
  "webhooks",
];

function requiredString(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw createError(400, `${label} is required.`);
  return result;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validateConfig(provider: TenantIntegrationProvider, input: IntegrationConfig) {
  if (provider === "smtp") {
    const port = Number(input.port);
    const fromEmail = requiredString(input.fromEmail, "Sender email").toLowerCase();
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw createError(400, "SMTP port must be between 1 and 65535.");
    }
    if (!EMAIL_RE.test(fromEmail)) throw createError(400, "Sender email is invalid.");
    const replyTo = String(input.replyTo ?? "")
      .trim()
      .toLowerCase();
    if (replyTo && !EMAIL_RE.test(replyTo)) throw createError(400, "Reply-to email is invalid.");
    return {
      host: requiredString(input.host, "SMTP host"),
      port,
      secure: Boolean(input.secure),
      username: requiredString(input.username, "SMTP username"),
      fromName: requiredString(input.fromName, "Sender name"),
      fromEmail,
      replyTo,
    };
  }

  if (provider === "firebase") {
    return {
      projectId: requiredString(input.projectId, "Firebase project ID"),
      clientEmail: requiredString(input.clientEmail, "Firebase client email").toLowerCase(),
      apiKey: String(input.apiKey ?? "").trim(),
      authDomain: String(input.authDomain ?? "").trim(),
      storageBucket: String(input.storageBucket ?? "").trim(),
      messagingSenderId: String(input.messagingSenderId ?? "").trim(),
      appId: String(input.appId ?? "").trim(),
      measurementId: String(input.measurementId ?? "").trim(),
      vapidKey: requiredString(input.vapidKey, "Firebase VAPID key"),
    };
  }

  if (provider === "razorpay") {
    const keyId = requiredString(input.keyId ?? input.apiKey, "Razorpay key ID");
    if (!/^rzp_(?:test|live)_/.test(keyId))
      throw createError(400, "Razorpay key ID must start with rzp_test_ or rzp_live_.");
    return { keyId };
  }
  if (provider === "stripe") {
    return { accountLabel: String(input.accountLabel ?? "").trim() };
  }
  if (provider === "paytm") {
    return {
      merchantId: requiredString(input.merchantId ?? input.apiKey, "Paytm merchant ID"),
      websiteName: requiredString(input.websiteName ?? "DEFAULT", "Paytm website name"),
      environment: input.environment === "production" ? "production" : "staging",
    };
  }
  if (provider === "phonepe") {
    return {
      clientId: requiredString(input.clientId ?? input.apiKey, "PhonePe client ID"),
      clientVersion: requiredString(
        input.clientVersion ?? input.saltIndex ?? "1",
        "PhonePe client version",
      ),
      webhookUsername: requiredString(input.webhookUsername, "PhonePe webhook username"),
      environment: input.environment === "production" ? "production" : "sandbox",
    };
  }
  if (provider === "cashfree") {
    return {
      appId: requiredString(input.appId ?? input.apiKey, "Cashfree app ID"),
      environment: input.environment === "production" ? "production" : "sandbox",
    };
  }

  // Generic non-payment connectors.
  return {
    apiKey: String(input.apiKey ?? "").trim(),
    endpoint: String(input.endpoint ?? "").trim(),
  };
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function providerRequest(
  url: string,
  init: RequestInit,
  provider: TenantIntegrationProvider,
) {
  let response: globalThis.Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch {
    throw createError(502, `${provider} could not be reached.`);
  }
  if (!response.ok) {
    throw createError(400, `${provider} rejected the saved credentials (HTTP ${response.status}).`);
  }
  return response;
}

async function verifyPaymentCredentials(
  provider: TenantIntegrationProvider,
  config: IntegrationConfig,
  secrets: IntegrationSecrets,
) {
  if (provider === "razorpay") {
    const keyId = requiredString(config.keyId, "Razorpay key ID");
    const secretKey = requiredString(secrets.secretKey, "Razorpay key secret");
    await providerRequest(
      "https://api.razorpay.com/v1/orders?count=1",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${secretKey}`).toString("base64")}`,
        },
      },
      provider,
    );
    return;
  }
  if (provider === "stripe") {
    const secretKey = requiredString(secrets.secretKey, "Stripe secret key");
    if (!/^sk_(?:test|live)_/.test(secretKey))
      throw createError(400, "Stripe secret key must start with sk_test_ or sk_live_.");
    await providerRequest(
      "https://api.stripe.com/v1/balance",
      { headers: { Authorization: `Bearer ${secretKey}` } },
      provider,
    );
    return;
  }
  if (provider === "cashfree") {
    const appId = requiredString(config.appId, "Cashfree app ID");
    const secretKey = requiredString(secrets.secretKey, "Cashfree secret key");
    const baseUrl =
      config.environment === "production"
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com";
    await providerRequest(
      `${baseUrl}/pg/orders?limit=1`,
      {
        headers: {
          "x-client-id": appId,
          "x-client-secret": secretKey,
          "x-api-version": "2023-08-01",
        },
      },
      provider,
    );
    return;
  }
  if (provider === "paytm") {
    const merchantId = requiredString(config.merchantId, "Paytm merchant ID");
    const merchantKey = requiredString(secrets.secretKey, "Paytm merchant key");
    const body = { mid: merchantId, orderId: `ERP_READINESS_${Date.now()}` };
    const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), merchantKey);
    const baseUrl =
      config.environment === "production"
        ? "https://securegw.paytm.in"
        : "https://securegw-stage.paytm.in";
    const response = await providerRequest(
      `${baseUrl}/v3/order/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, head: { signature } }),
      },
      provider,
    );
    const result = (await response.json()) as {
      body?: { resultInfo?: { resultCode?: string; resultStatus?: string } };
    };
    if (["334", "335", "501"].includes(String(result.body?.resultInfo?.resultCode ?? "")))
      throw createError(400, "Paytm rejected the merchant credentials.");
    return;
  }
  if (provider === "phonepe") {
    await phonePeAccessToken(config, secrets);
    return;
  }
  throw createError(400, `Provider '${provider}' is not a payment gateway.`);
}

function phonePeUrls(environment: unknown) {
  return environment === "production"
    ? {
        token: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
        pay: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
      }
    : {
        token: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
        pay: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
      };
}

async function phonePeAccessToken(config: IntegrationConfig, secrets: IntegrationSecrets) {
  const form = new URLSearchParams({
    client_id: requiredString(config.clientId, "PhonePe client ID"),
    client_version: requiredString(config.clientVersion, "PhonePe client version"),
    client_secret: requiredString(secrets.secretKey, "PhonePe client secret"),
    grant_type: "client_credentials",
  });
  const response = await providerRequest(
    phonePeUrls(config.environment).token,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
    "phonepe",
  );
  const result = (await response.json()) as { access_token?: string };
  return requiredString(result.access_token, "PhonePe access token");
}

function decryptSecrets(ciphertext?: string): IntegrationSecrets {
  if (!ciphertext) return {};
  return JSON.parse(cryptoUtil.decrypt(ciphertext)) as IntegrationSecrets;
}

function publicRecord(record: {
  provider: TenantIntegrationProvider;
  enabled: boolean;
  config: IntegrationConfig;
  secretCiphertext?: string;
  status: string;
  lastTestedAt?: Date;
  lastTestSucceeded?: boolean;
  lastError?: string;
  updatedAt?: Date;
}) {
  return {
    provider: record.provider,
    enabled: record.enabled,
    config: record.config,
    hasSecret: Boolean(record.secretCiphertext),
    status: record.status,
    lastTestedAt: record.lastTestedAt,
    lastTestSucceeded: record.lastTestSucceeded,
    lastError: record.lastError,
    updatedAt: record.updatedAt,
  };
}

export const tenantIntegrationService = {
  async list() {
    const records = await TenantIntegrationModel.find().select("+secretCiphertext").lean().exec();
    return ALL_PROVIDERS.map((provider) => {
      const record = records.find((item) => item.provider === provider);
      return record
        ? publicRecord(record)
        : { provider, enabled: false, config: {}, hasSecret: false, status: "not_configured" };
    });
  },

  async save(
    provider: TenantIntegrationProvider,
    input: { enabled?: boolean; config?: IntegrationConfig; secrets?: IntegrationSecrets },
    userId?: string,
  ) {
    const config = validateConfig(provider, input.config ?? {});
    const existing = await TenantIntegrationModel.findOne({ provider })
      .select("+secretCiphertext")
      .exec();
    const existingSecrets = decryptSecrets(existing?.secretCiphertext);
    const incomingSecrets = Object.fromEntries(
      Object.entries(input.secrets ?? {}).filter(([, value]) => String(value ?? "").trim()),
    ) as IntegrationSecrets;
    const secrets = { ...existingSecrets, ...incomingSecrets };

    const record = await TenantIntegrationModel.findOneAndUpdate(
      { provider },
      {
        $set: {
          enabled: Boolean(input.enabled),
          config,
          secretCiphertext: cryptoUtil.encrypt(JSON.stringify(secrets)),
          status: input.enabled ? "configured" : "not_configured",
          lastError: undefined,
          updatedBy: userId,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .select("+secretCiphertext")
      .lean()
      .exec();
    if (!record) throw createError(500, "Integration could not be saved.");
    return publicRecord(record);
  },

  async getEnabled(provider: TenantIntegrationProvider) {
    const record = await TenantIntegrationModel.findOne({ provider, enabled: true })
      .select("+secretCiphertext")
      .lean()
      .exec();
    if (!record?.secretCiphertext && !Object.keys(record?.config ?? {}).length) return null;
    return {
      config: record?.config ?? {},
      secrets: decryptSecrets(record?.secretCiphertext),
      record,
    };
  },

  async getReady(provider: TenantIntegrationProvider) {
    const resolved = await this.getEnabled(provider);
    if (
      !resolved ||
      !resolved.record ||
      resolved.record.status !== "healthy" ||
      resolved.record.lastTestSucceeded !== true
    )
      return null;
    return resolved;
  },

  async readiness(provider: TenantIntegrationProvider) {
    if (provider === "firebase") {
      const platformFirebase =
        await platformIntegrationService.credentials<Record<string, unknown>>("firebase");
      return {
        provider,
        configured: Boolean(platformFirebase),
        enabled: Boolean(platformFirebase),
        tested: Boolean(platformFirebase),
        ready: Boolean(platformFirebase),
        status: platformFirebase ? "healthy" : "not_configured",
        reason: platformFirebase
          ? undefined
          : "Platform Firebase must be enabled and connection-tested.",
      };
    }
    const record = await TenantIntegrationModel.findOne({ provider }).lean().exec();
    const ready = Boolean(
      record?.enabled && record.status === "healthy" && record.lastTestSucceeded === true,
    );
    return {
      provider,
      configured: Boolean(record),
      enabled: Boolean(record?.enabled),
      tested: Boolean(record?.lastTestedAt),
      ready,
      status: record?.status ?? "not_configured",
      lastTestedAt: record?.lastTestedAt,
      reason: ready ? undefined : "Integration must be enabled and connection-tested.",
    };
  },

  async getFirebaseClientConfig() {
    const [platformFallback, institution] = await Promise.all([
      platformIntegrationService.credentials<Record<string, unknown>>("firebase"),
      InstitutionSettingModel.findOne().select("name logoUrl faviconUrl").lean().exec(),
    ]);
    if (!platformFallback) throw createError(409, "Firebase is not enabled and connection-tested.");
    const {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId,
      vapidKey,
    } = platformFallback?.config ?? {};
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId,
      vapidKey,
      institutionName: institution?.name ?? "Your institution",
      institutionLogoUrl: institution?.logoUrl ?? institution?.faviconUrl,
    };
  },

  async test(provider: TenantIntegrationProvider) {
    const record = await TenantIntegrationModel.findOne({ provider })
      .select("+secretCiphertext")
      .lean()
      .exec();
    if (!record) throw createError(400, `Save ${provider} settings before testing connection.`);

    let succeeded = false;
    let errorMessage: string | undefined;
    try {
      if (provider === "smtp") {
        const secrets = decryptSecrets(record.secretCiphertext);
        const cfg = record.config as Record<string, string | number | boolean>;
        const transporter = nodemailer.createTransport({
          host: String(cfg.host),
          port: Number(cfg.port),
          secure: Boolean(cfg.secure),
          auth: { user: String(cfg.username), pass: secrets.password ?? "" },
        });
        await transporter.verify();
        transporter.close();
      } else if (PAYMENT_PROVIDERS.has(provider)) {
        await verifyPaymentCredentials(
          provider,
          record.config as IntegrationConfig,
          decryptSecrets(record.secretCiphertext),
        );
      } else {
        throw createError(
          409,
          `${provider} does not support readiness testing through this integration endpoint.`,
        );
      }
      succeeded = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Connection failed";
    }

    await TenantIntegrationModel.updateOne(
      { provider },
      {
        $set: {
          status: succeeded ? "healthy" : "error",
          lastTestedAt: new Date(),
          lastTestSucceeded: succeeded,
          lastError: errorMessage,
        },
      },
    ).exec();
    if (!succeeded) throw createError(400, errorMessage || "Connection failed");
    return { provider, status: "healthy", testedAt: new Date() };
  },

  async createPaymentCheckout(input: {
    provider: TenantIntegrationProvider;
    feeRecordId: string;
    amount: number;
    currency?: string;
    idempotencyKey: string;
    userId: string;
    activeRole?: string;
    email?: string;
    phone?: string;
    returnUrl?: string;
    requestOrigin?: string;
    webhookUrl?: string;
  }) {
    if (!isCheckoutPaymentProvider(input.provider))
      throw createError(
        409,
        `${input.provider} checkout is unavailable until its current merchant API is configured.`,
      );
    const checkoutProvider = input.provider;
    if (!/^[A-Za-z0-9._:-]{12,200}$/.test(input.idempotencyKey))
      throw createError(400, "A valid idempotency key is required.");

    const existing = await TenantPaymentAttemptModel.findOne({
      provider: checkoutProvider,
      idempotencyKey: input.idempotencyKey,
    }).lean();
    if (existing) {
      if (String(existing.requestedBy) !== input.userId)
        throw createError(409, "Idempotency key is already in use.");
      return {
        attemptId: String(existing._id),
        provider: existing.provider,
        providerOrderId: existing.providerOrderId,
        checkoutUrl: existing.checkoutUrl,
        checkoutToken: existing.checkoutToken,
        amount: existing.amount,
        currency: existing.currency,
        status: existing.status,
      };
    }

    const { feeRepository } = await import("../repositories/fee.repository");
    const feeRecord = await feeRepository.findRecordById(input.feeRecordId);
    if (!feeRecord) throw createError(404, "Fee record not found.");
    if (
      input.activeRole === SystemRole.STUDENT &&
      String(feeRecord.studentId) !== String(input.userId)
    )
      throw createError(403, "Students can only pay their own fee records.");
    if (!Number.isFinite(input.amount) || input.amount < 1 || input.amount > feeRecord.balanceDue)
      throw createError(400, "Payment amount must be within the outstanding fee balance.");

    const currency = String(input.currency ?? "INR")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw createError(400, "Currency must be a 3-letter code.");
    const ready = await this.getReady(checkoutProvider);
    if (!ready) throw createError(409, `${checkoutProvider} is not enabled and connection-tested.`);
    const returnUrl = String(input.returnUrl ?? "").trim();
    let verifiedReturnUrl: string | undefined;
    if (["stripe", "paytm", "phonepe"].includes(checkoutProvider) || returnUrl) {
      let parsed: URL;
      let requestOrigin: URL;
      try {
        parsed = new URL(returnUrl);
        requestOrigin = new URL(input.requestOrigin ?? "");
      } catch {
        throw createError(400, "A valid Stripe return URL is required.");
      }
      if (!["https:", "http:"].includes(parsed.protocol))
        throw createError(400, "Stripe return URL must use HTTP or HTTPS.");
      if (requestOrigin.origin !== parsed.origin)
        throw createError(400, "Payment return URL must match the requesting application origin.");
      verifiedReturnUrl = parsed.toString();
    }

    const attempt = await TenantPaymentAttemptModel.create({
      provider: checkoutProvider,
      feeRecordId: feeRecord._id,
      requestedBy: input.userId,
      amount: input.amount,
      currency,
      idempotencyKey: input.idempotencyKey,
      status: "creating",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    try {
      let providerOrderId = "";
      let checkoutUrl: string | undefined;
      let checkoutToken: string | undefined;
      if (checkoutProvider === "razorpay") {
        const keyId = requiredString(ready.config.keyId, "Razorpay key ID");
        const secretKey = requiredString(ready.secrets.secretKey, "Razorpay key secret");
        const response = await providerRequest(
          "https://api.razorpay.com/v1/orders",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${keyId}:${secretKey}`).toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: Math.round(input.amount * 100),
              currency,
              receipt: `fee-${String(attempt._id)}`,
              notes: { paymentAttemptId: String(attempt._id) },
            }),
          },
          checkoutProvider,
        );
        const result = (await response.json()) as { id?: string };
        providerOrderId = requiredString(result.id, "Razorpay order ID");
      } else if (checkoutProvider === "stripe") {
        const secretKey = requiredString(ready.secrets.secretKey, "Stripe secret key");
        const form = new URLSearchParams({
          mode: "payment",
          success_url: `${verifiedReturnUrl}${verifiedReturnUrl?.includes("?") ? "&" : "?"}payment=success`,
          cancel_url: `${verifiedReturnUrl}${verifiedReturnUrl?.includes("?") ? "&" : "?"}payment=cancelled`,
          client_reference_id: String(attempt._id),
          "metadata[paymentAttemptId]": String(attempt._id),
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": currency.toLowerCase(),
          "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
          "line_items[0][price_data][product_data][name]": `Fee ${feeRecord.invoiceNumber}`,
        });
        const response = await providerRequest(
          "https://api.stripe.com/v1/checkout/sessions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Idempotency-Key": input.idempotencyKey,
            },
            body: form.toString(),
          },
          checkoutProvider,
        );
        const result = (await response.json()) as { id?: string; url?: string };
        providerOrderId = requiredString(result.id, "Stripe checkout session ID");
        checkoutUrl = requiredString(result.url, "Stripe checkout URL");
      } else if (checkoutProvider === "paytm") {
        const merchantId = requiredString(ready.config.merchantId, "Paytm merchant ID");
        const merchantKey = requiredString(ready.secrets.secretKey, "Paytm merchant key");
        const baseUrl =
          ready.config.environment === "production"
            ? "https://securegw.paytm.in"
            : "https://securegw-stage.paytm.in";
        providerOrderId = String(attempt._id);
        const body = {
          requestType: "Payment",
          mid: merchantId,
          websiteName: String(ready.config.websiteName ?? "DEFAULT"),
          orderId: providerOrderId,
          callbackUrl: requiredString(input.webhookUrl, "Paytm callback URL"),
          txnAmount: { value: input.amount.toFixed(2), currency },
          userInfo: { custId: input.userId },
        };
        const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), merchantKey);
        const response = await providerRequest(
          `${baseUrl}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(merchantId)}&orderId=${encodeURIComponent(providerOrderId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body, head: { signature } }),
          },
          checkoutProvider,
        );
        const result = (await response.json()) as {
          body?: {
            txnToken?: string;
            resultInfo?: { resultStatus?: string; resultMsg?: string };
          };
        };
        if (result.body?.resultInfo?.resultStatus !== "S")
          throw createError(
            400,
            result.body?.resultInfo?.resultMsg || "Paytm checkout could not be created.",
          );
        checkoutToken = requiredString(result.body.txnToken, "Paytm transaction token");
        checkoutUrl = `${baseUrl}/theia/api/v1/showPaymentPage?mid=${encodeURIComponent(merchantId)}&orderId=${encodeURIComponent(providerOrderId)}`;
      } else if (checkoutProvider === "phonepe") {
        const accessToken = await phonePeAccessToken(ready.config, ready.secrets);
        providerOrderId = String(attempt._id);
        const response = await providerRequest(
          phonePeUrls(ready.config.environment).pay,
          {
            method: "POST",
            headers: {
              Authorization: `O-Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              merchantOrderId: providerOrderId,
              amount: Math.round(input.amount * 100),
              expireAfter: 1200,
              metaInfo: { udf1: String(attempt._id), udf2: input.feeRecordId },
              paymentFlow: {
                type: "PG_CHECKOUT",
                message: `Fee ${feeRecord.invoiceNumber}`,
                merchantUrls: { redirectUrl: verifiedReturnUrl },
              },
            }),
          },
          checkoutProvider,
        );
        const result = (await response.json()) as {
          orderId?: string;
          redirectUrl?: string;
        };
        providerOrderId = result.orderId || providerOrderId;
        checkoutUrl = requiredString(result.redirectUrl, "PhonePe checkout URL");
      } else {
        const appId = requiredString(ready.config.appId, "Cashfree app ID");
        const secretKey = requiredString(ready.secrets.secretKey, "Cashfree secret key");
        const customerPhone = String(input.phone ?? "")
          .replace(/\D/g, "")
          .slice(-10);
        if (!/^[6-9]\d{9}$/.test(customerPhone))
          throw createError(400, "A valid student phone number is required for Cashfree checkout.");
        const baseUrl =
          ready.config.environment === "production"
            ? "https://api.cashfree.com"
            : "https://sandbox.cashfree.com";
        const response = await providerRequest(
          `${baseUrl}/pg/orders`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-client-id": appId,
              "x-client-secret": secretKey,
              "x-api-version": "2023-08-01",
              "x-idempotency-key": input.idempotencyKey,
            },
            body: JSON.stringify({
              order_id: String(attempt._id),
              order_amount: input.amount,
              order_currency: currency,
              customer_details: {
                customer_id: input.userId,
                customer_email: input.email || "payments@institution.invalid",
                customer_phone: customerPhone,
              },
              order_meta: verifiedReturnUrl ? { return_url: verifiedReturnUrl } : undefined,
            }),
          },
          checkoutProvider,
        );
        const result = (await response.json()) as {
          order_id?: string;
          payment_session_id?: string;
        };
        providerOrderId = requiredString(result.order_id, "Cashfree order ID");
        checkoutUrl = result.payment_session_id;
      }

      await TenantPaymentAttemptModel.updateOne(
        { _id: attempt._id, status: "creating" },
        { $set: { status: "pending", providerOrderId, checkoutUrl, checkoutToken } },
      ).exec();
      return {
        attemptId: String(attempt._id),
        provider: checkoutProvider,
        providerOrderId,
        checkoutUrl,
        checkoutToken,
        amount: input.amount,
        currency,
        status: "pending",
      };
    } catch (error) {
      await TenantPaymentAttemptModel.updateOne(
        { _id: attempt._id },
        {
          $set: {
            status: "failed",
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Checkout failed",
          },
        },
      ).exec();
      throw error;
    }
  },

  async processPaymentWebhook(
    provider: TenantIntegrationProvider,
    payload: Record<string, unknown>,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (!PAYMENT_PROVIDERS.has(provider)) {
      throw createError(404, `Provider '${provider}' does not accept payment webhooks.`);
    }
    if (!isCheckoutPaymentProvider(provider)) {
      throw createError(
        501,
        `${provider} callbacks are disabled until its current checkout and signature protocol is implemented.`,
      );
    }
    const resolved = await this.getEnabled(provider);
    if (!resolved) throw createError(409, `${provider} is not enabled for this tenant.`);
    const header = (name: string) => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const raw = rawBody.toString("utf8");
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const secrets = resolved.secrets;
    const paymentPayload = payload;

    if (provider === "stripe") {
      const signatureHeader = header("stripe-signature") ?? "";
      const webhookSecret = requiredString(secrets.webhookSecret, "Stripe webhook signing secret");
      const timestamp = signatureHeader.match(/(?:^|,)t=([^,]+)/)?.[1] ?? "";
      const signatures = Array.from(signatureHeader.matchAll(/(?:^|,)v1=([^,]+)/g)).map(
        (match) => match[1] ?? "",
      );
      const timestampMs = Number(timestamp) * 1000;
      if (
        !timestamp ||
        !Number.isFinite(timestampMs) ||
        Math.abs(Date.now() - timestampMs) > 300_000
      )
        throw createError(401, "Stripe webhook timestamp is invalid or expired.");
      const expected = createHmac("sha256", webhookSecret)
        .update(`${timestamp}.${raw}`)
        .digest("hex");
      if (!signatures.some((signature) => safeEqual(signature, expected)))
        throw createError(401, "Stripe webhook signature is invalid.");
    } else if (provider === "razorpay") {
      const actual = header("x-razorpay-signature") ?? "";
      const webhookSecret = requiredString(
        secrets.webhookSecret,
        "Razorpay webhook signing secret",
      );
      const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      if (!safeEqual(actual, expected))
        throw createError(401, "Razorpay webhook signature is invalid.");
    } else if (provider === "cashfree") {
      const timestamp = header("x-webhook-timestamp") ?? "";
      const actual = header("x-webhook-signature") ?? "";
      const expected = createHmac(
        "sha256",
        requiredString(secrets.secretKey, "Cashfree secret key"),
      )
        .update(`${timestamp}${raw}`)
        .digest("base64");
      if (!timestamp || !safeEqual(actual, expected))
        throw createError(401, "Cashfree webhook signature is invalid.");
    } else if (provider === "paytm") {
      const checksum = String(payload["CHECKSUMHASH"] ?? "");
      const merchantId = requiredString(resolved.config.merchantId, "Paytm merchant ID");
      if (String(payload["MID"] ?? "") !== merchantId)
        throw createError(401, "Paytm webhook merchant ID does not match.");
      const signedParams = Object.fromEntries(
        Object.entries(payload)
          .filter(([key]) => key !== "CHECKSUMHASH")
          .map(([key, value]) => [key, String(value ?? "")]),
      );
      if (
        !checksum ||
        !PaytmChecksum.verifySignature(
          signedParams,
          requiredString(secrets.secretKey, "Paytm merchant key"),
          checksum,
        )
      )
        throw createError(401, "Paytm webhook checksum is invalid.");
    } else if (provider === "phonepe") {
      const username = requiredString(resolved.config.webhookUsername, "PhonePe webhook username");
      const password = requiredString(secrets.webhookSecret, "PhonePe webhook password");
      const expected = createHash("sha256").update(`${username}:${password}`).digest("hex");
      const supplied = (header("authorization") ?? "").replace(/^SHA256\s+/i, "");
      if (!safeEqual(supplied, expected))
        throw createError(401, "PhonePe webhook authorization is invalid.");
    }

    let paymentAttemptId = "";
    let amountPaid = 0;
    let transactionId = "";
    let upiId: string | undefined;

    if (provider === "stripe") {
      if (paymentPayload["type"] === "checkout.session.completed") {
        const session = objectValue(objectValue(paymentPayload["data"])?.["object"]);
        const metadata = objectValue(session?.["metadata"]);
        paymentAttemptId = String(
          metadata?.["paymentAttemptId"] ?? session?.["client_reference_id"] ?? "",
        );
        amountPaid = Number(session?.amount_total ?? 0) / 100;
        transactionId = String(session?.["payment_intent"] ?? session?.["id"] ?? "");
      }
    } else if (provider === "razorpay") {
      const event = paymentPayload["event"];
      if (event === "order.paid" || event === "payment.captured") {
        const paymentContainer = objectValue(objectValue(paymentPayload["payload"])?.["payment"]);
        const payment = objectValue(paymentContainer?.["entity"]);
        paymentAttemptId = String(
          objectValue(payment?.["notes"])?.["paymentAttemptId"] ?? payment?.["order_id"] ?? "",
        );
        amountPaid = Number(payment?.["amount"] ?? 0) / 100;
        transactionId = String(payment?.["id"] ?? "");
        upiId = payment?.["vpa"] ? String(payment["vpa"]) : undefined;
      }
    } else if (provider === "paytm") {
      if (paymentPayload["STATUS"] === "TXN_SUCCESS") {
        paymentAttemptId = String(paymentPayload["ORDERID"] ?? "");
        amountPaid = Number(paymentPayload["TXNAMOUNT"] ?? 0);
        transactionId = String(paymentPayload["TXNID"] ?? "");
      }
    } else if (provider === "phonepe") {
      const phonePePayload = objectValue(paymentPayload["payload"]);
      if (
        paymentPayload["event"] === "checkout.order.completed" &&
        phonePePayload?.["state"] === "COMPLETED"
      ) {
        paymentAttemptId = String(phonePePayload["merchantOrderId"] ?? "");
        amountPaid = Number(phonePePayload["amount"] ?? 0) / 100;
        const paymentDetails = Array.isArray(phonePePayload["paymentDetails"])
          ? phonePePayload["paymentDetails"]
          : [];
        const paymentDetail = objectValue(paymentDetails[0]);
        transactionId = String(paymentDetail?.["transactionId"] ?? phonePePayload["orderId"] ?? "");
      }
    } else if (provider === "cashfree") {
      if (
        paymentPayload["type"] === "PAYMENT_SUCCESS_WEBHOOK" ||
        paymentPayload["event"] === "ORDER_PAID"
      ) {
        const data = objectValue(paymentPayload["data"]);
        const order = objectValue(data?.["order"] ?? paymentPayload["order"]);
        const payment = objectValue(data?.["payment"] ?? paymentPayload["payment"]);
        paymentAttemptId = String(order?.["order_id"] ?? "");
        amountPaid = Number(order?.["order_amount"] ?? 0);
        transactionId = String(payment?.["cf_payment_id"] ?? "");
      }
    }

    if (!paymentAttemptId)
      throw createError(400, "No ERP payment attempt was found in the verified webhook.");
    if (!transactionId) throw createError(400, "Payment provider transaction ID is missing.");
    if (!Number.isFinite(amountPaid) || amountPaid <= 0)
      throw createError(400, "Payment provider amount is invalid.");

    const attempt = await TenantPaymentAttemptModel.findOne({
      provider,
      ...(isValidObjectId(paymentAttemptId)
        ? { $or: [{ _id: paymentAttemptId }, { providerOrderId: paymentAttemptId }] }
        : { providerOrderId: paymentAttemptId }),
    }).lean();
    if (!attempt) throw createError(404, "Payment attempt was not created by this ERP.");
    if (attempt.status === "paid") {
      return {
        success: true,
        duplicate: true,
        feeRecordId: String(attempt.feeRecordId),
        transactionId: attempt.providerPaymentId ?? transactionId,
      };
    }
    if (attempt.status !== "pending")
      throw createError(409, `Payment attempt is ${attempt.status} and cannot be completed.`);
    if (Math.round(attempt.amount * 100) !== Math.round(amountPaid * 100))
      throw createError(409, "Provider amount does not match the ERP payment attempt.");
    const feeRecordId = String(attempt.feeRecordId);

    const providerEventId =
      String(paymentPayload["id"] ?? "") ||
      `${provider}:${transactionId}:${String(paymentPayload["event"] ?? paymentPayload["type"] ?? "payment")}`;
    const existingEvent = await TenantPaymentWebhookEventModel.findOne({
      provider,
      eventId: providerEventId,
    }).lean();
    if (existingEvent?.status === "processed") {
      return {
        success: true,
        duplicate: true,
        feeRecordId: existingEvent.feeRecordId,
        transactionId: existingEvent.transactionId,
      };
    }
    if (existingEvent && existingEvent.payloadHash !== payloadHash)
      throw createError(409, "Webhook event ID was reused with a different payload.");
    if (existingEvent?.status === "processing")
      throw createError(409, "Webhook event is already being processed.");

    try {
      if (existingEvent?.status === "failed") {
        const claimed = await TenantPaymentWebhookEventModel.findOneAndUpdate(
          { provider, eventId: providerEventId, status: "failed", payloadHash },
          { $set: { status: "processing" }, $unset: { lastError: 1 } },
          { returnDocument: "after" },
        ).lean();
        if (!claimed) throw createError(409, "Webhook retry is already being processed.");
      } else {
        await TenantPaymentWebhookEventModel.create({
          provider,
          eventId: providerEventId,
          payloadHash,
          status: "processing",
        });
      }
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Webhook event is already being processed.");
      }
      throw error;
    }

    const claimedAttempt = await TenantPaymentAttemptModel.findOneAndUpdate(
      { _id: attempt._id, status: "pending" },
      { $set: { status: "processing" } },
      { returnDocument: "after" },
    ).lean();
    if (!claimedAttempt) {
      const current = await TenantPaymentAttemptModel.findById(attempt._id).lean();
      if (current?.status === "paid")
        return {
          success: true,
          duplicate: true,
          feeRecordId: String(current.feeRecordId),
          transactionId: current.providerPaymentId ?? transactionId,
        };
      throw createError(409, "Payment attempt is already being processed.");
    }

    const { feeRepository } = await import("../repositories/fee.repository");
    const record = await feeRepository.findRecordById(feeRecordId);
    if (!record) {
      await TenantPaymentWebhookEventModel.updateOne(
        { provider, eventId: providerEventId },
        { $set: { status: "failed", lastError: "Fee record no longer exists." } },
      ).exec();
      await TenantPaymentAttemptModel.updateOne(
        { _id: attempt._id, status: "processing" },
        { $set: { status: "failed", lastError: "Fee record no longer exists." } },
      ).exec();
      throw createError(404, "Fee record linked to this payment attempt no longer exists.");
    }

    let studentEmail = `${record.rollNumber || "student"}@institution.edu`;
    let fatherName = "N/A";

    if (record.studentProfileId) {
      try {
        const student = await studentProfileRepository.findById(String(record.studentProfileId));
        if (student) {
          const userObj = student.userId as unknown as Record<string, unknown> | null;
          studentEmail = student.collegeEmail || String(userObj?.["email"] || "") || studentEmail;
          fatherName = student.parentInfo?.fatherName || fatherName;
        }
      } catch {
        // Fallback
      }
    }

    const { feeService } = await import("./fee.service");
    try {
      await feeService.recordPayment({
        feeRecordId,
        amountPaid,
        paymentMode: FeePaymentMode.ONLINE_PORTAL,
        paymentDate: new Date().toISOString(),
        bankRef: transactionId,
        upiId,
        collectedBy: "000000000000000000000000",
        collectedByName: `${provider.toUpperCase()} Gateway Webhook`,
        studentEmail,
        studentName: record.studentName,
        fatherName,
      });
      await TenantPaymentAttemptModel.updateOne(
        { _id: attempt._id, status: "processing" },
        {
          $set: {
            status: "paid",
            providerPaymentId: transactionId,
            paidAt: new Date(),
          },
        },
      ).exec();
      await TenantPaymentWebhookEventModel.updateOne(
        { provider, eventId: providerEventId },
        {
          $set: {
            status: "processed",
            feeRecordId,
            transactionId,
            processedAt: new Date(),
          },
        },
      ).exec();
    } catch (error) {
      await TenantPaymentWebhookEventModel.updateOne(
        { provider, eventId: providerEventId },
        {
          $set: {
            status: "failed",
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
          },
        },
      ).exec();
      await TenantPaymentAttemptModel.updateOne(
        { _id: attempt._id, status: "processing" },
        {
          $set: {
            status: "pending",
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
          },
        },
      ).exec();
      throw error;
    }

    return { success: true, feeRecordId, transactionId };
  },
};
