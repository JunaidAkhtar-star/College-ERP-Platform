import fs from "fs";
import path from "path";
import { connectDB } from "../configs";
import { PublicSiteConfigModel, SubscriptionPlanModel } from "../models/platform.model";
import { generateHtmlPdf } from "../pdf/pdf.service";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

async function main() {
  await connectDB();
  const [profile, plan] = await Promise.all([
    PublicSiteConfigModel.findOne().lean(),
    SubscriptionPlanModel.findOne({ slug: "enterprise", isActive: true }).lean(),
  ]);
  if (!profile) throw new Error("Platform public profile is not configured.");
  if (!plan) throw new Error("The active Enterprise subscription plan was not found.");

  const issuedAt = new Date();
  const validUntil = new Date(issuedAt);
  validUntil.setDate(validUntil.getDate() + 30);
  const formatDate = (value: Date) =>
    value.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  const amount = plan.amountInPaise / 100;
  const logoPath = path.resolve(process.cwd(), "public", "devvelocitylogo.webp");
  const logoDataUri = fs.existsSync(logoPath)
    ? `data:image/webp;base64,${fs.readFileSync(logoPath).toString("base64")}`
    : "";
  const documentNumber = `DVL-PROFORMA-${issuedAt.toISOString().slice(0, 10).replace(/-/g, "")}-001`;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef4f7; color: #172033; font-family: Arial, sans-serif; }
    .page { min-height: 297mm; padding: 18mm; background: #fff; }
    .header { display: flex; justify-content: space-between; gap: 32px; padding-bottom: 22px; border-bottom: 3px solid #0178d7; }
    .brand-logo { display: block; width: 210px; max-height: 58px; object-fit: contain; object-position: left center; }
    .tagline { margin-top: 6px; color: #667085; font-size: 12px; }
    .doc { text-align: right; }
    .doc h1 { margin: 0; color: #0178d7; font-size: 22px; }
    .doc p { margin: 5px 0 0; color: #667085; font-size: 11px; }
    .notice { margin-top: 20px; padding: 12px 16px; border-radius: 10px; background: #fff5df; color: #7a4c00; font-size: 11px; font-weight: 700; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; }
    .panel { padding: 18px; border-radius: 12px; background: #f5f8fa; }
    .label { color: #98a2b3; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .panel h2 { margin: 9px 0 7px; color: #123f60; font-size: 15px; }
    .panel p { margin: 4px 0; color: #667085; font-size: 11px; line-height: 1.5; }
    table { width: 100%; margin-top: 26px; border-collapse: collapse; }
    th { padding: 12px; background: #123f60; color: #fff; font-size: 11px; text-align: left; }
    td { padding: 15px 12px; border-bottom: 1px solid #e4e7ec; font-size: 11px; vertical-align: top; }
    th:last-child, td:last-child { text-align: right; }
    .item { color: #123f60; font-weight: 700; }
    .description { margin-top: 6px; color: #667085; line-height: 1.55; }
    .totals { width: 48%; margin: 20px 0 0 auto; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; color: #667085; font-size: 11px; }
    .grand { margin-top: 5px; padding-top: 12px; border-top: 2px solid #0178d7; color: #123f60; font-size: 17px; font-weight: 800; }
    .terms { margin-top: 32px; padding: 18px; border-radius: 12px; background: #edf6fb; }
    .terms h3 { margin: 0 0 9px; color: #123f60; font-size: 12px; }
    .terms ul { margin: 0; padding-left: 18px; color: #667085; font-size: 10px; line-height: 1.7; }
    footer { margin-top: 34px; padding-top: 16px; border-top: 1px solid #e4e7ec; color: #98a2b3; font-size: 9px; line-height: 1.6; }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        ${logoDataUri ? `<img class="brand-logo" src="${logoDataUri}" alt="${escapeHtml(profile.companyName)}" />` : `<div class="brand">${escapeHtml(profile.companyName)}</div>`}
        <div class="tagline">Enterprise education ERP subscriptions</div>
      </div>
      <div class="doc">
        <h1>PROFORMA INVOICE</h1>
        <p>${escapeHtml(documentNumber)}</p>
        <p>Issued: ${formatDate(issuedAt)}</p>
        <p>Valid until: ${formatDate(validUntil)}</p>
      </div>
    </header>

    <div class="notice">SUBSCRIPTION PROPOSAL · NOT A TAX INVOICE · NO PAYMENT HAS BEEN RECEIVED</div>

    <section class="details">
      <div class="panel">
        <div class="label">Issued by</div>
        <h2>${escapeHtml(profile.companyName)}</h2>
        <p>${escapeHtml(profile.address)}</p>
        <p>${escapeHtml(profile.salesEmail)}</p>
        <p>${escapeHtml(profile.phone)}</p>
      </div>
      <div class="panel">
        <div class="label">Prepared for</div>
        <h2>Prospective Institutional Customer</h2>
        <p>College, university or educational institution</p>
        <p>Final billing identity and address will be confirmed before purchase.</p>
      </div>
    </section>

    <table>
      <thead>
        <tr><th>Description</th><th>Term</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item">${escapeHtml(plan.name)} ERP Subscription</div>
            <div class="description">${escapeHtml(plan.description)} Includes the modules, platform limits and support entitlements defined in the active Enterprise subscription catalogue.</div>
          </td>
          <td>Annual</td>
          <td>${formatMoney(amount)}</td>
        </tr>
      </tbody>
    </table>

    <section class="totals">
      <div class="total-row"><span>Subscription subtotal</span><strong>${formatMoney(amount)}</strong></div>
      <div class="total-row"><span>Applicable taxes</span><span>Excluded</span></div>
      <div class="total-row grand"><span>Proposed amount</span><span>${formatMoney(amount)}</span></div>
    </section>

    <section class="terms">
      <h3>Commercial terms</h3>
      <ul>
        <li>This document is a generic subscription proforma provided for payment-limit and commercial review.</li>
        <li>It is not issued to a specific tenant and does not confirm a completed sale or payment.</li>
        <li>Applicable GST and customer billing details will appear on the final tax invoice where legally required.</li>
        <li>Subscription activation occurs only after verified payment and successful tenant provisioning.</li>
        <li>Final scope is governed by the selected plan and the executed customer agreement.</li>
      </ul>
    </section>

    <footer>
      Generated electronically from the live ${escapeHtml(profile.companyName)} subscription catalogue.
      Contact ${escapeHtml(profile.salesEmail)} for commercial verification. This proforma must not be recorded as a tax invoice or proof of payment.
    </footer>
  </main>
</body>
</html>`;

  const pdf = await generateHtmlPdf(html, {
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  const outputDirectory = path.resolve(process.cwd(), "generated-documents");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, "devvelocity-enterprise-subscription-proforma.pdf");
  fs.writeFileSync(outputPath, pdf);
  console.log(outputPath);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
