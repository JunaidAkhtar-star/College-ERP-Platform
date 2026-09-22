import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { inflate } from "@sparticuz/chromium";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import os from "os";
import QRCode from "qrcode";
import { configs } from "../configs";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { PublicSiteConfigModel } from "../models/platform.model";
import { formatIndiaDate } from "../utils/date.util";

// ─── Types ────────────────────────────────────────────────────────────────────

export enum PdfTemplate {
  FEE_RECEIPT = "fee-receipt",
  FEE_INVOICE = "fee-invoice",
  HALL_TICKET = "hall-ticket",
  MARKSHEET = "marksheet",
  SEATING_PLAN = "seating-plan",
  BONAFIDE = "bonafide-certificate",
  TRANSFER_CERT = "transfer-certificate",
  CONDUCT_CERT = "conduct-certificate",
  ADMISSION_LETTER = "admission-letter",
  ID_CARD = "id-card",
  SALARY_SLIP = "salary-slip",
  EXPERIENCE_LETTER = "experience-letter",
  APPOINTMENT_LETTER = "appointment-letter",
  PLATFORM_INVOICE = "platform-invoice",
}

export interface PdfGenerateOptions {
  template: PdfTemplate;
  context: Record<string, unknown>;
  filename?: string;
}

// ─── Handlebars helpers ───────────────────────────────────────────────────────

handlebars.registerHelper("multiply", (a: number, b: number) => (a * b).toFixed(2));
handlebars.registerHelper("formatINR", (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n),
);
handlebars.registerHelper("formatDate", formatIndiaDate);
const integerWords = (value: number): string => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (value < 20) return ones[value];
  if (value < 100)
    return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
  if (value < 1_000)
    return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${integerWords(value % 100)}` : ""}`;
  if (value < 1_00_000)
    return `${integerWords(Math.floor(value / 1_000))} Thousand${value % 1_000 ? ` ${integerWords(value % 1_000)}` : ""}`;
  if (value < 1_00_00_000)
    return `${integerWords(Math.floor(value / 1_00_000))} Lakh${value % 1_00_000 ? ` ${integerWords(value % 1_00_000)}` : ""}`;
  return `${integerWords(Math.floor(value / 1_00_00_000))} Crore${value % 1_00_00_000 ? ` ${integerWords(value % 1_00_00_000)}` : ""}`;
};
handlebars.registerHelper("amountInWords", (amount: number) => {
  const rupees = Math.floor(Number(amount) || 0);
  const paise = Math.round(((Number(amount) || 0) - rupees) * 100);
  return `${integerWords(rupees) || "Zero"} Rupees${paise ? ` and ${integerWords(paise)} Paise` : ""} Only`;
});
handlebars.registerHelper("upper", (s: string) => (s || "").toUpperCase());
handlebars.registerHelper("year", () => new Date().getFullYear());
handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
handlebars.registerHelper(
  "ifCond",
  function (this: unknown, v1: unknown, v2: unknown, opts: handlebars.HelperOptions) {
    return v1 === v2 ? opts.fn(this) : opts.inverse(this);
  },
);

// ─── Template helpers ─────────────────────────────────────────────────────────

const PDF_TEMPLATES_DIR = path.join(__dirname, "templates");
const pdfTemplateCache = new Map<string, handlebars.TemplateDelegate>();

const loadPdfTemplate = (name: string): handlebars.TemplateDelegate => {
  if (pdfTemplateCache.has(name) && configs.NODE_ENV === "production")
    return pdfTemplateCache.get(name)!;
  const filePath = path.join(PDF_TEMPLATES_DIR, `${name}.html`);
  if (!fs.existsSync(filePath)) throw new Error(`PDF template not found: ${name}`);
  const src = fs.readFileSync(filePath, "utf-8");
  const compiled = handlebars.compile(src);
  pdfTemplateCache.set(name, compiled);
  return compiled;
};

// ─── QR helper ────────────────────────────────────────────────────────────────

export const generateQRBase64 = async (data: string): Promise<string> => {
  return await QRCode.toDataURL(data, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 200,
    color: { dark: "#1a237e", light: "#ffffff" },
  });
};

// ─── Browser launcher ─────────────────────────────────────────────────────────

let serverlessChromiumRuntime: Promise<void> | null = null;

const ensureServerlessChromiumRuntime = async () => {
  if (process.platform !== "linux") return;
  if (!serverlessChromiumRuntime) {
    serverlessChromiumRuntime = (async () => {
      const libraryRoot = path.join(os.tmpdir(), "al2023", "lib");
      const requiredLibrary = path.join(libraryRoot, "libnspr4.so");
      if (!fs.existsSync(requiredLibrary)) {
        const archive = path.resolve(
          process.cwd(),
          "node_modules",
          "@sparticuz",
          "chromium",
          "bin",
          "al2023.tar.br",
        );
        if (!fs.existsSync(archive)) {
          throw new Error(
            "Bundled Chromium libraries are unavailable. Ensure @sparticuz/chromium is installed as a production dependency.",
          );
        }
        await inflate(archive);
      }
      process.env["FONTCONFIG_PATH"] ??= path.join(os.tmpdir(), "fonts");
      const currentLibraryPath = process.env["LD_LIBRARY_PATH"] ?? "";
      if (!currentLibraryPath.split(":").includes(libraryRoot)) {
        process.env["LD_LIBRARY_PATH"] = [libraryRoot, currentLibraryPath]
          .filter(Boolean)
          .join(":");
      }
    })().catch((error) => {
      serverlessChromiumRuntime = null;
      throw error;
    });
  }
  await serverlessChromiumRuntime;
};

const launchBrowser = async () => {
  if (configs.NODE_ENV === "production") {
    await ensureServerlessChromiumRuntime();
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  // Local dev: use system Chrome or Chromium
  const execPath =
    configs.PUPPETEER_EXEC_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteerCore.launch({
    headless: true,
    executablePath: execPath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
};

export const generateHtmlPdf = async (
  html: string,
  options?: {
    width?: string;
    height?: string;
    landscape?: boolean;
    margin?: { top: string; bottom: string; left: string; right: string };
  },
): Promise<Buffer> => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      ...(options?.width && options.height
        ? { width: options.width, height: options.height }
        : { format: "A4" as const }),
      landscape: options?.landscape ?? false,
      printBackground: true,
      margin: options?.margin ?? { top: "0", bottom: "0", left: "0", right: "0" },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};

// ─── Core PDF generator ───────────────────────────────────────────────────────

export const generatePdf = async (opts: PdfGenerateOptions): Promise<Buffer> => {
  const template = loadPdfTemplate(opts.template);
  const setting = await InstitutionSettingModel.findOne().lean();
  const html = template({
    institutionName: setting?.name || "Institution setup required",
    institutionShortCode: setting?.shortCode || "Institution",
    institutionTagline: setting?.tagline || "",
    institutionAddress: setting?.address || "",
    institutionPhone: setting?.phone || "",
    institutionEmail: setting?.email || "",
    institutionWebsite: setting?.websiteUrl || "",
    institutionLogoUrl: setting?.logoUrl || "",
    ...opts.context,
    generatedAt: new Date().toLocaleString("en-IN"),
    year: new Date().getFullYear(),
  });

  return generateHtmlPdf(html, {
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });
};

// ─── Convenience generators ───────────────────────────────────────────────────

const platformLogoDataUri = () => {
  const logoPath = path.resolve(process.cwd(), "public", "devvelocitylogo.webp");
  return fs.existsSync(logoPath)
    ? `data:image/webp;base64,${fs.readFileSync(logoPath).toString("base64")}`
    : undefined;
};

export const pdfService = {
  generatePlatformInvoice: async (data: Record<string, unknown>): Promise<Buffer> => {
    const profile = await PublicSiteConfigModel.findOne().lean();
    return generatePdf({
      template: PdfTemplate.PLATFORM_INVOICE,
      context: {
        institutionName: profile?.companyName || "Devvelocity",
        institutionShortCode: "Devvelocity",
        platformLogoDataUri: platformLogoDataUri(),
        issuerAddress: profile?.address,
        issuerEmail: profile?.supportEmail,
        issuerPhone: profile?.phone,
        ...data,
      },
    });
  },
  /** Fee Receipt — issued after payment */
  generateFeeReceipt: async (data: {
    receiptNumber: string;
    studentName: string;
    fatherName: string;
    rollNumber: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    feeItems: Array<{ description: string; amount: number }>;
    totalAmount: number;
    paymentMode: string;
    transactionId: string;
    paymentDate: string;
    collectedBy: string;
  }): Promise<Buffer> => {
    const qr = await generateQRBase64(
      `ERP-RECEIPT:${data.receiptNumber}:${data.rollNumber}:${data.totalAmount}`,
    );
    return generatePdf({ template: PdfTemplate.FEE_RECEIPT, context: { ...data, qrCode: qr } });
  },

  /** Fee Invoice — proforma / demand letter */
  generateFeeInvoice: async (data: {
    invoiceNumber: string;
    studentName: string;
    fatherName: string;
    rollNumber: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    feeItems: Array<{
      description: string;
      amount: number;
      discount?: number;
      concession?: number;
    }>;
    totalDue: number;
    dueDate: string;
    scholarshipDeduction?: number;
    paidAmount?: number;
    balanceDue?: number;
  }): Promise<Buffer> => {
    const qr = await generateQRBase64(`ERP-INV:${data.invoiceNumber}:${data.rollNumber}`);
    return generatePdf({ template: PdfTemplate.FEE_INVOICE, context: { ...data, qrCode: qr } });
  },

  /** Hall Ticket */
  generateHallTicket: async (data: {
    hallTicketNumber: string;
    studentName: string;
    fatherName: string;
    rollNumber: string;
    enrollmentNumber: string;
    bputExamRoll: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    examType: string;
    examCentre: string;
    subjects: Array<{ code: string; name: string; date: string; time: string; duration: string }>;
    photoUrl?: string;
  }): Promise<Buffer> => {
    const qr = await generateQRBase64(
      `ERP-HT:${data.hallTicketNumber}:${data.rollNumber}:${data.semester}`,
    );
    return generatePdf({ template: PdfTemplate.HALL_TICKET, context: { ...data, qrCode: qr } });
  },

  /** Bonafide Certificate */
  generateBonafide: async (data: {
    certificateNumber: string;
    studentName: string;
    fatherName: string;
    rollNumber: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    dateOfAdmission: string;
    purpose: string;
    issuedBy: string;
    designation: string;
    issuedDate: string;
  }): Promise<Buffer> => {
    const certId = `ERP-BON-${data.certificateNumber}`;
    const qr = await generateQRBase64(`${configs.FRONTEND_URL}/verify/${certId}`);
    return generatePdf({
      template: PdfTemplate.BONAFIDE,
      context: { ...data, certId, qrCode: qr },
    });
  },

  /** Transfer Certificate */
  generateTransferCertificate: async (data: {
    tcNumber: string;
    studentName: string;
    fatherName: string;
    motherName: string;
    rollNumber: string;
    enrollmentNumber: string;
    program: string;
    branch: string;
    dateOfAdmission: string;
    dateOfLeaving: string;
    semesterCompleted: number;
    cgpa: number;
    conductCharacter: string;
    reasonForLeaving: string;
    issuedBy: string;
    issuedDate: string;
  }): Promise<Buffer> => {
    const certId = `ERP-TC-${data.tcNumber}`;
    const qr = await generateQRBase64(`${configs.FRONTEND_URL}/verify/${certId}`);
    return generatePdf({
      template: PdfTemplate.TRANSFER_CERT,
      context: { ...data, certId, qrCode: qr },
    });
  },

  /** Salary Slip */
  generateSalarySlip: async (data: {
    slipNumber: string;
    employeeId: string;
    employeeName: string;
    designation: string;
    department: string;
    month: string;
    year: number;
    earnings: Array<{ component: string; amount: number }>;
    deductions: Array<{ component: string; amount: number }>;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    bankAccount: string;
    pfAccount: string;
    paidDays: number;
    lopDays: number;
  }): Promise<Buffer> => {
    return generatePdf({ template: PdfTemplate.SALARY_SLIP, context: data });
  },

  /** Experience Letter */
  generateExperienceLetter: async (data: {
    letterNumber: string;
    employeeName: string;
    employeeId: string;
    designation: string;
    department: string;
    dateOfJoining: string;
    dateOfRelieving: string;
    issuedDate: string;
    issuedBy: string;
    principalName: string;
  }): Promise<Buffer> => {
    const certId = `ERP-EXP-${data.letterNumber}`;
    const qr = await generateQRBase64(`${configs.FRONTEND_URL}/verify/${certId}`);
    return generatePdf({
      template: PdfTemplate.EXPERIENCE_LETTER,
      context: { ...data, certId, qrCode: qr },
    });
  },

  /** Seating Plan (SRS §8.3) */
  generateSeatingPlan: async (data: {
    collegeName: string;
    examTitle: string;
    examType: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    totalStudents: number;
    generatedBy: string;
    generatedOn: string;
    seatingMap: Array<{
      hall: string;
      seatNumber: number;
      rollNumber: string;
      studentName: string;
    }>;
  }): Promise<Buffer> => {
    return generatePdf({ template: PdfTemplate.SEATING_PLAN, context: data });
  },

  /** Appointment Letter */
  generateAppointmentLetter: async (data: {
    letterNumber: string;
    employeeName: string;
    designation: string;
    department: string;
    reportingDate: string;
    salary: number;
    issuedDate: string;
    principalName: string;
    hrName: string;
  }): Promise<Buffer> => {
    return generatePdf({ template: PdfTemplate.APPOINTMENT_LETTER, context: data });
  },

  // ── Digital Marksheet & Transcript ─────────────────────────────────────────

  /** Semester Marksheet — individual semester result PDF */
  generateMarksheet: async (data: {
    studentName: string;
    fatherName: string;
    motherName?: string;
    rollNumber: string;
    enrollmentNumber: string;
    bputExamRoll: string;
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    examType: string;
    subjectResults: Array<{
      subjectCode: string;
      subjectName: string;
      credits: number;
      internalMarks: number;
      externalMarks: number;
      totalMarks: number;
      totalMax: number;
      gradePoint: number;
      gradeLetter: string;
      creditPoints: number;
      isPassed: boolean;
    }>;
    totalCreditsRegistered: number;
    totalCreditsEarned: number;
    totalCreditPoints: number;
    sgpa: number;
    cgpa: number;
    backlogs: number;
    backSubjects?: string[];
    result: string;
    rank?: number;
    photoUrl?: string;
    issuedDate?: string;
  }): Promise<Buffer> => {
    const verificationId = `ERP-MS-${data.rollNumber}-S${data.semester}-${data.academicYear.replace("-", "")}`;
    const qr = await generateQRBase64(`${configs.FRONTEND_URL}/verify/${verificationId}`);
    return generatePdf({
      template: PdfTemplate.MARKSHEET,
      context: {
        ...data,
        verificationId,
        qrCode: qr,
        issuedDate: data.issuedDate ?? formatIndiaDate(new Date()),
        backSubjectsList: (data.backSubjects ?? []).join(", ") || "Nil",
      },
    });
  },

  /** Consolidated Transcript — all semesters, full academic record */
  generateTranscript: async (data: {
    studentName: string;
    fatherName: string;
    motherName?: string;
    rollNumber: string;
    enrollmentNumber: string;
    bputExamRoll: string;
    program: string;
    branch: string;
    dateOfAdmission: string;
    semesterResults: Array<{
      semester: number;
      academicYear: string;
      totalCreditsRegistered: number;
      totalCreditsEarned: number;
      sgpa: number;
      result: string;
    }>;
    finalCgpa: number;
    totalCreditsEarned: number;
    photoUrl?: string;
    issuedDate?: string;
  }): Promise<Buffer> => {
    const verificationId = `ERP-TX-${data.rollNumber}-${Date.now().toString(36).toUpperCase()}`;
    const qr = await generateQRBase64(`${configs.FRONTEND_URL}/verify/${verificationId}`);
    return generatePdf({
      template: PdfTemplate.MARKSHEET, // Reuses marksheet template with transcriptMode flag
      context: {
        ...data,
        transcriptMode: true,
        verificationId,
        qrCode: qr,
        issuedDate: data.issuedDate ?? formatIndiaDate(new Date()),
      },
    });
  },
};
