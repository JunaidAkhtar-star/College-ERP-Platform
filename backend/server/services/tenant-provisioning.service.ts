import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { configs } from "../configs";
import { EmailTemplate, sendEmail } from "../email/email.service";
import { PublicCheckoutModel } from "../models/public-checkout.model";
import { PublicSiteConfigModel, SubscriptionPlanModel } from "../models/platform.model";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { cryptoUtil } from "../utils/crypto.util";
import { formatIndiaDate } from "../utils/date.util";

export async function provisionPendingCheckoutForTenant(tenantId: string): Promise<void> {
  const checkout = await PublicCheckoutModel.findOne({ tenantId })
    .select("+adminPasswordCiphertext")
    .exec();
  if (!checkout || ["provisioning", "ready"].includes(checkout.status)) return;
  if (checkout.status !== "payment_verified") {
    console.warn(
      `[TenantProvisioning] Refused unverified checkout provisioning for tenant ${tenantId}.`,
    );
    return;
  }
  const [tenant, plan] = await Promise.all([
    TenantModel.findById(tenantId),
    SubscriptionPlanModel.findById(checkout.planId).lean(),
  ]);
  if (!tenant || !plan) return;

  checkout.status = "provisioning";
  checkout.error = undefined;
  await checkout.save();
  await TenantModel.updateOne({ _id: tenant._id }, { $set: { status: TenantStatus.PROVISIONING } });

  const compiledRuntime = path.extname(__filename) === ".js";
  const scriptPath = compiledRuntime
    ? path.resolve(__dirname, "../scripts/seed.js")
    : path.resolve(process.cwd(), "server/scripts/seed.ts");
  const executable = compiledRuntime
    ? process.execPath
    : path.resolve(process.cwd(), "node_modules/.bin/ts-node");
  const adminPassword = cryptoUtil.decrypt(checkout.adminPasswordCiphertext);
  const env = {
    ...process.env,
    MONGODB_URI: configs.MONGODB_URI,
    MONGODB_DB_NAME: tenant.databaseName,
    SEED_ADMIN_EMAIL: checkout.adminEmail,
    SEED_ADMIN_PASS: adminPassword,
    SEED_ADMIN_NAME: `${tenant.name} Administrator`,
    SEED_REQUIRE_PASSWORD_CHANGE: "true",
    SEED_INSTITUTION_NAME: tenant.name,
    SEED_CORE_CURRICULA: "true",
    SEED_CLEAN: "true",
  };

  execFile(executable, [scriptPath], { env, cwd: process.cwd() }, async (error) => {
    if (error) {
      await Promise.all([
        TenantModel.updateOne(
          { _id: tenant._id },
          { $set: { status: TenantStatus.PROVISIONING_FAILED } },
        ),
        PublicCheckoutModel.updateOne(
          { _id: checkout._id },
          { $set: { status: "failed", error: "Workspace provisioning failed." } },
        ),
      ]);
      return;
    }
    await Promise.all([
      TenantModel.updateOne({ _id: tenant._id }, { $set: { status: TenantStatus.ACTIVE } }),
      PublicCheckoutModel.updateOne(
        { _id: checkout._id },
        {
          $set: { status: "ready" },
          $unset: { adminPasswordCiphertext: 1, error: 1 },
        },
      ),
    ]);
    const loginUrl = configs.TENANT_APP_URL_TEMPLATE.replace(
      "{tenant}",
      encodeURIComponent(tenant.tenantId),
    );
    const publicSite = await PublicSiteConfigModel.findOne().lean();
    const logoPath = path.resolve(process.cwd(), "public", "devvelocitylogo-email.png");
    const embeddedLogo = fs.existsSync(logoPath);
    await sendEmail({
      to: checkout.adminEmail,
      subject: `Your ${tenant.name} workspace is ready`,
      template: EmailTemplate.TENANT_WELCOME,
      context: {
        recipientName: `${tenant.name} Administrator`,
        organizationName: tenant.name,
        tenantId: tenant.tenantId,
        planName: plan.name,
        adminEmail: checkout.adminEmail,
        temporaryPassword: adminPassword,
        subscriptionExpiresAt: formatIndiaDate(tenant.subscriptionExpiresAt),
        loginUrl,
        supportEmail: publicSite?.supportEmail,
      },
      branding: {
        instituteName: publicSite?.companyName || "Devvelocity",
        emailSenderName: publicSite?.companyName || "Devvelocity",
        email: publicSite?.supportEmail,
        replyToEmail: publicSite?.supportEmail,
        websiteUrl: configs.PLATFORM_WEBSITE_URL,
        logoUrl: embeddedLogo ? "cid:devvelocity-platform-logo" : configs.PLATFORM_LOGO_URL,
      },
      attachments: embeddedLogo
        ? [
            {
              filename: "devvelocity-logo.png",
              path: logoPath,
              contentType: "image/png",
              cid: "devvelocity-platform-logo",
            },
          ]
        : undefined,
    });
  });
}
