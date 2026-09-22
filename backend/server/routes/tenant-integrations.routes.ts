import { Router, type NextFunction, type Request, type Response } from "express";
import createError from "http-errors";
import { authenticate, requireRoles } from "../middlewares";
import { SystemRole } from "../constants/roles";
import { tenantIntegrationService } from "../services/tenant-integration.service";
import type { TenantIntegrationProvider } from "../models/tenant-integration.model";
import { auditLogRepository } from "../repositories/audit-log.repository";

const router = Router();
const adminOnly = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]);
const paymentUsers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.STUDENT,
]);
const providers = new Set<TenantIntegrationProvider>([
  "smtp",
  "firebase",
  "sms",
  "razorpay",
  "stripe",
  "paytm",
  "phonepe",
  "cashfree",
  "webhooks",
]);

function providerFrom(value: string): TenantIntegrationProvider {
  if (!providers.has(value as TenantIntegrationProvider))
    throw createError(404, `Provider '${value}' not found.`);
  return value as TenantIntegrationProvider;
}

router.get("/", authenticate, adminOnly, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tenantIntegrationService.list() });
  } catch (error) {
    next(error);
  }
});

router.get("/firebase/client-config", authenticate, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tenantIntegrationService.getFirebaseClientConfig() });
  } catch (error) {
    next(error);
  }
});

router.get("/firebase/readiness", authenticate, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tenantIntegrationService.readiness("firebase") });
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:provider",
  authenticate,
  adminOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await tenantIntegrationService.save(
        providerFrom(req.params.provider),
        req.body,
        req.user?._id ? String(req.user._id) : undefined,
      );
      await auditLogRepository.create({
        user: req.user ?? null,
        action: "TENANT_INTEGRATION_UPDATED",
        module: "settings",
        targetId: providerFrom(req.params.provider),
        targetModel: "TenantIntegration",
        description: `${providerFrom(req.params.provider)} integration configuration updated`,
        metadata: {
          provider: providerFrom(req.params.provider),
          enabled: Boolean(req.body.enabled),
        },
        req,
      });
      res.json({ success: true, data, message: "Integration settings saved securely." });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/:provider/test", authenticate, adminOnly, async (req, res, next) => {
  try {
    const provider = providerFrom(req.params.provider);
    const data = await tenantIntegrationService.test(provider);
    await auditLogRepository.create({
      user: req.user ?? null,
      action: "TENANT_INTEGRATION_TESTED",
      module: "settings",
      targetId: provider,
      targetModel: "TenantIntegration",
      description: `${provider} integration connection verified`,
      metadata: { provider, succeeded: true },
      req,
    });
    res.json({ success: true, data, message: "Connection verified successfully." });
  } catch (error) {
    next(error);
  }
});

router.post("/:provider/checkout", authenticate, paymentUsers, async (req, res, next) => {
  try {
    const idempotencyHeader = req.headers["idempotency-key"];
    const data = await tenantIntegrationService.createPaymentCheckout({
      provider: providerFrom(req.params.provider),
      feeRecordId: String(req.body.feeRecordId ?? ""),
      amount: Number(req.body.amount),
      currency: req.body.currency ? String(req.body.currency) : undefined,
      idempotencyKey: String(
        (Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader) ??
          req.body.idempotencyKey ??
          "",
      ),
      userId: String(req.user?._id ?? ""),
      activeRole: req.activeRole,
      email: req.user?.email,
      phone: req.user?.phone,
      returnUrl: req.body.returnUrl ? String(req.body.returnUrl) : undefined,
      requestOrigin: req.headers.origin,
      webhookUrl: `${req.protocol}://${req.get("host")}${req.baseUrl}/${providerFrom(req.params.provider)}/webhook`,
    });
    res.status(201).json({
      success: true,
      data,
      message: "Payment checkout created.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:provider/webhook", async (req, res, next) => {
  try {
    const provider = providerFrom(req.params.provider);
    const { logger } = await import("../utils/logger.util");
    logger.info(`[Tenant Webhook] Received callback for provider '${provider}'`, {
      requestId: req.headers["x-request-id"],
    });

    if (!req.rawBody) throw createError(400, "Raw webhook body is unavailable.");
    const result = await tenantIntegrationService.processPaymentWebhook(
      provider,
      req.body as Record<string, unknown>,
      req.rawBody,
      req.headers,
    );

    res.json({
      success: true,
      data: result,
      message: `Webhook event for provider '${provider}' processed successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
