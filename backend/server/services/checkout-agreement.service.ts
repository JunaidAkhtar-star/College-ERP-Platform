import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CheckoutAgreementModel } from "../models/checkout-agreement.model";
import { generateHtmlPdf } from "../pdf/pdf.service";
import { configs } from "../configs";

export interface ICheckoutAgreementDocument {
  kind: "nda" | "terms";
  title: string;
  version: string;
  hash: string;
  sections: Array<{ heading: string; body: string }>;
}

const NDA_VERSION = "2026.07";
const TERMS_VERSION = "2026.07";

const NDA_SECTIONS: ICheckoutAgreementDocument["sections"] = [
  {
    heading: "Purpose and confidential information",
    body: "The parties may exchange non-public commercial, technical, security, pricing, product, customer and institutional information solely to evaluate, configure, deliver and support the Devvelocity education ERP service.",
  },
  {
    heading: "Protection and permitted use",
    body: "Each party will use reasonable safeguards, restrict access to personnel and service providers who need the information for the permitted purpose, and will not disclose or use confidential information for any unrelated purpose.",
  },
  {
    heading: "Exclusions",
    body: "Confidential information excludes information that the receiving party can demonstrate was lawfully known without restriction, independently developed, publicly available without breach, or lawfully received from a third party.",
  },
  {
    heading: "Required disclosure and return",
    body: "A legally required disclosure may be made after reasonable notice where permitted. On request or termination, confidential information will be returned or securely deleted, subject to lawful retention, backup and audit obligations.",
  },
  {
    heading: "Term and remedies",
    body: "These confidentiality duties continue during the service relationship and for three years afterward; trade-secret obligations continue while the information remains a trade secret. Unauthorized disclosure may cause irreparable harm for which appropriate equitable relief may be sought.",
  },
];

const TERMS_SECTIONS: ICheckoutAgreementDocument["sections"] = [
  {
    heading: "Service and authorized users",
    body: "Devvelocity will provide the subscribed ERP plan for the institution. The institution is responsible for authorized-user administration, accurate onboarding information, lawful use, and protecting administrator credentials.",
  },
  {
    heading: "Fees, verification and activation",
    body: "Subscription activation is subject to receipt and verification of the invoiced payment. Taxes, billing period, discounts and plan limits are those stated in the invoice. A submitted payment proof does not by itself confirm payment.",
  },
  {
    heading: "Data protection and security",
    body: "Each party will comply with applicable data-protection obligations. The institution determines the data entered by its users and must have a lawful basis to process it. Devvelocity will apply reasonable technical and organizational safeguards and use service providers where necessary to deliver the service.",
  },
  {
    heading: "Availability, support and acceptable use",
    body: "The institution will not misuse, disrupt, reverse engineer, probe or unlawfully access the service. Planned maintenance, security response, third-party dependencies and events beyond reasonable control may affect availability.",
  },
  {
    heading: "Term, suspension and termination",
    body: "The service continues for the purchased term. Access may be suspended for material breach, security risk, unlawful use or overdue payment after applicable notice. Data export and deletion are handled under the service policy and applicable law.",
  },
  {
    heading: "Authority and electronic acceptance",
    body: "The person accepting confirms authority to bind the institution. This OTP-verified acceptance records consent to these versioned electronic documents; it is not represented as a statutory eSign or stamped instrument.",
  },
];

const canonicalDocument = (
  kind: "nda" | "terms",
  title: string,
  version: string,
  sections: ICheckoutAgreementDocument["sections"],
) => JSON.stringify({ kind, title, version, sections });

const buildDocument = (
  kind: "nda" | "terms",
  title: string,
  version: string,
  sections: ICheckoutAgreementDocument["sections"],
): ICheckoutAgreementDocument => ({
  kind,
  title,
  version,
  sections,
  hash: crypto
    .createHash("sha256")
    .update(canonicalDocument(kind, title, version, sections))
    .digest("hex"),
});

export const checkoutAgreementDocuments = () => ({
  nda: buildDocument("nda", "Mutual Non-Disclosure Agreement", NDA_VERSION, NDA_SECTIONS),
  terms: buildDocument("terms", "Subscription Terms and Conditions", TERMS_VERSION, TERMS_SECTIONS),
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return escaped[character];
  });

const formatIndiaDateTime = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(value);

const agreementLogoDataUri = () => {
  const logoPath = path.resolve(process.cwd(), "public", "devvelocitylogo-email.png");
  return fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
    : "";
};

const agreementHtml = (input: {
  title: string;
  version: string;
  hash: string;
  sections: ICheckoutAgreementDocument["sections"];
  tenantName: string;
  acceptanceId: string;
  signatoryName: string;
  signatoryDesignation: string;
  email: string;
  acceptedAt: Date;
  logoDataUri: string;
}) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page{size:A4;margin:11mm}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#142a3b;font-size:11px;line-height:1.55;background:#fff}
.watermark{position:fixed;inset:0;z-index:20;overflow:hidden;pointer-events:none;mix-blend-mode:multiply}
.watermark span{position:absolute;color:#0878c7;opacity:.055;font-size:35px;font-weight:800;letter-spacing:8px;transform:rotate(-34deg);white-space:nowrap}
.w1{top:8%;left:-7%}.w2{top:31%;left:18%}.w3{top:55%;left:-8%}.w4{top:78%;left:20%}
.sheet{position:relative;min-height:274mm;padding:13mm 14mm;border:1px solid #a9c6da;background:rgba(255,255,255,.92)}
.sheet:before,.sheet:after{content:"";position:absolute;pointer-events:none}
.sheet:before{inset:4px;border:2px solid #0d6198}
.sheet:after{inset:9px;border:1px solid #c7dbe9}
.corner{position:absolute;width:34px;height:34px;border-color:#84adca;z-index:2}
.tl{top:14px;left:14px;border-top:4px solid;border-left:4px solid}.tr{top:14px;right:14px;border-top:4px solid;border-right:4px solid}
.bl{bottom:14px;left:14px;border-bottom:4px solid;border-left:4px solid}.br{bottom:14px;right:14px;border-bottom:4px solid;border-right:4px solid}
.brand{text-align:center}.logo{width:64px;height:64px;object-fit:contain}.brand-name{margin-top:5px;color:#073f68;font-size:18px;font-weight:800;letter-spacing:.5px}
.brand-copy{color:#557083;font-size:9px;letter-spacing:1.8px;text-transform:uppercase}
.rule{width:70px;height:3px;margin:11px auto 18px;background:#7eb63c}
.kicker{text-align:center;color:#0c6da9;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
h1{max-width:570px;margin:9px auto 6px;text-align:center;color:#102f45;font-family:Georgia,serif;font-size:28px;line-height:1.18}
.version{text-align:center;color:#60798b;font-size:10px}
.certifies{margin:24px 0 7px;text-align:center;color:#60798b;font-family:Georgia,serif;font-size:13px;font-style:italic}
.institution{text-align:center;color:#0a5588;font-family:Georgia,serif;font-size:23px;font-weight:700}
.accepted-copy{max-width:560px;margin:12px auto 20px;text-align:center;color:#435d6f;font-size:11px}
.evidence{width:100%;margin:15px 0;border:1px solid #c7dce9;border-collapse:separate;border-spacing:0;background:#f8fbfd}
.evidence td{padding:8px 10px;border-right:1px solid #dbe8f0;border-bottom:1px solid #dbe8f0;vertical-align:top}
.evidence tr:last-child td{border-bottom:0}.evidence td:last-child{border-right:0}
.label{display:block;color:#738a9a;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.value{display:block;margin-top:2px;color:#17364c;font-weight:700;overflow-wrap:anywhere}
.approval{display:flex;align-items:flex-end;justify-content:space-between;margin-top:24px;padding:0 12px}
.signature{width:205px;text-align:center}.signature-name{font-family:Georgia,serif;font-size:16px;font-style:italic;color:#0a5588}
.signature-line{margin-top:6px;border-top:1px solid #7894a6;padding-top:5px;color:#647c8d;font-size:9px}
.seal{display:flex;width:94px;height:94px;align-items:center;justify-content:center;border:3px double #0d6eaa;border-radius:50%;color:#0d6eaa;text-align:center;font-size:8px;font-weight:800;letter-spacing:1px;transform:rotate(-7deg)}
.legal-note{position:absolute;right:24mm;bottom:15mm;left:24mm;text-align:center;color:#718696;font-size:8px}
.page-break{break-before:page}
.document{padding:8mm 10mm 12mm}.document-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid #0d6198}
.document-brand{display:flex;align-items:center;gap:9px}.document-logo{width:38px;height:38px;object-fit:contain}
.document-title{margin:18px 0 3px;color:#103c59;font-family:Georgia,serif;font-size:24px}
.meta{margin-bottom:18px;color:#60798b;font-size:9px;overflow-wrap:anywhere}
.section{break-inside:avoid;margin:0 0 13px;padding:11px 13px;border-left:3px solid #79ad3d;background:rgba(247,250,252,.9)}
.section h2{margin:0 0 4px;color:#164c70;font-size:12px}.section p{margin:0;color:#334e60}
.document-footer{margin-top:18px;padding-top:10px;border-top:1px solid #bfd3df;color:#6b8190;font-size:8px}
</style></head><body>
<div class="watermark"><span class="w1">DEVVELOCITY</span><span class="w2">DEVVELOCITY</span><span class="w3">DEVVELOCITY</span><span class="w4">DEVVELOCITY</span></div>
<section class="sheet">
<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
<div class="brand">${input.logoDataUri ? `<img class="logo" src="${input.logoDataUri}" alt="Devvelocity">` : ""}
<div class="brand-name">Devvelocity</div><div class="brand-copy">Modern software products &amp; engineering services</div></div>
<div class="rule"></div><div class="kicker">Certificate of electronic acceptance</div>
<h1>${escapeHtml(input.title)}</h1><div class="version">Document version ${escapeHtml(input.version)}</div>
<div class="certifies">This certificate records that</div>
<div class="institution">${escapeHtml(input.tenantName)}</div>
<p class="accepted-copy">accepted the above versioned agreement through an authorized representative using a verified email one-time password. The evidence below is bound to the accepted document hash.</p>
<table class="evidence">
<tr><td><span class="label">Authorized signatory</span><span class="value">${escapeHtml(input.signatoryName)}</span></td><td><span class="label">Designation</span><span class="value">${escapeHtml(input.signatoryDesignation)}</span></td></tr>
<tr><td><span class="label">Verified email</span><span class="value">${escapeHtml(input.email)}</span></td><td><span class="label">Accepted at (IST)</span><span class="value">${formatIndiaDateTime(input.acceptedAt)}</span></td></tr>
<tr><td colspan="2"><span class="label">Acceptance ID</span><span class="value">${escapeHtml(input.acceptanceId)}</span></td></tr>
<tr><td colspan="2"><span class="label">Document SHA-256 fingerprint</span><span class="value">${escapeHtml(input.hash)}</span></td></tr>
</table>
<div class="approval"><div class="signature"><div class="signature-name">${escapeHtml(input.signatoryName)}</div><div class="signature-line">Electronically accepted for ${escapeHtml(input.tenantName)}</div></div><div class="seal">OTP VERIFIED<br>ACCEPTANCE<br>RECORDED</div><div class="signature"><div class="signature-name">Devvelocity</div><div class="signature-line">${escapeHtml(configs.PLATFORM_WEBSITE_URL.replace(/^https?:\/\//, ""))}</div></div></div>
<p class="legal-note">This is evidence of email-OTP-verified electronic acceptance. It is not represented as a statutory digital signature, licensed eSign certificate, notarisation, or stamped instrument.</p>
</section>
<section class="sheet document page-break">
<div class="document-header"><div class="document-brand">${input.logoDataUri ? `<img class="document-logo" src="${input.logoDataUri}" alt="Devvelocity">` : ""}<div><strong>Devvelocity</strong><br><span class="brand-copy">Agreement record</span></div></div><div>Acceptance ID<br><strong>${escapeHtml(input.acceptanceId)}</strong></div></div>
<h1 class="document-title">${escapeHtml(input.title)}</h1>
<div class="meta">Version ${escapeHtml(input.version)} · SHA-256 ${escapeHtml(input.hash)}</div>
${input.sections.map((section, index) => `<article class="section"><h2>${String(index + 1).padStart(2, "0")} · ${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></article>`).join("")}
<div class="document-footer">Accepted by ${escapeHtml(input.signatoryName)}, ${escapeHtml(input.signatoryDesignation)}, for ${escapeHtml(input.tenantName)} · ${formatIndiaDateTime(input.acceptedAt)} IST · ${escapeHtml(input.acceptanceId)}</div>
</section>
</body></html>`;

const agreementPreviewHtml = (input: {
  document: ICheckoutAgreementDocument;
  tenantName: string;
  logoDataUri: string;
}) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}body{margin:0;color:#17364c;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55}
.watermark{position:fixed;inset:0;z-index:20;pointer-events:none;overflow:hidden;mix-blend-mode:multiply}
.watermark span{position:absolute;color:#0878c7;opacity:.06;font-size:34px;font-weight:900;letter-spacing:7px;transform:rotate(-34deg);white-space:nowrap}
.w1{top:10%;left:-8%}.w2{top:34%;left:17%}.w3{top:58%;left:-8%}.w4{top:81%;left:18%}
.page{min-height:271mm;padding:12mm;border:2px solid #0d6198;position:relative}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid #0d6198}
.brand{display:flex;align-items:center;gap:10px}.logo{width:44px;height:44px;object-fit:contain}
.brand strong{display:block;color:#073f68;font-size:17px}.brand span,.meta{color:#647c8d;font-size:9px}
.preview{border-radius:4px;background:#e9f5fc;padding:5px 8px;color:#0d6198;font-size:8px;font-weight:800;letter-spacing:1px}
h1{margin:20px 0 4px;color:#102f45;font-family:Georgia,serif;font-size:25px}.for{margin-bottom:18px;color:#526d7f}
.section{break-inside:avoid;margin-bottom:13px;padding:11px 13px;border-left:3px solid #79ad3d;background:#f7fafc}
.section h2{margin:0 0 4px;color:#164c70;font-size:12px}.section p{margin:0;color:#334e60}
.footer{position:absolute;right:12mm;bottom:10mm;left:12mm;border-top:1px solid #bfd3df;padding-top:8px;color:#6b8190;font-size:8px}
</style></head><body>
<div class="watermark"><span class="w1">DEVVELOCITY</span><span class="w2">DEVVELOCITY</span><span class="w3">DEVVELOCITY</span><span class="w4">DEVVELOCITY</span></div>
<main class="page"><header class="header"><div class="brand">${input.logoDataUri ? `<img class="logo" src="${input.logoDataUri}" alt="Devvelocity">` : ""}<div><strong>Devvelocity</strong><span>Secure agreement document</span></div></div><span class="preview">REVIEW COPY</span></header>
<h1>${escapeHtml(input.document.title)}</h1>
<p class="meta">Version ${escapeHtml(input.document.version)} · SHA-256 ${escapeHtml(input.document.hash)}</p>
<p class="for">Prepared for review by <strong>${escapeHtml(input.tenantName)}</strong>. Acceptance is recorded only after email OTP verification.</p>
${input.document.sections.map((section, index) => `<article class="section"><h2>${String(index + 1).padStart(2, "0")} · ${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></article>`).join("")}
<footer class="footer">Devvelocity · Review copy · This preview is bound to the document fingerprint above.</footer></main>
</body></html>`;

export async function generateAgreementPreviewPdfs(tenantName: string) {
  const documents = checkoutAgreementDocuments();
  const logoDataUri = agreementLogoDataUri();
  const rows: Array<ICheckoutAgreementDocument & { pdf: Buffer }> = [];
  for (const document of [documents.nda, documents.terms]) {
    rows.push({
      ...document,
      pdf: await generateHtmlPdf(agreementPreviewHtml({ document, tenantName, logoDataUri }), {
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      }),
    });
  }
  return rows.map(({ pdf, ...document }) => ({
    ...document,
    pdfDataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
  }));
}

export async function generateAcceptedAgreementPdfs(input: {
  checkoutId: string;
  tenantName: string;
}) {
  const acceptance = await CheckoutAgreementModel.findOne({
    checkoutId: input.checkoutId,
    acceptedAt: { $exists: true },
  })
    .sort({ acceptedAt: -1 })
    .lean();
  if (!acceptance?.acceptedAt || !acceptance.acceptanceId) return [];
  const common = {
    tenantName: input.tenantName,
    acceptanceId: acceptance.acceptanceId,
    signatoryName: acceptance.signatoryName,
    signatoryDesignation: acceptance.signatoryDesignation,
    email: acceptance.email,
    acceptedAt: acceptance.acceptedAt,
    logoDataUri: agreementLogoDataUri(),
  };
  const [nda, terms] = await Promise.all([
    generateHtmlPdf(
      agreementHtml({
        title: acceptance.ndaTitle,
        version: acceptance.ndaVersion,
        hash: acceptance.ndaHash,
        sections: acceptance.ndaSections,
        ...common,
      }),
      {
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      },
    ),
    generateHtmlPdf(
      agreementHtml({
        title: acceptance.termsTitle,
        version: acceptance.termsVersion,
        hash: acceptance.termsHash,
        sections: acceptance.termsSections,
        ...common,
      }),
      {
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      },
    ),
  ]);
  return [
    {
      filename: `accepted-nda-${acceptance.acceptanceId}.pdf`,
      content: nda,
      contentType: "application/pdf",
    },
    {
      filename: `accepted-terms-${acceptance.acceptanceId}.pdf`,
      content: terms,
      contentType: "application/pdf",
    },
  ];
}
