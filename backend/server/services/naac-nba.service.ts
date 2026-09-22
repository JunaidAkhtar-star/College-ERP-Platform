import createError from "http-errors";
import { naacNbaRepository } from "../repositories/naac-nba.repository";
import type { INaacEvidence, INbaReport } from "../models/naac-nba.model";
import { CurriculumModel } from "../models/curriculum.model";
import { DepartmentModel } from "../models/department.model";

const evidenceEditable = new Set([
  "criterion",
  "metricNo",
  "title",
  "description",
  "evidenceFiles",
  "academicYear",
]);

export function normalizeNaacEvidence(data: Record<string, unknown>) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([key]) => evidenceEditable.has(key)),
  );
  clean.title = String(clean.title ?? "").trim();
  clean.metricNo = String(clean.metricNo ?? "").trim();
  clean.academicYear = String(clean.academicYear ?? "").trim();
  if (!/^[1-7](?:\.\d+){1,3}$/.test(String(clean.metricNo)))
    throw createError(400, "Metric number must belong to the selected NAAC criterion");
  if (!String(clean.metricNo).startsWith(`${clean.criterion}.`))
    throw createError(400, "Metric number does not match the selected criterion");
  if (String(clean.title).length < 3 || String(clean.title).length > 300)
    throw createError(400, "Evidence title must be 3-300 characters");
  if (!/^\d{4}-\d{2}$/.test(String(clean.academicYear)))
    throw createError(400, "Academic year must use YYYY-YY format");
  const files = Array.isArray(clean.evidenceFiles)
    ? (clean.evidenceFiles as Array<Record<string, unknown>>)
    : [];
  clean.evidenceFiles = files.map((file) => {
    const url = String(file.url ?? "").trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      throw createError(400, "Evidence files require valid HTTPS URLs");
    }
    return {
      url,
      name: String(file.name ?? "")
        .trim()
        .slice(0, 255),
    };
  });
  return clean;
}

const reportEditable = new Set([
  "programId",
  "program",
  "departmentId",
  "academicYear",
  "semester",
  "coAttainments",
  "poAttainments",
  "psoAttainments",
  "reportUrl",
]);

export function normalizeNbaReport(data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => reportEditable.has(key)));
  const po = Array.isArray(clean.poAttainments)
    ? (clean.poAttainments as INbaReport["poAttainments"])
    : [];
  if (!po.length) throw createError(400, "At least one PO attainment is required");
  for (const item of po) {
    if (
      !item.poCode?.trim() ||
      !item.poStatement?.trim() ||
      item.attainmentLevel < 0 ||
      item.attainmentLevel > 100
    )
      throw createError(400, "PO attainment values must be between 0 and 100");
  }
  const co = Array.isArray(clean.coAttainments)
    ? (clean.coAttainments as INbaReport["coAttainments"])
    : [];
  if (!co.length) throw createError(400, "At least one CO attainment is required");
  for (const item of co) {
    if (
      !item.courseCode?.trim() ||
      !item.courseName?.trim() ||
      !item.coCode?.trim() ||
      !item.coStatement?.trim() ||
      [item.directAttainment, item.indirectAttainment].some((value) => value < 0 || value > 100)
    )
      throw createError(400, "CO attainment values must be between 0 and 100");
  }
  clean.coAttainments = co.map((item) => {
    const finalAttainment = item.directAttainment * 0.8 + item.indirectAttainment * 0.2;
    return {
      ...item,
      finalAttainment,
      attainmentLevel: finalAttainment >= 70 ? 3 : finalAttainment >= 60 ? 2 : 1,
    };
  });
  clean.thresholdMet = po.every((item) => item.attainmentLevel >= 60);
  return clean;
}

export const naacNbaService = {
  // ─── NAAC Evidence ────────────────────────────────────────────────────────

  createEvidence: (data: Record<string, unknown>) =>
    naacNbaRepository.createEvidence({
      ...normalizeNaacEvidence(data),
      submittedBy: data.submittedBy,
      status: "draft",
    }),

  getEvidence: async (id: string) => {
    const ev = await naacNbaRepository.findEvidenceById(id);
    if (!ev) throw createError(404, "Evidence not found");
    return ev;
  },

  listEvidence: (filter: Record<string, unknown>, page: number, limit: number) =>
    naacNbaRepository.listEvidence(filter, page, limit),

  updateEvidence: async (id: string, data: Record<string, unknown>, userId: string) => {
    const ev = await naacNbaRepository.findEvidenceById(id);
    if (!ev) throw createError(404, "Evidence not found");
    if (String(ev.submittedBy) !== userId)
      throw createError(403, "Only the owner can edit evidence");
    if (!["draft", "revision_requested"].includes(ev.status))
      throw createError(409, "Submitted or approved evidence is immutable");
    return naacNbaRepository.updateEvidence(id, normalizeNaacEvidence({ ...ev, ...data }));
  },

  reviewEvidence: async (
    id: string,
    status: string,
    reviewedBy: string,
    reviewNotes?: string,
    score?: number,
  ) => {
    const ev = await naacNbaRepository.findEvidenceById(id);
    if (!ev) throw createError(404, "Evidence not found");
    if (!["approved", "revision_requested"].includes(status))
      throw createError(400, "Invalid review status");
    if (String(ev.submittedBy) === reviewedBy)
      throw createError(409, "Evidence requires an independent reviewer");
    const updated = await naacNbaRepository.updateEvidenceWhen(
      { _id: id, status: "submitted" },
      {
        status,
        reviewedBy,
        reviewNotes,
        score,
        updatedAt: new Date(),
      },
    );
    if (!updated) throw createError(409, "Only submitted evidence can be reviewed");
    return updated;
  },

  submitEvidence: async (id: string, userId: string) => {
    const ev = await naacNbaRepository.findEvidenceById(id);
    if (!ev) throw createError(404, "Evidence not found");
    if (String(ev.submittedBy) !== userId)
      throw createError(403, "Only the owner can submit evidence");
    if (!(ev as unknown as INaacEvidence).evidenceFiles.length)
      throw createError(400, "At least one evidence file is required");
    const updated = await naacNbaRepository.updateEvidenceWhen(
      { _id: id, status: { $in: ["draft", "revision_requested"] } },
      { status: "submitted", reviewedBy: null, reviewNotes: null, score: null },
    );
    if (!updated) throw createError(409, "Evidence cannot be submitted in its current state");
    return updated;
  },

  criterionSummary: (academicYear: string) => naacNbaRepository.criterionSummary(academicYear),

  // ─── NBA Reports ──────────────────────────────────────────────────────────

  createReport: async (data: Record<string, unknown>) => {
    const programId = String(data.programId ?? "");
    const departmentId = String(data.departmentId ?? "");
    const [curriculum, department] = await Promise.all([
      CurriculumModel.findOne({ _id: programId, isActive: true }).lean(),
      DepartmentModel.findOne({ _id: departmentId, curriculumIds: programId }).lean(),
    ]);
    if (!curriculum || !department)
      throw createError(400, "Active program must belong to the selected department");
    if (curriculum.program !== String(data.program).trim())
      throw createError(400, "Program label does not match the selected program");
    return naacNbaRepository.createReport({
      ...normalizeNbaReport(data),
      generatedBy: data.generatedBy,
      status: "draft",
    });
  },

  getReport: async (id: string) => {
    const r = await naacNbaRepository.findReportById(id);
    if (!r) throw createError(404, "NBA report not found");
    return r;
  },

  listReports: (filter: Record<string, unknown>, page: number, limit: number) =>
    naacNbaRepository.listReports(filter, page, limit),

  approveReport: async (id: string, approvedBy: string, approvalComments?: string) => {
    const r = await naacNbaRepository.findReportById(id);
    if (!r) throw createError(404, "NBA report not found");
    if (r.status !== "draft") throw createError(409, "Only draft reports can be approved");
    if (String(r.generatedBy) === approvedBy)
      throw createError(409, "NBA reports require an independent approver");
    const updated = await naacNbaRepository.updateReportWhen(
      { _id: id, status: "draft", generatedBy: { $ne: approvedBy } },
      { status: "approved", approvedBy, approvedAt: new Date(), approvalComments },
    );
    if (!updated) throw createError(409, "Report could not be approved");
    return updated;
  },

  updateReport: async (id: string, data: Record<string, unknown>) => {
    const r = await naacNbaRepository.findReportById(id);
    if (!r) throw createError(404, "NBA report not found");
    if (r.status !== "draft") throw createError(409, "Approved reports are immutable");
    const programId = String(data.programId ?? "");
    const departmentId = String(data.departmentId ?? "");
    const [curriculum, department] = await Promise.all([
      CurriculumModel.findOne({ _id: programId, isActive: true }).lean(),
      DepartmentModel.findOne({ _id: departmentId, curriculumIds: programId }).lean(),
    ]);
    if (!curriculum || !department)
      throw createError(400, "Active program must belong to the selected department");
    if (curriculum.program !== String(data.program).trim())
      throw createError(400, "Program label does not match the selected program");
    return naacNbaRepository.updateReport(id, normalizeNbaReport({ ...r, ...data }));
  },

  poDepartmentSummary: (departmentId: string, academicYear: string) =>
    naacNbaRepository.poDepartmentSummary(departmentId, academicYear),
};
