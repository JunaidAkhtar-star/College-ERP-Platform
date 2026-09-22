import { randomBytes } from "crypto";
import { promises as dns } from "dns";
import { Router } from "express";
import createError from "http-errors";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { SystemRole } from "../constants/roles";
import { configs } from "../configs";
import { getTenantConnection } from "../configs/connectionManager";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { TenantModel, TenantStatus } from "../models/tenant.model";

const router = Router();
const DOMAIN_RE = /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const normalizeDomain = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "")
    .replace(/\.$/, "");
const TENANT_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

router.get("/active", async (_req, res, next) => {
  try {
    const tenants = await TenantModel.find({
      status: TenantStatus.ACTIVE,
    })
      .select("tenantId name databaseName")
      .sort({ name: 1 })
      .lean();

    const organizations = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          const connection = getTenantConnection(tenant.tenantId, tenant.databaseName);
          const SettingsModel =
            connection.models.InstitutionSetting ??
            connection.model("InstitutionSetting", InstitutionSettingModel.schema);
          const settings = await SettingsModel.findOne()
            .select(
              "name shortCode logoUrl faviconUrl primaryColor secondaryColor onboardingStatus",
            )
            .lean();
          return {
            tenantId: tenant.tenantId,
            name: String(settings?.name || tenant.name),
            shortCode: settings?.shortCode ? String(settings.shortCode) : undefined,
            logoUrl: settings?.logoUrl ? String(settings.logoUrl) : undefined,
            primaryColor: settings?.primaryColor ? String(settings.primaryColor) : undefined,
            secondaryColor: settings?.secondaryColor ? String(settings.secondaryColor) : undefined,
            configured:
              settings?.onboardingStatus === "completed" &&
              Boolean(settings.shortCode) &&
              Boolean(settings.logoUrl),
          };
        } catch {
          return {
            tenantId: tenant.tenantId,
            name: String(tenant.name),
            configured: false,
          };
        }
      }),
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      data: organizations.filter(
        (organization): organization is NonNullable<typeof organization> => organization !== null,
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/access-status", async (req, res, next) => {
  try {
    const tenantId = String(req.query.tenantId ?? "")
      .trim()
      .toLowerCase();
    if (!TENANT_ID_RE.test(tenantId)) throw createError(400, "A valid tenant ID is required.");
    const tenant = await TenantModel.findOne({ tenantId })
      .select(
        "tenantId name status billingStatus subscriptionExpiresAt trialEndsAt graceEndsAt updatedAt",
      )
      .lean();
    if (!tenant) throw createError(404, "Institution workspace was not found.");
    const now = Date.now();
    const subscriptionExpired = Boolean(
      tenant.subscriptionExpiresAt &&
      new Date(tenant.subscriptionExpiresAt).getTime() < now &&
      !["trialing", "free"].includes(tenant.billingStatus ?? "active"),
    );
    const trialEnded = Boolean(
      tenant.billingStatus === "trialing" &&
      (!tenant.trialEndsAt || new Date(tenant.trialEndsAt).getTime() < now),
    );
    const graceEnded = Boolean(
      tenant.billingStatus === "past_due" &&
      (!tenant.graceEndsAt || new Date(tenant.graceEndsAt).getTime() < now),
    );
    const accessible =
      tenant.status === TenantStatus.ACTIVE &&
      !subscriptionExpired &&
      !trialEnded &&
      !graceEnded &&
      !["pending_payment", "cancelled"].includes(tenant.billingStatus ?? "active");
    const reason =
      tenant.status === TenantStatus.SUSPENDED
        ? "This institution workspace has been temporarily suspended."
        : tenant.status === TenantStatus.EXPIRED || subscriptionExpired || trialEnded
          ? "This institution workspace subscription has expired."
          : tenant.billingStatus === "past_due" && graceEnded
            ? "This institution workspace is unavailable because its billing grace period ended."
            : tenant.billingStatus === "pending_payment"
              ? "This institution workspace is awaiting subscription payment."
              : tenant.billingStatus === "cancelled"
                ? "This institution workspace subscription has been cancelled."
                : tenant.status !== TenantStatus.ACTIVE
                  ? "This institution workspace is not ready for access yet."
                  : undefined;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        tenantId: tenant.tenantId,
        institutionName: tenant.name,
        accessible,
        status: tenant.status,
        billingStatus: tenant.billingStatus,
        reason,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/resolve", async (req, res, next) => {
  try {
    const hostname = normalizeDomain(req.query.hostname);
    if (!DOMAIN_RE.test(hostname)) throw createError(400, "A valid hostname is required.");
    const tenant = await TenantModel.findOne({
      customDomain: hostname,
      customDomainStatus: "active",
    })
      .select("tenantId customDomain status")
      .lean();
    if (!tenant) throw createError(404, "No tenant is configured for this domain.");
    res.json({
      success: true,
      data: { tenantId: tenant.tenantId, accessible: tenant.status === TenantStatus.ACTIVE },
    });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate, requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN]));

router.get("/", async (req, res, next) => {
  try {
    const tenant = await TenantModel.findOne({ tenantId: req.tenantId })
      .select("+domainVerificationToken")
      .lean();
    if (!tenant) throw createError(404, "Tenant not found.");
    const isVerified = tenant.customDomainStatus === "active";
    const sslStatus = isVerified ? "active" : tenant.sslStatus || "pending";

    res.json({
      success: true,
      data: {
        defaultDomain: `${tenant.tenantId}.${configs.TENANT_ROOT_DOMAIN}`,
        customDomain: tenant.customDomain,
        status: tenant.customDomainStatus,
        sslStatus,
        verifiedAt: tenant.domainVerifiedAt,
        cnameTarget: configs.TENANT_CNAME_TARGET,
        verificationHost: tenant.customDomain
          ? `_devvelocity-verification.${tenant.customDomain}`
          : null,
        verificationToken: tenant.domainVerificationToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const customDomain = normalizeDomain(req.body.customDomain);
    if (!DOMAIN_RE.test(customDomain)) throw createError(400, "Enter a valid custom domain.");
    if (
      customDomain === configs.TENANT_ROOT_DOMAIN ||
      customDomain.endsWith(`.${configs.TENANT_ROOT_DOMAIN}`)
    ) {
      throw createError(400, "Managed Devvelocity domains cannot be registered as custom domains.");
    }
    const duplicate = await TenantModel.exists({ customDomain, tenantId: { $ne: req.tenantId } });
    if (duplicate) throw createError(409, "This domain is already assigned to another tenant.");
    const token = `devvelocity-verify-${randomBytes(18).toString("hex")}`;
    await TenantModel.updateOne(
      { tenantId: req.tenantId },
      {
        $set: {
          customDomain,
          customDomainStatus: "pending",
          domainVerificationToken: token,
          sslStatus: "pending",
        },
        $unset: { domainVerifiedAt: 1 },
      },
    );
    res.json({
      success: true,
      message: "Domain saved. Add the displayed DNS records, then verify.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const tenant = await TenantModel.findOne({ tenantId: req.tenantId }).select(
      "+domainVerificationToken",
    );
    if (!tenant?.customDomain || !tenant.domainVerificationToken) {
      throw createError(400, "Configure a custom domain before verification.");
    }
    const verificationHost = `_devvelocity-verification.${tenant.customDomain}`;
    const [txtResult, cnameResult] = await Promise.allSettled([
      dns.resolveTxt(verificationHost),
      dns.resolveCname(tenant.customDomain),
    ]);
    const txtValues = txtResult.status === "fulfilled" ? txtResult.value.flat() : [];
    const cnameValues =
      cnameResult.status === "fulfilled"
        ? cnameResult.value.map((v) => v.toLowerCase().replace(/\.$/, ""))
        : [];
    const txtValid = txtValues.includes(tenant.domainVerificationToken);
    const cnameValid = cnameValues.includes(
      configs.TENANT_CNAME_TARGET.toLowerCase().replace(/\.$/, ""),
    );
    if (!txtValid || !cnameValid) {
      tenant.customDomainStatus = "failed";
      await tenant.save();
      throw createError(
        400,
        `DNS verification failed. ${!txtValid ? "TXT record is missing. " : ""}${!cnameValid ? "CNAME record is missing." : ""}`.trim(),
      );
    }
    tenant.customDomainStatus = "active";
    tenant.domainVerifiedAt = new Date();
    tenant.sslStatus = "active";
    await tenant.save();
    res.json({
      success: true,
      data: { customDomain: tenant.customDomain, status: "active", sslStatus: "active" },
      message: "Domain and SSL verified successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    await TenantModel.updateOne(
      { tenantId: req.tenantId },
      {
        $unset: {
          customDomain: 1,
          customDomainStatus: 1,
          domainVerificationToken: 1,
          domainVerifiedAt: 1,
          sslStatus: 1,
        },
      },
    );
    res.json({
      success: true,
      message: "Custom domain removed. The managed tenant domain remains active.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
