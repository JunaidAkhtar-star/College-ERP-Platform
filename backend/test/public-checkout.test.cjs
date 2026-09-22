const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const routes = fs.readFileSync(path.join(root, "server/routes/super-admin.routes.ts"), "utf8");
const provisioning = fs.readFileSync(
  path.join(root, "server/services/tenant-provisioning.service.ts"),
  "utf8",
);
const billing = fs.readFileSync(
  path.join(root, "server/services/platform-billing.service.ts"),
  "utf8",
);
const agreement = fs.readFileSync(
  path.join(root, "server/services/checkout-agreement.service.ts"),
  "utf8",
);
const agreementModel = fs.readFileSync(
  path.join(root, "server/models/checkout-agreement.model.ts"),
  "utf8",
);
const pdfService = fs.readFileSync(path.join(root, "server/pdf/pdf.service.ts"), "utf8");

test("public checkout is rate-limited, token-bound and manually payment-verified", () => {
  assert.match(routes, /public-checkout\/register", publicCheckoutLimiter/);
  assert.match(routes, /sessionTokenHash: checkoutTokenHash/);
  assert.match(routes, /public-checkout\/payment-proof/);
  assert.match(routes, /awaiting_payment_review/);
  assert.match(routes, /approveOfflinePlatformPayment/);
  assert.match(routes, /public-checkout\/session/);
  assert.match(routes, /PLATFORM_PAYMENT_REQUEST/);
  assert.match(routes, /configs\.PLATFORM_WEBSITE_URL\.replace/);
  assert.doesNotMatch(routes, /req\.get\("origin"\)/);
  assert.match(routes, /24 \* 60 \* 60 \* 1000/);
  assert.match(provisioning, /checkout\.status !== "payment_verified"/);
});

test("payment proof requires versioned OTP-verified agreement acceptance", () => {
  assert.match(routes, /public-checkout\/agreements/);
  assert.match(routes, /public-checkout\/agreement\/send-otp/);
  assert.match(routes, /public-checkout\/agreement\/verify-otp/);
  assert.match(routes, /publicCheckoutOtpLimiter/);
  assert.match(routes, /crypto\.scryptSync/);
  assert.match(routes, /crypto\.timingSafeEqual/);
  assert.match(routes, /otpAttempts >= 5/);
  assert.match(routes, /5 \* 60 \* 1000/);
  assert.match(routes, /expiresInSeconds: 300/);
  assert.match(routes, /Verify the NDA and Terms acceptance/);
  assert.match(routes, /ipAddressCiphertext = cryptoUtil\.encrypt/);
  assert.match(agreementModel, /checkoutId: 1, ndaVersion: 1, termsVersion: 1/);
});

test("paid checkout combines accepted agreements with the payment-approved invoice email", () => {
  assert.match(agreement, /createHash\(\"sha256\"\)/);
  assert.match(agreement, /Certificate of electronic acceptance/i);
  assert.match(agreement, /not represented as a statutory digital signature/);
  assert.match(agreement, /generateAcceptedAgreementPdfs/);
  assert.match(billing, /generateAcceptedAgreementPdfs/);
  assert.match(billing, /\.\.\.agreementAttachments/);
  assert.match(billing, /Payment approved and agreements confirmed/);
  assert.match(routes, /if \(!paymentRequired\)/);
});

test("checkout renders protected PDF review copies and keeps the Devvelocity watermark visible", () => {
  assert.match(agreement, /generateAgreementPreviewPdfs/);
  assert.match(agreement, /pdfDataUrl/);
  assert.match(agreement, /REVIEW COPY/);
  assert.match(agreement, /z-index:20/);
  assert.match(agreement, /DEVVELOCITY/);
  assert.match(routes, /documents: previewDocuments/);
  assert.match(routes, /agreementAccepted/);
  assert.match(routes, /acceptedAt: \{ \$exists: true \}/);
  assert.match(routes, /EmailTemplate\.AGREEMENT_ACCEPTED/);
  assert.match(routes, /attachments: acceptedDocuments/);
  assert.match(pdfService, /al2023\.tar\.br/);
  assert.match(pdfService, /LD_LIBRARY_PATH/);
  assert.match(pdfService, /libnspr4\.so/);
});

test("public checkout generates and encrypts temporary credentials on the server", () => {
  assert.match(routes, /generateCheckoutAdminPassword/);
  assert.match(routes, /adminPasswordCiphertext: cryptoUtil\.encrypt\(adminPassword\)/);
  assert.match(provisioning, /cryptoUtil\.decrypt\(checkout\.adminPasswordCiphertext\)/);
  assert.match(provisioning, /SEED_CLEAN: "true"/);
  assert.match(provisioning, /SEED_REQUIRE_PASSWORD_CHANGE: "true"/);
  assert.match(provisioning, /\$unset: \{ adminPasswordCiphertext: 1/);
  assert.match(provisioning, /temporaryPassword: adminPassword/);
});

test("public checkout carries validated add-on selections and notifies platform administrators", () => {
  assert.match(routes, /requestedAddonSlugs/);
  assert.match(routes, /addonSlugs: requestedAddonSlugs/);
  assert.match(routes, /notifyPlatformAdminsOfPublicRegistration/);
  assert.match(routes, /NotificationChannel\.PUSH/);
  assert.doesNotMatch(routes, /sendFcmMulticast/);
  assert.doesNotMatch(routes, /createdBy: "system"/);
  assert.match(routes, /createdBy: targetUserIds\[0\]/);
});

test("free-tier checkout requires agreements and admin approval before provisioning", () => {
  const freeBranch = routes.slice(
    routes.indexOf("if (isFree)"),
    routes.indexOf("const order = await createPlatformOrder"),
  );
  assert.match(freeBranch, /amountInPaise: 0/);
  assert.match(freeBranch, /status: "agreement_required"/);
  assert.doesNotMatch(freeBranch, /provisionPendingCheckoutForTenant/);
  assert.match(routes, /public-checkout\/free-tier-submit/);
  assert.match(routes, /Verify the NDA and Terms before submitting for approval/);
  assert.match(routes, /status: "awaiting_payment_review"/);
  assert.match(billing, /plan\.planType === "free" \? "trialing" : "active"/);
});

test("tenant lifecycle distinguishes pending payment, pending approval and active provisioning", () => {
  assert.match(routes, /TenantStatus\.PENDING_PAYMENT/);
  assert.match(routes, /TenantStatus\.PENDING_APPROVAL/);
  assert.match(routes, /billingStatus: "pending_approval"/);
  assert.match(routes, /tenants\/:id\/retry-provisioning/);
  assert.match(routes, /status: "paid"/);
  assert.match(routes, /stuck for five minutes/);
  assert.match(routes, /provisionPendingCheckoutForTenant/);
});

test("pending tenants are never connected to a physical tenant database", () => {
  const usageGuard = routes.slice(
    routes.indexOf("async function measureAllTenantUsage"),
    routes.indexOf('router.get("/public-catalog"'),
  );
  assert.match(usageGuard, /TenantStatus\.PROVISIONING/);
  assert.match(usageGuard, /TenantStatus\.ACTIVE/);
  assert.match(usageGuard, /databaseReachable: false/);
  assert.doesNotMatch(usageGuard, /TenantStatus\.PENDING_PAYMENT/);
  assert.doesNotMatch(usageGuard, /TenantStatus\.PENDING_APPROVAL/);
  assert.ok(
    usageGuard.indexOf("databaseReachable: false") <
      usageGuard.indexOf("const connection = getTenantConnection("),
    "pending-state guard must return before opening a tenant database connection",
  );
});

test("platform admin registration cannot bypass checkout billing and approval", () => {
  const retiredRoute = routes.slice(
    routes.indexOf('"/tenants/direct-provisioning-disabled"'),
    routes.indexOf('router.patch(\n  "/tenants/:id"'),
  );
  const adminPage = fs.readFileSync(
    path.join(root, "..", "admin", "src", "app", "(dashboard)", "tenants", "page.tsx"),
    "utf8",
  );

  assert.match(retiredRoute, /res\.status\(410\)/);
  assert.match(retiredRoute, /Direct tenant provisioning is disabled/);
  assert.doesNotMatch(routes, /router\.post\(\s*"\/tenants",/);
  assert.match(adminPage, /super-admin\/public-checkout\/register/);
  assert.match(adminPage, /institutionName: values\.name/);
});

test("monthly checkout uses a monthly term and monthly prices", () => {
  assert.match(billing, /period === "month"/);
  assert.match(billing, /monthlyPriceWithPremium\(plan\.amountInPaise\)/);
  assert.match(billing, /addon\.monthlyAmountInPaise/);
});

test("monthly checkout adds ten percent over the stable annual plan rate", () => {
  assert.match(billing, /monthlyPriceWithPremium/);
  assert.match(billing, /annualAmountInPaise \/ 12\) \* 1\.1/);
  assert.match(billing, /billingPeriod === "year"/);
});

test("platform checkout uses configured invoice billing without Razorpay limits", () => {
  assert.match(billing, /PlatformBillingSettingsModel\.findOne/);
  assert.match(billing, /paymentMethod: "bank_transfer"/);
  assert.match(billing, /bankTransfer:/);
  assert.doesNotMatch(routes, /payment: \{ maxOrderAmountInPaise \}/);
  assert.doesNotMatch(billing, /razorpay/i);
  assert.doesNotMatch(routes, /billing\/razorpay\/webhook/);
});

test("checkout cannot charge for module add-ons already included in a plan", () => {
  assert.match(billing, /featureKey\.startsWith\("module\."\)/);
  assert.match(billing, /includedModules\.has\(moduleSlug\)/);
  assert.match(billing, /already included in the selected plan/);
});

test("enterprise plans always include every active module and keep capacity upgrades chargeable", () => {
  assert.match(routes, /resultingSlug === "enterprise"/);
  assert.match(routes, /update\.moduleSlugs = await allActiveModuleSlugs\(\)/);
  assert.match(routes, /update\.includedAddonSlugs = \[\]/);
  assert.match(billing, /plan\.slug === "enterprise"/);
});
