import createError from "http-errors";
import { Types } from "mongoose";
import {
  RegulatorySubmissionModel,
  type IRegulatorySubmission,
  type TRegulatorySubmissionStatus,
} from "../models/regulatory-submission.model";
import type { TRegulatoryProvider } from "../models/regulatory-integration.model";
import { regulatoryDataService } from "./regulatory-data.service";

const batchNumber = (provider: TRegulatoryProvider, academicYear: string) =>
  `${provider.toUpperCase()}-${academicYear.replace("-", "")}-${Date.now().toString(36).toUpperCase()}`;

const recordHistory = (
  batch: IRegulatorySubmission,
  action: string,
  userId: string,
  fromStatus?: string,
  toStatus?: string,
  note?: string,
) => {
  batch.history.push({
    action,
    fromStatus,
    toStatus,
    note,
    at: new Date(),
    by: new Types.ObjectId(userId),
  });
};

const findBatch = async (id: string) => {
  const batch = await RegulatorySubmissionModel.findById(id);
  if (!batch) throw createError(404, "Regulatory submission batch was not found.");
  return batch;
};

export const regulatorySubmissionService = {
  async list(provider?: TRegulatoryProvider, academicYear?: string) {
    return RegulatorySubmissionModel.find({
      ...(provider ? { provider } : {}),
      ...(academicYear ? { academicYear } : {}),
    })
      .select("-rows")
      .sort({ createdAt: -1 })
      .lean();
  },

  async create(provider: TRegulatoryProvider, academicYear: string, userId: string) {
    const operational = await regulatoryDataService.operational(provider, academicYear);
    const rows = operational.rows.filter((row) => row.status === "ready");
    if (!rows.length)
      throw createError(409, "No validated records are ready for a submission batch.");
    const batch = await RegulatorySubmissionModel.create({
      batchNumber: batchNumber(provider, academicYear),
      provider,
      academicYear,
      sourceGeneratedAt: new Date(operational.generatedAt),
      rows: rows.map(({ reference, name, category, primaryValue, secondaryValue, payload }) => ({
        reference,
        name,
        category,
        primaryValue,
        secondaryValue,
        payload: payload ?? {},
      })),
      recordCount: rows.length,
      excludedRecords: operational.summary.total - rows.length,
      exportFields: operational.exportFields,
      createdBy: new Types.ObjectId(userId),
      history: [
        {
          action: "BATCH_CREATED",
          toStatus: "draft",
          at: new Date(),
          by: new Types.ObjectId(userId),
        },
      ],
    });
    return batch;
  },

  async requestReview(id: string, userId: string, note: string) {
    const batch = await findBatch(id);
    if (batch.status !== "draft") throw createError(409, "Only a draft batch can enter review.");
    batch.status = "in_review";
    batch.reviewRequestedBy = new Types.ObjectId(userId);
    batch.reviewRequestedAt = new Date();
    recordHistory(batch, "REVIEW_REQUESTED", userId, "draft", "in_review", note);
    await batch.save();
    return batch;
  },

  async decide(id: string, userId: string, decision: "approved" | "rejected", note: string) {
    const batch = await findBatch(id);
    if (batch.status !== "in_review") throw createError(409, "The batch is not awaiting review.");
    if (String(batch.reviewRequestedBy) === userId)
      throw createError(403, "The batch preparer cannot approve their own submission.");
    batch.status = decision;
    if (decision === "approved") {
      batch.approvedBy = new Types.ObjectId(userId);
      batch.approvedAt = new Date();
    }
    recordHistory(
      batch,
      decision === "approved" ? "BATCH_APPROVED" : "BATCH_REJECTED",
      userId,
      "in_review",
      decision,
      note,
    );
    await batch.save();
    return batch;
  },

  async markExported(id: string, userId: string) {
    const batch = await findBatch(id);
    if (!(["approved", "exported"] as TRegulatorySubmissionStatus[]).includes(batch.status))
      throw createError(409, "Approve the batch before exporting it.");
    const from = batch.status;
    batch.status = "exported";
    batch.exportedBy = new Types.ObjectId(userId);
    batch.exportedAt = new Date();
    recordHistory(batch, "BATCH_EXPORTED", userId, from, "exported");
    await batch.save();
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const fields = batch.exportFields.length
      ? batch.exportFields
      : ["REFERENCE", "NAME", "CATEGORY", "PRIMARY_VALUE", "SECONDARY_VALUE"];
    const exportRows = ["aishe", "nirf"].includes(batch.provider)
      ? [
          Object.assign({}, ...batch.rows.map((row) => row.payload)) as Record<
            string,
            string | number
          >,
        ]
      : batch.rows.map((row) => row.payload);
    const content = [
      fields,
      ...exportRows.map((payload) =>
        fields.map((field) => {
          return String(payload[field] ?? "");
        }),
      ),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\n");
    return { batch, filename: `${batch.batchNumber}.csv`, content };
  },

  async markSubmitted(id: string, userId: string, acknowledgementReference: string) {
    const batch = await findBatch(id);
    if (batch.status !== "exported") throw createError(409, "Export the approved batch first.");
    batch.status = "submitted";
    batch.submittedBy = new Types.ObjectId(userId);
    batch.submittedAt = new Date();
    batch.acknowledgementReference = acknowledgementReference;
    recordHistory(
      batch,
      "BATCH_SUBMITTED",
      userId,
      "exported",
      "submitted",
      acknowledgementReference,
    );
    await batch.save();
    return batch;
  },

  async reconcile(
    id: string,
    userId: string,
    acceptedRecords: number,
    rejectedRecords: number,
    note: string,
  ) {
    const batch = await findBatch(id);
    if (!["submitted", "partially_accepted"].includes(batch.status))
      throw createError(409, "Only a submitted batch can be reconciled.");
    if (acceptedRecords + rejectedRecords > batch.rows.length)
      throw createError(400, "Reconciled records cannot exceed the batch size.");
    const next: TRegulatorySubmissionStatus =
      rejectedRecords === 0 && acceptedRecords === batch.rows.length
        ? "accepted"
        : acceptedRecords === 0 && rejectedRecords === batch.rows.length
          ? "rejected"
          : "partially_accepted";
    const from = batch.status;
    batch.status = next;
    batch.acceptedRecords = acceptedRecords;
    batch.rejectedRecords = rejectedRecords;
    batch.reconciliationNote = note;
    batch.reconciledBy = new Types.ObjectId(userId);
    batch.reconciledAt = new Date();
    recordHistory(batch, "BATCH_RECONCILED", userId, from, next, note);
    await batch.save();
    return batch;
  },
};
