import createError from "http-errors";
import { createHash, randomUUID } from "crypto";
import { AlumniModel } from "../models/alumni.model";
import { AttendanceRecordModel } from "../models/attendance.model";
import { AuditLogModel } from "../models/audit-log.model";
import {
  DataExportJobModel,
  DataExportArtifactChunkModel,
  DataLegalHoldModel,
  DataSubjectRequestModel,
} from "../models/data-portability.model";
import { SemesterResultModel } from "../models/examination.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { FeeRecordModel } from "../models/fee.model";
import { NoticeModel } from "../models/notice.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { nextSeq } from "../models/counter.model";
import { cryptoUtil } from "../utils/crypto.util";
import { jobQueueService } from "./job-queue.service";

interface IExportFilters {
  from?: string;
  to?: string;
  academicYear?: string;
}
interface IDatasetAdapter {
  key: string;
  label: string;
  description: string;
  fields: string[];
  count: (filter: Record<string, unknown>) => Promise<number>;
  rows: (filter: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>;
  filter: (filters: IExportFilters) => Record<string, unknown>;
}
const dates = (filters: IExportFilters, field: string) => {
  const range: Record<string, Date> = {};
  if (filters.from) range["$gte"] = new Date(filters.from);
  if (filters.to) range["$lte"] = new Date(filters.to);
  return Object.keys(range).length ? { [field]: range } : {};
};
const academic = (filters: IExportFilters) =>
  filters.academicYear ? { academicYear: filters.academicYear } : {};

const adapters: IDatasetAdapter[] = [
  {
    key: "students",
    label: "Student profiles",
    description: "Core student identity, academic and contact records",
    fields: [
      "userId",
      "studentId",
      "rollNumber",
      "registrationNumber",
      "firstName",
      "lastName",
      "collegeEmail",
      "phone",
      "program",
      "branch",
      "batch",
      "currentSemester",
      "academicYear",
      "status",
    ],
    count: (filter) => StudentProfileModel.countDocuments(filter),
    rows: (filter) =>
      StudentProfileModel.find(filter)
        .select(
          "userId studentId rollNumber registrationNumber firstName lastName collegeEmail phone program branch batch currentSemester academicYear status createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => ({ ...academic(filters), ...dates(filters, "createdAt") }),
  },
  {
    key: "faculty",
    label: "Faculty profiles",
    description: "Faculty identity and employment records",
    fields: [
      "userId",
      "facultyId",
      "employeeId",
      "firstName",
      "lastName",
      "collegeEmail",
      "phone",
      "designation",
      "employmentType",
      "joiningDate",
      "status",
    ],
    count: (filter) => FacultyProfileModel.countDocuments(filter),
    rows: (filter) =>
      FacultyProfileModel.find(filter)
        .select(
          "userId facultyId employeeId firstName lastName collegeEmail phone designation employmentType joiningDate status createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => dates(filters, "createdAt"),
  },
  {
    key: "fees",
    label: "Fee records",
    description: "Invoices, balances and receipted payment transactions",
    fields: [
      "studentId",
      "invoiceNumber",
      "academicYear",
      "semester",
      "feeItems",
      "grossAmount",
      "netDue",
      "totalPaid",
      "balanceDue",
      "status",
      "transactions",
    ],
    count: (filter) => FeeRecordModel.countDocuments(filter),
    rows: (filter) =>
      FeeRecordModel.find(filter)
        .select(
          "studentId rollNumber studentName program branch semester academicYear invoiceNumber dueDate feeItems grossAmount totalConcession totalScholarship netDue totalPaid balanceDue lateFee status transactions createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => ({ ...academic(filters), ...dates(filters, "createdAt") }),
  },
  {
    key: "attendance",
    label: "Attendance records",
    description: "Session-level student attendance records",
    fields: ["studentId", "subjectId", "date", "status", "academicYear", "semester"],
    count: (filter) => AttendanceRecordModel.countDocuments(filter),
    rows: (filter) =>
      AttendanceRecordModel.find(filter)
        .select(
          "studentId subjectId facultyId date status academicYear semester sectionId batchId createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => ({ ...academic(filters), ...dates(filters, "date") }),
  },
  {
    key: "results",
    label: "Semester results",
    description: "Published semester result records",
    fields: ["studentId", "academicYear", "semester", "sgpa", "cgpa", "status"],
    count: (filter) => SemesterResultModel.countDocuments(filter),
    rows: (filter) =>
      SemesterResultModel.find(filter)
        .select(
          "studentId academicYear semester subjects totalCredits creditsEarned sgpa cgpa resultStatus publishedAt createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => ({ ...academic(filters), ...dates(filters, "createdAt") }),
  },
  {
    key: "notices",
    label: "Notices",
    description: "Published and draft institutional notices",
    fields: ["title", "content", "noticeType", "priority", "publishedAt", "expiryDate"],
    count: (filter) => NoticeModel.countDocuments(filter),
    rows: (filter) =>
      NoticeModel.find(filter)
        .select(
          "title content noticeType targetDepartments targetRoles targetPrograms attachments priority expiryDate isPublished publishedAt publishedBy readCount createdBy createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => dates(filters, "createdAt"),
  },
  {
    key: "alumni",
    label: "Alumni records",
    description: "Alumni directory and engagement records",
    fields: ["studentId", "name", "email", "graduationYear", "employmentStatus"],
    count: (filter) => AlumniModel.countDocuments(filter),
    rows: (filter) =>
      AlumniModel.find(filter)
        .select(
          "studentId name email phone program branch graduationYear currentCompany designation employmentStatus higherEducation linkedinUrl createdAt updatedAt",
        )
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => dates(filters, "createdAt"),
  },
  {
    key: "audit_logs",
    label: "Audit logs",
    description: "Append-only operational audit history with sensitive network fields excluded",
    fields: [
      "userId",
      "userName",
      "userRole",
      "action",
      "module",
      "targetId",
      "targetModel",
      "description",
      "createdAt",
    ],
    count: (filter) => AuditLogModel.countDocuments(filter),
    rows: (filter) =>
      AuditLogModel.find(filter)
        .select("userId userName userRole action module targetId targetModel description createdAt")
        .lean()
        .cursor() as AsyncIterable<Record<string, unknown>>,
    filter: (filters) => dates(filters, "createdAt"),
  },
];
const registry = new Map(adapters.map((adapter) => [adapter.key, adapter]));
const SENSITIVE_DATASETS = new Set(["students", "faculty", "fees", "audit_logs"]);

function redactRow(
  row: Record<string, unknown>,
  profile: "standard" | "deidentified",
): Record<string, unknown> {
  if (profile === "standard") return row;
  const directIdentifiers =
    /^(userId|studentId|facultyId|employeeId|rollNumber|registrationNumber|firstName|lastName|name|studentName|collegeEmail|email|phone|targetId|userName)$/i;
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !directIdentifiers.test(key))
      .map(([key, value]) => [key, value]),
  );
}

export const dataPortabilityService = {
  metadata: () =>
    adapters.map(({ key, label, description, fields }) => ({ key, label, description, fields })),
  list: (userId: string, includeAll = false) =>
    DataExportJobModel.find(includeAll ? {} : { requestedBy: userId })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
  create: async (
    input: {
      datasets: string[];
      format?: "json" | "ndjson";
      filters?: IExportFilters;
      purpose: string;
      legalBasis: "consent" | "contract" | "legal_obligation" | "legitimate_interest";
      redactionProfile?: "standard" | "deidentified";
    },
    user: { id: string; name: string },
  ) => {
    const datasets = Array.from(new Set(input.datasets));
    if (!datasets.length || datasets.length > adapters.length)
      throw createError(400, "Select at least one export dataset");
    const selected = datasets.map((key) => {
      const adapter = registry.get(key);
      if (!adapter) throw createError(400, `Unsupported export dataset: ${key}`);
      return adapter;
    });
    const filters = input.filters ?? {};
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to))
      throw createError(400, "Export start date must be before end date");
    const totals = await Promise.all(
      selected.map((adapter) => adapter.count(adapter.filter(filters))),
    );
    const total = totals.reduce((sum, count) => sum + count, 0);
    if (total > 250_000)
      throw createError(
        413,
        "Export exceeds 250,000 rows; narrow the date or academic-year filters",
      );
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`data-export-${year}`);
    const sensitive = datasets.some((dataset) => SENSITIVE_DATASETS.has(dataset));
    const requiresApproval = sensitive || total > 10_000;
    const jobInput = {
      exportNumber: `EXP-${year}-${String(sequence).padStart(6, "0")}`,
      datasets,
      format: input.format ?? "json",
      filters: {
        from: filters.from ? new Date(filters.from) : undefined,
        to: filters.to ? new Date(filters.to) : undefined,
        academicYear: filters.academicYear,
      },
      counts: Object.fromEntries(
        selected.map((adapter, index) => [adapter.key, totals[index] ?? 0]),
      ),
      purpose: input.purpose,
      legalBasis: input.legalBasis,
      redactionProfile: input.redactionProfile ?? "standard",
      status: requiresApproval ? "pending_approval" : "generating",
      requestedBy: user.id,
      requestedByName: user.name,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const job = new DataExportJobModel(jobInput);
    if (requiresApproval) return job.save();

    const session = await DataExportJobModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await job.save({ session });
        await jobQueueService.enqueue(
          "data-export.generate",
          `data-export:${job._id}`,
          { exportJobId: String(job._id) },
          { session },
        );
      });
      return job;
    } finally {
      await session.endSession();
    }
  },
  async decide(id: string, action: "approve" | "reject", reviewerId: string, reason: string) {
    const job = await DataExportJobModel.findOne({ _id: id, status: "pending_approval" }).lean();
    if (!job) throw createError(409, "Only a pending export can be reviewed");
    if (String(job.requestedBy) === reviewerId)
      throw createError(409, "Export requester cannot approve or reject the same export");
    if (reason.trim().length < 10) throw createError(400, "A meaningful review reason is required");
    const session = await DataExportJobModel.db.startSession();
    try {
      let updated;
      await session.withTransaction(async () => {
        updated = await DataExportJobModel.findOneAndUpdate(
          { _id: id, status: "pending_approval" },
          {
            $set: {
              status: action === "approve" ? "generating" : "rejected",
              reviewedBy: reviewerId,
              reviewedAt: new Date(),
              reviewReason: reason.trim(),
            },
          },
          { returnDocument: "after", session },
        ).lean();
        if (!updated) throw createError(409, "Export review state changed concurrently");
        if (action === "approve") {
          await jobQueueService.enqueue(
            "data-export.generate",
            `data-export:${updated._id}`,
            { exportJobId: String(updated._id) },
            { session },
          );
        }
      });
      return updated!;
    } finally {
      await session.endSession();
    }
  },
  getDownload: async (id: string, userId: string) => {
    const job = await DataExportJobModel.findOne({
      _id: id,
      requestedBy: userId,
      status: "ready",
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!job) throw createError(404, "Export is unavailable or expired");
    return job;
  },
  async *streamDataset(
    key: string,
    filters: IExportFilters,
    redactionProfile: "standard" | "deidentified" = "standard",
  ) {
    const adapter = registry.get(key);
    if (!adapter) throw createError(400, `Unsupported export dataset: ${key}`);
    for await (const row of adapter.rows(adapter.filter(filters))) {
      yield redactRow(row, redactionProfile);
    }
  },
  async generateArtifact(id: string) {
    const leaseToken = randomUUID();
    const now = new Date();
    const job = await DataExportJobModel.findOneAndUpdate(
      {
        _id: id,
        status: "generating",
        $or: [
          { generationLeaseUntil: { $lte: now } },
          { generationLeaseUntil: { $exists: false } },
        ],
      },
      {
        $set: {
          generationLeaseToken: leaseToken,
          generationLeaseUntil: new Date(now.getTime() + 15 * 60_000),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!job) {
      const completed = await DataExportJobModel.findOne({ _id: id, status: "ready" }).lean();
      if (completed) return completed;
      throw createError(409, "Export artifact generation is already leased");
    }
    await DataExportArtifactChunkModel.deleteMany({ exportJobId: job._id });
    const hash = createHash("sha256");
    let sequence = 0;
    const filters = {
      from: job.filters.from?.toISOString(),
      to: job.filters.to?.toISOString(),
      academicYear: job.filters.academicYear,
    };
    for (const dataset of job.datasets) {
      let rows: Record<string, unknown>[] = [];
      for await (const row of this.streamDataset(dataset, filters, job.redactionProfile)) {
        rows.push(row);
        if (rows.length < 250) continue;
        const plaintext = JSON.stringify({ dataset, rows });
        hash.update(plaintext);
        await DataExportArtifactChunkModel.create({
          exportJobId: job._id,
          sequence,
          dataset,
          recordCount: rows.length,
          ciphertext: cryptoUtil.encrypt(plaintext),
        });
        sequence += 1;
        rows = [];
      }
      if (rows.length) {
        const plaintext = JSON.stringify({ dataset, rows });
        hash.update(plaintext);
        await DataExportArtifactChunkModel.create({
          exportJobId: job._id,
          sequence,
          dataset,
          recordCount: rows.length,
          ciphertext: cryptoUtil.encrypt(plaintext),
        });
        sequence += 1;
      }
    }
    return DataExportJobModel.findOneAndUpdate(
      { _id: id, status: "generating", generationLeaseToken: leaseToken },
      {
        $set: {
          status: "ready",
          artifactHash: hash.digest("hex"),
          artifactChunkCount: sequence,
          artifactGeneratedAt: new Date(),
        },
        $unset: {
          generationError: 1,
          generationLeaseUntil: 1,
          generationLeaseToken: 1,
        },
      },
      { returnDocument: "after" },
    ).lean();
  },
  async *streamArtifact(id: string) {
    const chunks = DataExportArtifactChunkModel.find({ exportJobId: id })
      .select("+ciphertext")
      .sort({ sequence: 1 })
      .lean()
      .cursor();
    for await (const chunk of chunks) {
      const parsed = JSON.parse(cryptoUtil.decrypt(chunk.ciphertext)) as {
        dataset: string;
        rows: Record<string, unknown>[];
      };
      if (parsed.dataset !== chunk.dataset || parsed.rows.length !== chunk.recordCount)
        throw createError(500, "Export artifact integrity verification failed");
      yield parsed;
    }
  },
  markDownloaded: (id: string) =>
    DataExportJobModel.updateOne(
      { _id: id },
      { $set: { downloadedAt: new Date() }, $inc: { downloadCount: 1 } },
    ),

  async purgeExpiredArtifacts() {
    const expired = await DataExportJobModel.find({
      status: "ready",
      expiresAt: { $lte: new Date() },
    })
      .select("_id datasets")
      .limit(500)
      .lean();
    const datasetKeys = [...new Set(expired.flatMap((job) => job.datasets))];
    const activeHolds = datasetKeys.length
      ? await DataLegalHoldModel.find({ status: "active", datasets: { $in: datasetKeys } })
          .select("datasets")
          .lean()
      : [];
    const heldDatasets = new Set(activeHolds.flatMap((hold) => hold.datasets));
    let purged = 0;
    let held = 0;
    for (const job of expired) {
      if (job.datasets.some((dataset) => heldDatasets.has(dataset))) {
        held += 1;
        continue;
      }
      const claimed = await DataExportJobModel.findOneAndUpdate(
        { _id: job._id, status: "ready", expiresAt: { $lte: new Date() } },
        {
          $set: {
            status: "expired",
            deletionVerifiedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      ).lean();
      if (!claimed) continue;
      await DataExportArtifactChunkModel.deleteMany({ exportJobId: job._id });
      purged += 1;
    }
    return { purged, held };
  },

  async cancelAndVerifyDeletion(id: string, actorId: string, reason: string, mayCancelAny = false) {
    if (reason.trim().length < 10) throw createError(400, "A deletion reason is required");
    const hold = await DataLegalHoldModel.exists({
      status: "active",
      datasets: {
        $in: (await DataExportJobModel.findById(id).select("datasets").lean())?.datasets ?? [],
      },
    });
    if (hold) throw createError(409, "Export is covered by an active legal hold");
    const row = await DataExportJobModel.findOneAndUpdate(
      {
        _id: id,
        ...(mayCancelAny ? {} : { requestedBy: actorId }),
        status: { $in: ["pending_approval", "generating", "ready", "failed", "rejected"] },
      },
      {
        $set: {
          status: "cancelled",
          reviewReason: reason.trim(),
          deletionVerifiedAt: new Date(),
          deletionVerifiedBy: actorId,
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Export cannot be cancelled in its current state");
    await DataExportArtifactChunkModel.deleteMany({ exportJobId: id });
    return row;
  },

  listDsars: () =>
    DataSubjectRequestModel.find()
      .populate("subjectUserId", "name email")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
  async createDsar(
    input: {
      subjectUserId: string;
      requestType: "access" | "rectification" | "erasure" | "restriction" | "portability";
      details: string;
    },
    actorId: string,
  ) {
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`dsar-${year}`);
    return DataSubjectRequestModel.create({
      ...input,
      requestNumber: `DSAR-${year}-${String(sequence).padStart(6, "0")}`,
      requestedBy: actorId,
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  },
  async decideDsar(
    id: string,
    status: "identity_verified" | "under_review" | "fulfilled" | "rejected",
    actorId: string,
    resolution?: string,
  ) {
    const allowed: Record<string, string[]> = {
      submitted: ["identity_verified", "rejected"],
      identity_verified: ["under_review", "rejected"],
      under_review: ["fulfilled", "rejected"],
    };
    const row = await DataSubjectRequestModel.findById(id).lean();
    if (!row || !allowed[row.status]?.includes(status))
      throw createError(409, "Invalid data-subject request transition");
    if (String(row.requestedBy) === actorId) {
      throw createError(409, "The DSAR requester cannot review or resolve the same request");
    }
    if (
      ["fulfilled", "rejected"].includes(status) &&
      (!resolution || resolution.trim().length < 10)
    )
      throw createError(400, "A resolution is required");
    return DataSubjectRequestModel.findOneAndUpdate(
      { _id: id, status: row.status },
      {
        $set: {
          status,
          identityVerifiedAt: status === "identity_verified" ? new Date() : row.identityVerifiedAt,
          resolution: resolution?.trim(),
          resolvedAt: ["fulfilled", "rejected"].includes(status) ? new Date() : undefined,
          resolvedBy: ["fulfilled", "rejected"].includes(status) ? actorId : undefined,
        },
      },
      { returnDocument: "after" },
    ).lean();
  },

  listLegalHolds: () => DataLegalHoldModel.find().sort({ createdAt: -1 }).lean(),
  async createLegalHold(
    input: { name: string; reason: string; datasets: string[] },
    actorId: string,
  ) {
    const invalid = input.datasets.find((dataset) => !registry.has(dataset));
    if (invalid) throw createError(400, `Unsupported legal-hold dataset: ${invalid}`);
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`legal-hold-${year}`);
    return DataLegalHoldModel.create({
      ...input,
      datasets: Array.from(new Set(input.datasets)),
      holdNumber: `HOLD-${year}-${String(sequence).padStart(6, "0")}`,
      createdBy: actorId,
    });
  },
  async releaseLegalHold(id: string, actorId: string, reason: string) {
    if (reason.trim().length < 10) throw createError(400, "A release reason is required");
    const row = await DataLegalHoldModel.findOneAndUpdate(
      { _id: id, status: "active", createdBy: { $ne: actorId } },
      {
        $set: {
          status: "released",
          releasedAt: new Date(),
          releasedBy: actorId,
          releaseReason: reason.trim(),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!row)
      throw createError(409, "Legal hold is not active or requires an independent releaser");
    return row;
  },
  async complianceSummary() {
    const now = new Date();
    const [pendingExports, overdueDsars, activeHolds, readyExports] = await Promise.all([
      DataExportJobModel.countDocuments({ status: "pending_approval" }),
      DataSubjectRequestModel.countDocuments({
        status: { $nin: ["fulfilled", "rejected"] },
        dueAt: { $lt: now },
      }),
      DataLegalHoldModel.countDocuments({ status: "active" }),
      DataExportJobModel.countDocuments({ status: "ready", expiresAt: { $gt: now } }),
    ]);
    return { pendingExports, overdueDsars, activeHolds, readyExports, generatedAt: now };
  },
};
