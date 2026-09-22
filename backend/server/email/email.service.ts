import nodemailer, { type SendMailOptions } from "nodemailer";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { configs } from "../configs";
import { tenantLocalStorage } from "../configs/connectionManager";
import { tenantIntegrationService } from "../services/tenant-integration.service";
import { platformIntegrationService } from "../services/platform-integration.service";
import { formatIndiaDate } from "../utils/date.util";
import { resolveRequestAppBaseUrl } from "../utils/tenant-app-url.util";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template: EmailTemplate;
  context: Record<string, unknown>;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: "high" | "normal" | "low";
  branding?: IEmailBranding;
  /** Fail the caller when delivery is required for the business workflow. */
  throwOnFailure?: boolean;
}

export interface IEmailBranding {
  instituteName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  websiteUrlShort?: string;
  logoUrl?: string;
  emailSenderName?: string;
  replyToEmail?: string;
  primaryColor?: string;
  secondaryColor?: string;
  portalUrl?: string;
}

export enum EmailTemplate {
  VERIFY_EMAIL = "verify-email",
  RESET_PASSWORD = "reset-password",
  WELCOME_USER = "welcome-user",
  ACCOUNT_INVITE = "account-invite",
  FACULTY_INVITE = "faculty-invite",
  ADMISSION_RECEIVED = "admission-received",
  ADMISSION_CONFIRMED = "admission-confirmed",
  FEE_PAYMENT = "fee-payment",
  HALL_TICKET = "hall-ticket",
  RESULT_PUBLISHED = "result-published",
  ATTENDANCE_ALERT = "attendance-alert",
  PAYSLIP = "payslip",
  // Per-scenario notification emails
  LEAVE_UPDATE = "leave-update",
  ASSIGNMENT_GRADED = "assignment-graded",
  LESSON_PLAN_UPDATE = "lesson-plan-update",
  SEMESTER_REGISTRATION_UPDATE = "semester-registration-update",
  LIBRARY_NOTICE = "library-notice",
  HOSTEL_ALLOCATION = "hostel-allocation",
  GRIEVANCE_UPDATE = "grievance-update",
  COUNSELING_SCHEDULED = "counseling-scheduled",
  NOTICE_PUBLISHED = "notice-published",
  GENERAL_NOTIFICATION = "general-notification",
  AGREEMENT_VERIFICATION = "agreement-verification",
  AGREEMENT_ACCEPTED = "agreement-accepted",
  PLATFORM_PAYMENT_REQUEST = "platform-payment-request",
  PLATFORM_BILLING_DOCUMENT = "platform-billing-document",
  TENANT_WELCOME = "tenant-welcome",
  APPLICANT_WELCOME = "applicant-welcome",
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, "templates");
const LAYOUTS_DIR = path.join(__dirname, "layouts");

// ─── Handlebars helpers ───────────────────────────────────────────────────────

handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
handlebars.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
handlebars.registerHelper("gt", (a: number, b: number) => a > b);
handlebars.registerHelper("formatDate", formatIndiaDate);
handlebars.registerHelper("formatCurrency", (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n),
);

// ─── Template cache ───────────────────────────────────────────────────────────

const templateCache = new Map<string, handlebars.TemplateDelegate>();

const loadTemplate = (name: string): handlebars.TemplateDelegate => {
  const cached = templateCache.get(name);
  if (cached) return cached;
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`);
  if (!fs.existsSync(filePath)) throw new Error(`Email template not found: ${name}`);
  const src = fs.readFileSync(filePath, "utf-8");
  const compiled = handlebars.compile(src);
  if (configs.NODE_ENV === "production") templateCache.set(name, compiled);
  return compiled;
};

let baseLayout: handlebars.TemplateDelegate | null = null;

const getBaseLayout = (): handlebars.TemplateDelegate => {
  if (baseLayout && configs.NODE_ENV === "production") return baseLayout;
  const layoutPath = path.join(LAYOUTS_DIR, "base.layout.html");
  const src = fs.readFileSync(layoutPath, "utf-8");
  baseLayout = handlebars.compile(src);
  return baseLayout;
};

// ─── Core send function ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ESOCKET",
  "EENVELOPE",
]);
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sanitizeRecipients = (input: string | string[] | undefined): string[] => {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr.map((s) => (s ?? "").trim()).filter((s) => EMAIL_RE.test(s));
};

const buildAttachments = (extra?: EmailAttachment[]): EmailAttachment[] | undefined => {
  const base: EmailAttachment[] = [];
  if (extra?.length) base.push(...extra);
  return base.length ? base : undefined;
};

export const sendEmail = async (opts: SendEmailOptions): Promise<void> => {
  const validTo = sanitizeRecipients(opts.to);
  if (validTo.length === 0) {
    console.warn(
      `[EmailService] Skipped "${opts.subject}" — no valid recipient (got ${JSON.stringify(opts.to)})`,
    );
    if (opts.throwOnFailure) throw new Error("No valid email recipient was provided.");
    return;
  }
  const validCc = sanitizeRecipients(opts.cc);
  const validBcc = sanitizeRecipients(opts.bcc);

  try {
    const tenantContext = tenantLocalStorage.getStore();
    const tenantSmtp = tenantContext ? await tenantIntegrationService.getEnabled("smtp") : null;
    const platformSmtp = await platformIntegrationService.credentials<{
      host: string;
      port: number;
      secure: boolean;
      username: string;
      fromName: string;
      fromEmail: string;
      replyTo?: string;
    }>("smtp");
    if (!tenantSmtp && !platformSmtp)
      throw new Error("Neither tenant nor platform SMTP is configured and ready.");
    const activeTransporter = tenantSmtp
      ? nodemailer.createTransport({
          host: String(tenantSmtp.config.host),
          port: Number(tenantSmtp.config.port),
          secure: Boolean(tenantSmtp.config.secure),
          auth: {
            user: String(tenantSmtp.config.username),
            pass: tenantSmtp.secrets.password,
          },
          pool: true,
          maxConnections: 3,
        })
      : platformSmtp
        ? nodemailer.createTransport({
            host: platformSmtp.config.host,
            port: platformSmtp.config.port,
            secure: platformSmtp.config.secure,
            auth: { user: platformSmtp.config.username, pass: platformSmtp.secret },
            pool: true,
            maxConnections: 5,
          })
        : nodemailer.createTransport({
            host: platformSmtp!.config.host,
            port: platformSmtp!.config.port,
            secure: platformSmtp!.config.secure,
            auth: { user: platformSmtp!.config.username, pass: platformSmtp!.secret },
            pool: true,
            maxConnections: 5,
          });
    interface IEmailSettingsContext {
      instituteName?: string;
      tagline?: string;
      address?: string;
      phone?: string;
      email?: string;
      websiteUrl?: string;
      websiteUrlShort?: string;
      logoUrl?: string;
      accreditations?: string[];
      accreditationsHeader?: string[];
      emailSenderName?: string;
      replyToEmail?: string;
      primaryColor?: string;
      secondaryColor?: string;
      portalUrl?: string;
    }
    let settingsContext: IEmailSettingsContext = {};
    try {
      const { InstitutionSettingModel } = require("../models/institution-setting.model");
      const setting = await InstitutionSettingModel.findOne().lean();
      if (setting) {
        const accs = setting.accreditations || [];
        const accsHeader = [];
        if (accs.length > 0) {
          accsHeader.push(accs.slice(0, 2).join(" | "));
        }
        if (accs.length > 2) {
          accsHeader.push(accs.slice(2).join(" | "));
        }
        const websiteUrlShort = (setting.websiteUrl || "").replace(/https?:\/\/(www\.)?/, "");

        settingsContext = {
          instituteName: setting.name,
          tagline: setting.tagline,
          address: setting.address,
          phone: setting.phone,
          email: setting.email,
          websiteUrl: setting.websiteUrl,
          websiteUrlShort,
          logoUrl: setting.logoUrl,
          accreditations: accs,
          accreditationsHeader: accsHeader,
          emailSenderName: setting.emailSenderName,
          replyToEmail: setting.replyToEmail,
          primaryColor: setting.primaryColor,
          secondaryColor: setting.secondaryColor,
        };
      }
    } catch (err) {
      console.error("[email] Failed to load institution settings", err);
    }

    settingsContext = { ...settingsContext, ...opts.branding };

    const bodyTemplate = loadTemplate(opts.template);
    const bodyHtml = bodyTemplate({
      ...settingsContext,
      ...opts.context,
      year: new Date().getFullYear(),
    });

    const layout = getBaseLayout();
    const finalHtml = layout({
      subject: opts.subject,
      body: bodyHtml,
      year: new Date().getFullYear(),
      primaryColor: settingsContext.primaryColor || "#0178D7",
      secondaryColor: settingsContext.secondaryColor || "#9BB94F",
      ...settingsContext,
    });

    const instName = settingsContext.instituteName || configs.APP_NAME;
    const instTagline = settingsContext.tagline || "Powered by Devvelocity";
    const instEmail = settingsContext.replyToEmail || settingsContext.email;

    const smtpAddress = tenantSmtp
      ? String(tenantSmtp.config.fromEmail)
      : platformSmtp!.config.fromEmail;
    const mailOptions: SendMailOptions = {
      from: {
        name: tenantSmtp
          ? String(tenantSmtp.config.fromName)
          : String(settingsContext.emailSenderName || instName || platformSmtp?.config.fromName),
        address: smtpAddress,
      },
      to: validTo.join(", "),
      cc: validCc.length ? validCc.join(", ") : undefined,
      bcc: validBcc.length ? validBcc.join(", ") : undefined,
      replyTo:
        opts.replyTo ??
        (tenantSmtp
          ? String(tenantSmtp.config.replyTo || smtpAddress)
          : platformSmtp!.config.replyTo || instEmail || smtpAddress),
      subject: `[${instName}] ${opts.subject}`,
      html: finalHtml,
      attachments: buildAttachments(opts.attachments),
      headers: {
        "X-Mailer": `${instName}-ERP v1.0`,
        "X-Organization": instTagline,
        "X-Priority": opts.priority === "high" ? "1" : opts.priority === "low" ? "5" : "3",
      },
    };

    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt < MAX_RETRIES) {
      try {
        await activeTransporter.sendMail(mailOptions);
        return;
      } catch (err) {
        lastErr = err;
        const code = (err as { code?: string })?.code ?? "";
        const isTransient = TRANSIENT_CODES.has(code);
        attempt += 1;
        if (!isTransient || attempt >= MAX_RETRIES) break;
        const backoff = 500 * 2 ** (attempt - 1); // 500, 1000, 2000 ms
        console.warn(
          `[EmailService] Transient error (${code}) sending "${opts.subject}" — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        );
        await sleep(backoff);
      }
    }
    throw lastErr;
  } catch (err) {
    console.error(
      `[EmailService] Failed to send "${opts.subject}" to ${Array.isArray(opts.to) ? opts.to.join(",") : opts.to}:`,
      err,
    );
    if (opts.throwOnFailure) throw err;
  }
};

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const emailService = {
  verifyConnection: async () => {
    try {
      const tenantContext = tenantLocalStorage.getStore();
      const tenantSmtp = tenantContext ? await tenantIntegrationService.getEnabled("smtp") : null;
      const platformSmtp = await platformIntegrationService.credentials<{
        host: string;
        port: number;
        secure: boolean;
        username: string;
      }>("smtp");
      if (!tenantSmtp && !platformSmtp) return false;
      const activeTransporter = tenantSmtp
        ? nodemailer.createTransport({
            host: String(tenantSmtp.config.host),
            port: Number(tenantSmtp.config.port),
            secure: Boolean(tenantSmtp.config.secure),
            auth: {
              user: String(tenantSmtp.config.username),
              pass: tenantSmtp.secrets.password,
            },
          })
        : platformSmtp
          ? nodemailer.createTransport({
              host: platformSmtp.config.host,
              port: platformSmtp.config.port,
              secure: platformSmtp.config.secure,
              auth: { user: platformSmtp.config.username, pass: platformSmtp.secret },
            })
          : nodemailer.createTransport({
              host: platformSmtp!.config.host,
              port: platformSmtp!.config.port,
              secure: platformSmtp!.config.secure,
              auth: { user: platformSmtp!.config.username, pass: platformSmtp!.secret },
            });
      await activeTransporter.verify();
      return true;
    } catch (err) {
      console.error("[EmailService] Connection verification failed:", err);
      return false;
    }
  },

  sendVerifyEmail: (to: string, name: string, otp: string) =>
    sendEmail({
      to,
      subject: "Verify Your Email Address",
      template: EmailTemplate.VERIFY_EMAIL,
      context: { name, otp },
      priority: "high",
    }),

  sendFacultyInvite: (
    to: string,
    ctx: {
      name: string;
      facultyId: string;
      department: string;
      designation: string;
      setupUrl: string;
    },
  ) =>
    sendEmail({
      to,
      subject: `Activate your institution account (${ctx.facultyId})`,
      template: EmailTemplate.FACULTY_INVITE,
      context: { ...ctx, email: to },
      priority: "high",
    }),

  sendPasswordReset: (
    to: string,
    name: string,
    otp: string,
    ipAddress: string,
    portalUrl?: string,
  ) => {
    const origin = portalUrl || resolveRequestAppBaseUrl();
    return sendEmail({
      to,
      subject: "Password Reset Request",
      template: EmailTemplate.RESET_PASSWORD,
      context: {
        name,
        otp,
        email: to,
        ipAddress,
        requestedAt: new Date().toLocaleString("en-IN"),
        resetUrl: `${origin}/login?reset=true`,
        portalUrl: origin,
      },
      branding: { portalUrl: origin },
      priority: "high",
    });
  },

  sendWelcome: (
    to: string,
    name: string,
    userId: string,
    role: string,
    department: string,
    tempPassword: string,
    loginUrl?: string,
  ) => {
    const origin = loginUrl || resolveRequestAppBaseUrl();
    return sendEmail({
      to,
      subject: "Your institution account is ready",
      template: EmailTemplate.WELCOME_USER,
      context: {
        name,
        userId,
        role,
        department,
        email: to,
        tempPassword,
        createdAt: new Date().toLocaleString("en-IN"),
        loginUrl: origin,
      },
      branding: { portalUrl: origin },
    });
  },

  sendAccountInvite: (
    to: string,
    name: string,
    userId: string,
    role: string,
    department: string,
    setupUrl: string,
  ) =>
    sendEmail({
      to,
      subject: "Activate your institution account",
      template: EmailTemplate.ACCOUNT_INVITE,
      context: { name, userId, role, department, email: to, setupUrl },
      branding: { portalUrl: new URL(setupUrl).origin },
      priority: "high",
    }),

  sendApplicantWelcome: (
    to: string,
    name: string,
    userId: string,
    admissionType: string,
    programPreference: string,
    tempPassword: string,
    academicYear: string,
    portalUrl?: string,
  ) =>
    sendEmail({
      to,
      subject: `Admission application initiated (${userId})`,
      template: EmailTemplate.APPLICANT_WELCOME,
      context: {
        name,
        userId,
        admissionType,
        programPreference,
        email: to,
        tempPassword,
        academicYear,
        loginUrl: portalUrl ?? `${configs.FRONTEND_URL}/admission-portal`,
      },
    }),

  sendAdmissionReceived: (to: string, ctx: Record<string, unknown>) =>
    sendEmail({
      to,
      subject: `Admission Application Received — ${ctx["applicationNumber"]}`,
      template: EmailTemplate.ADMISSION_RECEIVED,
      context: ctx,
    }),

  sendAdmissionConfirmed: (
    to: string,
    ctx: Record<string, unknown>,
    attachments?: EmailAttachment[],
  ) =>
    sendEmail({
      to,
      subject: "Admission confirmed",
      template: EmailTemplate.ADMISSION_CONFIRMED,
      context: ctx,
      attachments,
      priority: "high",
    }),

  sendFeePayment: (to: string, ctx: Record<string, unknown>, receiptPdf?: Buffer) =>
    sendEmail({
      to,
      subject: `Fee Payment Confirmation — Receipt ${ctx["receiptNumber"]}`,
      template: EmailTemplate.FEE_PAYMENT,
      context: ctx,
      attachments: receiptPdf
        ? [
            {
              filename: `Fee_Receipt_${ctx["receiptNumber"]}.pdf`,
              content: receiptPdf,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    }),

  sendHallTicket: (to: string, ctx: Record<string, unknown>, hallTicketPdf: Buffer) =>
    sendEmail({
      to,
      subject: `Hall Ticket — Sem ${ctx["semester"]} Examination`,
      template: EmailTemplate.HALL_TICKET,
      context: ctx,
      attachments: [
        {
          filename: `Hall_Ticket_${ctx["rollNumber"]}.pdf`,
          content: hallTicketPdf,
          contentType: "application/pdf",
        },
      ],
      priority: "high",
    }),

  sendResultPublished: (to: string, ctx: Record<string, unknown>, marksheetPdf?: Buffer) =>
    sendEmail({
      to,
      subject: `Result Published — Semester ${ctx["semester"]}`,
      template: EmailTemplate.RESULT_PUBLISHED,
      context: ctx,
      attachments: marksheetPdf
        ? [
            {
              filename: `Marksheet_${ctx["rollNumber"]}_Sem${ctx["semester"]}.pdf`,
              content: marksheetPdf,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    }),

  sendAttendanceAlert: (to: string[], ctx: Record<string, unknown>) =>
    sendEmail({
      to,
      subject: `⚠️ Attendance Alert — ${ctx["studentName"]}`,
      template: EmailTemplate.ATTENDANCE_ALERT,
      context: ctx,
      priority: "high",
    }),

  sendPayslip: (to: string, ctx: Record<string, unknown>) =>
    sendEmail({
      to,
      subject: `Payslip — ${ctx["monthName"]} ${ctx["year"]}`,
      template: EmailTemplate.PAYSLIP,
      context: ctx,
    }),

  /**
   * Generic dispatcher used by `notificationService._dispatchEmail` to route
   * an in-app notification to the matching per-scenario email template.
   */
  sendNotificationEmail: (
    to: string | string[],
    template: EmailTemplate,
    ctx: {
      recipientName?: string;
      title: string;
      body: string;
      actionUrl?: string;
      [key: string]: unknown;
    },
    subjectOverride?: string,
  ) =>
    sendEmail({
      to,
      subject: subjectOverride ?? ctx.title,
      template,
      context: {
        recipientName: ctx.recipientName ?? "User",
        ...ctx,
      },
    }),
};
