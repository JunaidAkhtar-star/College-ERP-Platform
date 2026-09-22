import createError from "http-errors";
import { createHash, randomUUID } from "crypto";
import mongoose, { Types } from "mongoose";
import {
  FormDefinitionModel,
  FormSubmissionModel,
  WorkflowDelegationModel,
  type IFormField,
  type IWorkflowStep,
} from "../models/form-workflow.model";
import { RoleModel } from "../models/role.model";
import { UserModel } from "../models/user.model";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { SystemRole } from "../constants/roles";

type TFormValue = string | number | boolean | string[];

function normalizeDefinitions(input: { fields?: IFormField[]; workflow?: IWorkflowStep[] }) {
  const fields = input.fields ?? [];
  if (!fields.length || fields.length > 100) throw createError(400, "Use 1-100 form fields");
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) throw createError(400, `Duplicate field key: ${field.key}`);
    if (field.type === "select" && (!field.options?.length || field.options.length > 100))
      throw createError(400, `Select field ${field.label} requires 1-100 options`);
    if (
      field.pattern &&
      (field.pattern.length > 100 || /\([^)]*[+*][^)]*\)[+*]/.test(field.pattern))
    )
      throw createError(400, `Unsafe validation pattern for ${field.label}`);
    if (field.condition) {
      if (!keys.has(field.condition.fieldKey))
        throw createError(400, `Conditional field ${field.label} must depend on an earlier field`);
      if (field.condition.fieldKey === field.key)
        throw createError(400, `Field ${field.label} cannot depend on itself`);
    }
    keys.add(field.key);
  }
  const workflow = (input.workflow ?? []).map((step, index) => ({ ...step, sequence: index + 1 }));
  if (workflow.length > 20) throw createError(400, "A workflow supports at most 20 steps");
  if (workflow.some((step) => !step.approverRoles.length))
    throw createError(400, "Every workflow step requires an approver role");
  return { fields, workflow };
}

function formDefinitionHash(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function activeDelegations(delegateId: string) {
  const now = new Date();
  return WorkflowDelegationModel.find({
    delegateId,
    revokedAt: { $exists: false },
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  })
    .select("delegatorId role")
    .lean();
}

export function validateFormPayload(fields: IFormField[], raw: Record<string, unknown>) {
  const output: Record<string, TFormValue> = {};
  const allowed = new Set(fields.map((field) => field.key));
  const unknownKeys = Object.keys(raw).filter((key) => !allowed.has(key));
  if (unknownKeys.length) throw createError(400, `Unknown form fields: ${unknownKeys.join(", ")}`);
  for (const field of fields) {
    if (field.condition) {
      const controllingValue = raw[field.condition.fieldKey];
      const matches = String(controllingValue ?? "") === String(field.condition.value ?? "");
      const visible = field.condition.operator === "equals" ? matches : !matches;
      if (!visible) continue;
    }
    const value = raw[field.key];
    const empty = value === undefined || value === null || value === "";
    if (field.required && empty) throw createError(400, `${field.label} is required`);
    if (empty) continue;
    if (field.type === "checkbox") {
      if (typeof value !== "boolean")
        throw createError(400, `${field.label} must be true or false`);
      output[field.key] = value;
      continue;
    }
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) throw createError(400, `${field.label} must be a number`);
      if (field.min !== undefined && number < field.min)
        throw createError(400, `${field.label} must be at least ${field.min}`);
      if (field.max !== undefined && number > field.max)
        throw createError(400, `${field.label} must be at most ${field.max}`);
      output[field.key] = number;
      continue;
    }
    const text = String(value).trim();
    if (text.length > 10000) throw createError(400, `${field.label} is too long`);
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      throw createError(400, `${field.label} must be a valid email`);
    if (field.type === "phone" && !/^\+?[0-9 ()-]{7,20}$/.test(text))
      throw createError(400, `${field.label} must be a valid phone number`);
    if (field.type === "date" && Number.isNaN(new Date(text).getTime()))
      throw createError(400, `${field.label} must be a valid date`);
    if (field.type === "select" && !field.options?.includes(text))
      throw createError(400, `${field.label} has an invalid selection`);
    if (field.type === "file" && !/^https:\/\//i.test(text))
      throw createError(400, `${field.label} must be an uploaded HTTPS file URL`);
    if (field.pattern && !new RegExp(field.pattern).test(text))
      throw createError(400, `${field.label} has an invalid format`);
    output[field.key] = text;
  }
  return output;
}

export const formWorkflowService = {
  metadata: async () => ({
    fieldTypes: [
      "text",
      "textarea",
      "number",
      "email",
      "phone",
      "date",
      "select",
      "checkbox",
      "file",
    ],
    roles: (
      await RoleModel.find({ isActive: true })
        .select("name displayName")
        .sort({ displayName: 1 })
        .lean()
    ).map((role) => ({ name: role.name, displayName: role.displayName })),
  }),
  listDefinitions: (includeDrafts: boolean, activeRole?: string) =>
    FormDefinitionModel.find(
      includeDrafts
        ? {}
        : {
            status: "published",
            $or: [
              { submissionRoles: { $size: 0 } },
              ...(activeRole ? [{ submissionRoles: activeRole }] : []),
            ],
          },
    )
      .sort({ slug: 1, version: -1 })
      .lean(),
  getDefinition: async (idOrSlug: string, includeDrafts: boolean) => {
    const query = Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
    const row = await FormDefinitionModel.findOne({
      ...query,
      ...(includeDrafts ? {} : { status: "published" }),
    })
      .sort({ version: -1 })
      .lean();
    if (!row) throw createError(404, "Form not found");
    return row;
  },
  saveDefinition: async (
    input: {
      name: string;
      slug: string;
      description?: string;
      category: string;
      fields: IFormField[];
      workflow?: IWorkflowStep[];
      submissionRoles?: string[];
    },
    userId: string,
    id?: string,
  ) => {
    const normalized = normalizeDefinitions(input);
    const data = {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description?.trim(),
      category: input.category.trim(),
      ...normalized,
      submissionRoles: input.submissionRoles ?? [],
    };
    const hash = formDefinitionHash(data);
    if (!id)
      return FormDefinitionModel.create({
        ...data,
        definitionKey: randomUUID(),
        definitionHash: hash,
        version: 1,
        createdBy: userId,
      });
    const current = await FormDefinitionModel.findById(id).lean();
    if (!current) throw createError(404, "Form not found");
    if (current.status === "archived")
      throw createError(409, "Archived form versions are immutable");
    const definitionKey = current.definitionKey || randomUUID();
    const latest = await FormDefinitionModel.findOne({
      definitionKey,
    })
      .sort({ version: -1 })
      .lean();
    return FormDefinitionModel.create({
      ...data,
      definitionKey,
      definitionHash: hash,
      version: (latest?.version ?? current.version) + 1,
      previousVersionId: current._id,
      createdBy: userId,
      status: "draft",
    });
  },
  publish: async (id: string, userId: string) => {
    const draft = await FormDefinitionModel.findOne({ _id: id, status: "pending_review" }).lean();
    if (!draft) throw createError(409, "Only a reviewed form can be published");
    if (String(draft.submittedForReviewBy) === userId)
      throw createError(409, "The form submitter cannot publish the same version");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await FormDefinitionModel.updateMany(
          { definitionKey: draft.definitionKey, status: "published" },
          { $set: { status: "archived" } },
          { session },
        );
        const result = await FormDefinitionModel.updateOne(
          { _id: id, status: "pending_review" },
          {
            $set: {
              status: "published",
              publishedAt: new Date(),
              updatedBy: userId,
            },
          },
          { session, runValidators: true },
        );
        if (result.modifiedCount !== 1)
          throw createError(409, "Form version was concurrently published");
      });
    } finally {
      await session.endSession();
    }
    return FormDefinitionModel.findById(id).lean();
  },
  submitForReview: async (id: string, userId: string) => {
    const form = await FormDefinitionModel.findOneAndUpdate(
      { _id: id, status: "draft", createdBy: userId },
      { $set: { status: "pending_review", submittedForReviewBy: userId } },
      { returnDocument: "after" },
    ).lean();
    if (!form) throw createError(409, "Only an owned draft form can be submitted for review");
    return form;
  },
  submit: async (
    formId: string,
    raw: Record<string, unknown>,
    user: { id: string; name: string; roles: string[] },
  ) => {
    const form = await FormDefinitionModel.findOne({ _id: formId, status: "published" }).lean();
    if (!form) throw createError(404, "Published form not found");
    if (
      form.submissionRoles.length &&
      !user.roles.some((role) => form.submissionRoles.includes(role))
    )
      throw createError(403, "Your role cannot submit this form");
    const data = validateFormPayload(form.fields, raw);
    const hasWorkflow = form.workflow.length > 0;
    const submission = await FormSubmissionModel.create({
      formId: form._id,
      formVersion: form.version,
      formName: form.name,
      schemaSnapshot: form.fields,
      workflowSnapshot: form.workflow,
      submittedBy: user.id,
      submittedByName: user.name,
      data,
      status: hasWorkflow ? "in_review" : "approved",
      currentStep: 1,
      submittedAt: new Date(),
      completedAt: hasWorkflow ? undefined : new Date(),
      stepDueAt: hasWorkflow
        ? new Date(Date.now() + (form.workflow[0]?.slaHours ?? 48) * 60 * 60 * 1000)
        : undefined,
    });
    if (hasWorkflow) {
      const approvers = await UserModel.find({
        roles: { $in: (form.workflow[0]?.approverRoles ?? []) as SystemRole[] },
      })
        .select("_id")
        .lean();
      void notifyUsers(
        approvers.map((approver) => approver._id),
        {
          title: `Approval required: ${form.name}`,
          body: `${user.name} submitted a form requiring your review.`,
          type: NotificationType.INFO,
          actionUrl: "/forms",
        },
      );
    }
    return submission;
  },
  mySubmissions: (userId: string) =>
    FormSubmissionModel.find({ submittedBy: userId }).sort({ createdAt: -1 }).lean(),
  inbox: async (userId: string, roles: string[]) => {
    const delegations = await activeDelegations(userId);
    const effectiveRoles = [...new Set([...roles, ...delegations.map((item) => item.role)])];
    return FormSubmissionModel.find({
      status: "in_review",
      workflowSnapshot: { $elemMatch: { approverRoles: { $in: effectiveRoles } } },
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean()
      .then((rows) =>
        rows.filter((row) =>
          row.workflowSnapshot[row.currentStep - 1]?.approverRoles.some((role) =>
            effectiveRoles.includes(role),
          ),
        ),
      );
  },
  allSubmissions: () => FormSubmissionModel.find().sort({ createdAt: -1 }).limit(2000).lean(),
  decide: async (
    id: string,
    decision: "approved" | "rejected",
    note: string | undefined,
    user: { id: string; name: string; roles: string[] },
  ) => {
    const row = await FormSubmissionModel.findOne({ _id: id, status: "in_review" });
    if (!row) throw createError(409, "Submission is not awaiting a decision");
    const step = row.workflowSnapshot[row.currentStep - 1];
    const delegations = await activeDelegations(user.id);
    const direct = step?.approverRoles.some((role) => user.roles.includes(role));
    const delegation = step
      ? delegations.find((item) => step.approverRoles.includes(item.role))
      : undefined;
    if (!step || (!direct && !delegation))
      throw createError(403, "Your role cannot decide this workflow step");
    if (
      !step.allowSelfApproval &&
      (row.submittedBy.toString() === user.id ||
        String(delegation?.delegatorId ?? "") === row.submittedBy.toString())
    )
      throw createError(403, "Self-approval is not allowed for this step");
    if (decision === "rejected" && String(note ?? "").trim().length < 3)
      throw createError(400, "A rejection note is required");
    const finalApproval = decision === "approved" && row.currentStep >= row.workflowSnapshot.length;
    const nextStatus =
      decision === "rejected" ? "rejected" : finalApproval ? "approved" : "in_review";
    const updated = await FormSubmissionModel.findOneAndUpdate(
      { _id: row._id, status: "in_review", currentStep: row.currentStep },
      {
        $push: {
          decisions: {
            step: row.currentStep,
            decision,
            note,
            decidedBy: user.id,
            decidedByName: user.name,
            decidedAt: new Date(),
            delegatedFor: delegation?.delegatorId,
          },
        },
        $set: {
          status: nextStatus,
          ...(nextStatus !== "in_review" ? { completedAt: new Date() } : {}),
          ...(nextStatus === "in_review"
            ? {
                stepDueAt: new Date(
                  Date.now() +
                    (row.workflowSnapshot[row.currentStep]?.slaHours ?? 48) * 60 * 60 * 1000,
                ),
              }
            : { stepDueAt: undefined }),
        },
        ...(nextStatus === "in_review" ? { $inc: { currentStep: 1 } } : {}),
        $unset: { escalatedAt: 1 },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw createError(409, "Another approver already processed this step");
    void notifyUsers([row.submittedBy], {
      title: `Form ${nextStatus.replace("_", " ")}`,
      body:
        decision === "rejected"
          ? `${row.formName} was rejected: ${String(note ?? "").trim()}`
          : finalApproval
            ? `${row.formName} was fully approved.`
            : `${row.formName} advanced to the next approval step.`,
      type: decision === "rejected" ? NotificationType.WARNING : NotificationType.SUCCESS,
      actionUrl: "/forms",
    });
    return updated;
  },
  withdraw: async (id: string, userId: string) => {
    const row = await FormSubmissionModel.findOneAndUpdate(
      {
        _id: id,
        submittedBy: userId,
        status: { $in: ["submitted", "in_review"] },
        decisions: { $size: 0 },
      },
      { $set: { status: "withdrawn", completedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Submission can no longer be withdrawn");
    return row;
  },
  remind: async (id: string, user: { id: string; name: string; roles: string[] }) => {
    const row = await FormSubmissionModel.findOne({ _id: id, status: "in_review" });
    if (!row) throw createError(409, "Only an active approval can be reminded");
    const step = row.workflowSnapshot[row.currentStep - 1];
    const isRequester = String(row.submittedBy) === user.id;
    const isManager = user.roles.some((role) =>
      [
        SystemRole.SUPER_ADMIN,
        SystemRole.ADMIN,
        SystemRole.PRINCIPAL,
        SystemRole.ADMINISTRATION_OFFICE,
      ].includes(role as SystemRole),
    );
    if (!isRequester && !isManager)
      throw createError(403, "Only the requester or a workflow manager can send a reminder");
    if (row.lastReminderAt && Date.now() - row.lastReminderAt.getTime() < 6 * 60 * 60 * 1000)
      throw createError(429, "A reminder was already sent within the last 6 hours");
    const approvers = await UserModel.find({
      roles: { $in: (step?.approverRoles ?? []) as SystemRole[] },
    })
      .select("_id")
      .lean();
    await notifyUsers(
      approvers.map((approver) => approver._id),
      {
        title: `Reminder: ${row.formName} needs review`,
        body: `${user.name} requested an update on this approval.`,
        type: NotificationType.INFO,
        actionUrl: "/forms",
      },
    );
    row.lastReminderAt = new Date();
    row.reminderCount += 1;
    await row.save();
    return row;
  },

  myDelegations: async (userId: string) => {
    const rows = await WorkflowDelegationModel.find({
      $or: [{ delegatorId: userId }, { delegateId: userId }],
      revokedAt: { $exists: false },
      endsAt: { $gte: new Date() },
    })
      .populate("delegatorId", "name email")
      .populate("delegateId", "name email")
      .sort({ startsAt: 1 })
      .lean();
    return rows.map((item) => ({
      ...item,
      canRevoke:
        String(
          (item.delegatorId as unknown as { _id?: Types.ObjectId })._id ?? item.delegatorId,
        ) === userId,
    }));
  },

  createDelegation: async (
    user: { id: string; name: string; roles: string[] },
    input: { delegateId: string; role: string; startsAt: string; endsAt: string; reason?: string },
  ) => {
    if (!user.roles.includes(input.role))
      throw createError(403, "You can only delegate your active approval role");
    if (input.delegateId === user.id) throw createError(400, "Choose another user as delegate");
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 90 * 86_400_000)
      throw createError(400, "Delegation must be a positive period of at most 90 days");
    const delegate = await UserModel.exists({ _id: input.delegateId, status: "active" });
    if (!delegate) throw createError(404, "Active delegate not found");
    const overlap = await WorkflowDelegationModel.exists({
      delegatorId: user.id,
      role: input.role,
      revokedAt: { $exists: false },
      startsAt: { $lte: endsAt },
      endsAt: { $gte: startsAt },
    });
    if (overlap) throw createError(409, "This role already has an overlapping delegation");
    return WorkflowDelegationModel.create({
      delegatorId: user.id,
      delegateId: input.delegateId,
      role: input.role,
      startsAt,
      endsAt,
      reason: input.reason,
    });
  },

  revokeDelegation: async (id: string, userId: string) => {
    const item = await WorkflowDelegationModel.findOneAndUpdate(
      { _id: id, delegatorId: userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), updatedBy: userId } },
      { returnDocument: "after" },
    ).lean();
    if (!item) throw createError(409, "Only the owner can revoke an active delegation");
    return item;
  },

  processEscalations: async () => {
    const now = new Date();
    const overdue = await FormSubmissionModel.find({
      status: "in_review",
      stepDueAt: { $lte: now },
      $or: [{ escalatedAt: { $exists: false } }, { escalatedAt: null }],
    })
      .limit(500)
      .lean();
    let escalated = 0;
    for (const row of overdue) {
      const claimed = await FormSubmissionModel.updateOne(
        {
          _id: row._id,
          status: "in_review",
          currentStep: row.currentStep,
          $or: [{ escalatedAt: { $exists: false } }, { escalatedAt: null }],
        },
        { $set: { escalatedAt: now }, $inc: { escalationCount: 1 } },
      );
      if (!claimed.modifiedCount) continue;
      const step = row.workflowSnapshot[row.currentStep - 1];
      const roles = step?.escalationRoles?.length
        ? step.escalationRoles
        : [SystemRole.ADMIN, SystemRole.PRINCIPAL];
      const recipients = await UserModel.find({
        status: "active",
        roles: { $in: roles as SystemRole[] },
      })
        .select("_id")
        .lean();
      await notifyUsers(
        recipients.map((item) => item._id),
        {
          title: `Overdue approval: ${row.formName}`,
          body: `${step?.name ?? "Approval"} exceeded its SLA and needs attention.`,
          type: NotificationType.WARNING,
          actionUrl: "/forms",
        },
      );
      escalated += 1;
    }
    return { evaluated: overdue.length, escalated };
  },
};
