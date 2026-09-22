import crypto from "crypto";
import createError from "http-errors";
import { Types } from "mongoose";
import { configs } from "../configs";
import {
  DocumentTemplateModel,
  DocumentTemplateVersionModel,
  IssuedDocumentModel,
  type IDocumentTemplate,
  type ITemplateElement,
  type TDocumentAudience,
} from "../models/document-template.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { GatePassModel } from "../models/gatepass.model";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { nextSeq } from "../models/counter.model";
import { generateHtmlPdf, generateQRBase64 } from "../pdf/pdf.service";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function safeColor(value: string | undefined, fallback: string) {
  return value && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(value) ? value : fallback;
}

function safeImageUrl(value: string | undefined) {
  if (!value) return "";
  if (/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      /^(10\.|127\.|169\.254\.|192\.168\.)/.test(host)
    )
      return "";
    return url.toString();
  } catch {
    return "";
  }
}

function replaceTokens(value: string | undefined, data: Record<string, unknown>) {
  return String(value ?? "").replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_match, path: string) => {
    const resolved = path
      .split(".")
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[part]
            : undefined,
        data,
      );
    return escapeHtml(resolved);
  });
}

function elementHtml(element: ITemplateElement, data: Record<string, unknown>) {
  const style = [
    "position:absolute",
    `left:${Math.max(element.x, 0)}mm`,
    `top:${Math.max(element.y, 0)}mm`,
    `width:${Math.max(element.width, 1)}mm`,
    `height:${Math.max(element.height, 1)}mm`,
    `font-size:${Math.min(Math.max(element.fontSize ?? 12, 6), 96)}pt`,
    `font-weight:${element.fontWeight === "bold" ? "700" : "400"}`,
    `text-align:${element.align ?? "left"}`,
    `color:${safeColor(element.color, "#111827")}`,
    `background:${safeColor(element.backgroundColor, "transparent")}`,
    `border-radius:${Math.min(Math.max(element.borderRadius ?? 0, 0), 100)}px`,
    `transform:rotate(${Math.min(Math.max(element.rotation ?? 0, -360), 360)}deg)`,
    `opacity:${Math.min(Math.max(element.opacity ?? 1, 0.1), 1)}`,
    "overflow:hidden",
    "box-sizing:border-box",
  ].join(";");
  if (element.type === "line")
    return `<div style="${style};height:1px;background:${safeColor(element.color, "#111827")}"></div>`;
  if (element.type === "image" || element.type === "qr") {
    const source = safeImageUrl(replaceTokens(element.source, data));
    return source
      ? `<img alt="" src="${escapeHtml(source)}" style="${style};object-fit:contain"/>`
      : "";
  }
  return `<div style="${style};display:flex;align-items:center">${replaceTokens(element.content, data)}</div>`;
}

async function subjectData(audience: TDocumentAudience, id: string) {
  if (!Types.ObjectId.isValid(id)) throw createError(400, "Invalid subject identifier");
  const doc =
    audience === "student"
      ? await StudentProfileModel.findOne({ $or: [{ _id: id }, { userId: id }] }).lean()
      : audience === "faculty"
        ? await FacultyProfileModel.findOne({ $or: [{ _id: id }, { userId: id }] }).lean()
        : await GatePassModel.findById(id).lean();
  if (!doc) throw createError(404, "Document subject not found");
  return doc as unknown as Record<string, unknown>;
}

export const documentTemplateService = {
  metadata: () => ({
    audiences: {
      student: [
        "firstName",
        "lastName",
        "rollNumber",
        "registrationNumber",
        "collegeEmail",
        "phone",
        "program",
        "batch",
        "academicYear",
        "currentSemester",
        "photoUrl",
      ],
      faculty: [
        "firstName",
        "lastName",
        "employeeId",
        "collegeEmail",
        "phone",
        "designation",
        "joiningDate",
        "photoUrl",
      ],
      visitor: [
        "visitorName",
        "visitorPhone",
        "passNumber",
        "purpose",
        "checkInTime",
        "vehicleNumber",
      ],
    },
    institution: ["name", "shortCode", "address", "phone", "email", "websiteUrl", "logoUrl"],
  }),
  list: () => DocumentTemplateModel.find({ isActive: true }).sort({ updatedAt: -1 }).lean(),
  versions: (templateId: string) =>
    DocumentTemplateVersionModel.find({ templateId })
      .select("-snapshot")
      .sort({ version: -1 })
      .lean(),
  issued: () =>
    IssuedDocumentModel.find()
      .select("-snapshot -templateSnapshot")
      .populate("templateId", "name kind audience")
      .sort({ issuedAt: -1 })
      .limit(500)
      .lean(),
  save: async (data: Partial<IDocumentTemplate>, userId: string, id?: string) => {
    if (!data.name || !data.kind || !data.audience || !data.page)
      throw createError(400, "Template name, kind, audience and page are required");
    if ((data.elements?.length ?? 0) > 100)
      throw createError(400, "A template supports at most 100 elements");
    if (id) {
      const current = await DocumentTemplateModel.findById(id).lean();
      if (!current) throw createError(404, "Template not found");
      if ((current.status ?? "draft") !== "draft")
        throw createError(409, "Only draft templates can be edited. Create a revision first.");
      return DocumentTemplateModel.findByIdAndUpdate(
        id,
        {
          $set: {
            ...data,
            status: "draft",
          },
        },
        { returnDocument: "after", runValidators: true },
      ).lean();
    }
    return DocumentTemplateModel.create({ ...data, status: "draft", createdBy: userId });
  },
  submit: async (id: string, userId: string) => {
    const row = await DocumentTemplateModel.findOneAndUpdate(
      { _id: id, status: { $in: ["draft", null] } },
      { $set: { status: "pending_approval", submittedBy: userId, submittedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only a draft template can be submitted");
    return row;
  },
  approve: async (id: string, userId: string) => {
    const current = await DocumentTemplateModel.findOne({
      _id: id,
      status: "pending_approval",
    }).lean();
    if (!current) throw createError(409, "Only a submitted template can be approved");
    if (String(current.submittedBy) === userId)
      throw createError(409, "Template approval requires an independent reviewer");
    return DocumentTemplateModel.findByIdAndUpdate(
      id,
      { $set: { status: "approved", approvedBy: userId, approvedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
  },
  publish: async (id: string, userId: string) => {
    const current = await DocumentTemplateModel.findOne({ _id: id, status: "approved" }).lean();
    if (!current) throw createError(409, "Only an approved template can be published");
    const nextVersion = current.publishedAt ? current.version + 1 : current.version;
    const snapshot = {
      name: current.name,
      description: current.description,
      category: current.category,
      tags: current.tags,
      kind: current.kind,
      audience: current.audience,
      page: current.page,
      backgroundUrl: current.backgroundUrl,
      elements: current.elements,
    };
    const snapshotHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    await DocumentTemplateVersionModel.create({
      templateId: current._id,
      version: nextVersion,
      snapshot,
      snapshotHash,
      createdBy: userId,
    });
    return DocumentTemplateModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "published",
          version: nextVersion,
          publishedBy: userId,
          publishedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();
  },
  revise: async (id: string) => {
    const row = await DocumentTemplateModel.findOneAndUpdate(
      { _id: id, status: "published" },
      {
        $set: { status: "draft" },
        $unset: {
          submittedBy: 1,
          submittedAt: 1,
          approvedBy: 1,
          approvedAt: 1,
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only a published template can start a new revision");
    return row;
  },
  retire: async (id: string, userId: string) => {
    const row = await DocumentTemplateModel.findOneAndUpdate(
      { _id: id, status: "published" },
      { $set: { status: "retired", retiredBy: userId, retiredAt: new Date(), isActive: false } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only a published template can be retired");
    return row;
  },
  issue: async (templateId: string, subjectId: string, userId: string) => {
    const template = await DocumentTemplateModel.findOne({
      _id: templateId,
      isActive: true,
      status: "published",
    }).lean();
    if (!template) throw createError(404, "Active template not found");
    const [subject, institution] = await Promise.all([
      subjectData(template.audience, subjectId),
      InstitutionSettingModel.findOne().lean(),
    ]);
    const sequence = await nextSeq(`issued-document-${new Date().getFullYear()}`);
    const documentNumber = `DOC-${new Date().getFullYear()}-${String(sequence).padStart(7, "0")}`;
    const verificationCode = crypto.randomBytes(16).toString("hex");
    const verificationUrl = `${configs.FRONTEND_URL}/verify/document/${verificationCode}`;
    const qrCode = await generateQRBase64(verificationUrl);
    const data = {
      subject,
      institution: institution ?? {},
      document: {
        number: documentNumber,
        verificationCode,
        verificationUrl,
        issuedAt: new Date().toISOString(),
        qrCode,
      },
    };
    const elements = template.elements.map((element) =>
      element.type === "qr" ? { ...element, source: qrCode } : element,
    );
    const background = safeImageUrl(template.backgroundUrl);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${template.page.widthMm}mm ${template.page.heightMm}mm;margin:0}body{margin:0;font-family:Arial,sans-serif}.page{position:relative;width:${template.page.widthMm}mm;height:${template.page.heightMm}mm;background:${background ? `url('${background}') center/cover no-repeat` : "white"}}</style></head><body><div class="page">${elements.map((element) => elementHtml(element, data)).join("")}</div></body></html>`;
    const templateSnapshot = {
      name: template.name,
      kind: template.kind,
      audience: template.audience,
      page: template.page,
      backgroundUrl: template.backgroundUrl,
      elements: template.elements,
      version: template.version,
    };
    const templateHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(templateSnapshot))
      .digest("hex");
    const pdf = await generateHtmlPdf(html, {
      width: `${template.page.widthMm}mm`,
      height: `${template.page.heightMm}mm`,
    });
    const issued = await IssuedDocumentModel.create({
      templateId: template._id,
      templateVersion: template.version,
      subjectType: template.audience,
      subjectId,
      documentNumber,
      verificationCode,
      snapshot: data,
      templateSnapshot,
      templateHash,
      pdfHash: crypto.createHash("sha256").update(pdf).digest("hex"),
      issuedBy: userId,
      issuedAt: new Date(),
    });
    return {
      issued,
      pdf,
    };
  },
  verify: (code: string) =>
    IssuedDocumentModel.findOne({ verificationCode: code })
      .populate("templateId", "name kind audience")
      .lean(),
  revoke: async (id: string, reason: string) => {
    if (reason.trim().length < 5) throw createError(400, "A revocation reason is required");
    const row = await IssuedDocumentModel.findOneAndUpdate(
      { _id: id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revocationReason: reason.trim() } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Document was not found or is already revoked");
    return row;
  },
};
