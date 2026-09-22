import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "file";
export interface IFormField {
  key: string;
  label: string;
  type: TFormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  condition?: {
    fieldKey: string;
    operator: "equals" | "not_equals";
    value: string | number | boolean;
  };
}
export interface IWorkflowStep {
  sequence: number;
  name: string;
  approverRoles: string[];
  allowSelfApproval: boolean;
  slaHours?: number;
  escalationRoles?: string[];
}
export interface IFormDefinition extends Document {
  name: string;
  slug: string;
  description?: string;
  category: string;
  definitionKey: string;
  version: number;
  previousVersionId?: Types.ObjectId;
  definitionHash: string;
  status: "draft" | "pending_review" | "published" | "archived";
  fields: IFormField[];
  workflow: IWorkflowStep[];
  submissionRoles: string[];
  createdBy: Types.ObjectId;
  submittedForReviewBy?: Types.ObjectId;
  publishedAt?: Date;
}
export interface IFormSubmission extends Document {
  formId: Types.ObjectId;
  formVersion: number;
  formName: string;
  schemaSnapshot: IFormField[];
  workflowSnapshot: IWorkflowStep[];
  submittedBy: Types.ObjectId;
  submittedByName: string;
  data: Record<string, string | number | boolean | string[]>;
  status: "submitted" | "in_review" | "approved" | "rejected" | "withdrawn";
  currentStep: number;
  decisions: Array<{
    step: number;
    decision: "approved" | "rejected";
    note?: string;
    decidedBy: Types.ObjectId;
    decidedByName: string;
    decidedAt: Date;
    delegatedFor?: Types.ObjectId;
  }>;
  submittedAt: Date;
  completedAt?: Date;
  stepDueAt?: Date;
  lastReminderAt?: Date;
  reminderCount: number;
  escalatedAt?: Date;
  escalationCount: number;
}

const FormFieldSchema = new Schema<IFormField>(
  {
    key: { type: String, required: true, trim: true, match: /^[a-z][a-z0-9_]{1,49}$/ },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "email", "phone", "date", "select", "checkbox", "file"],
      required: true,
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, maxlength: 200 },
    helpText: { type: String, maxlength: 500 },
    options: { type: [String], default: undefined },
    min: Number,
    max: Number,
    pattern: { type: String, maxlength: 200 },
    condition: {
      fieldKey: { type: String },
      operator: { type: String, enum: ["equals", "not_equals"] },
      value: { type: Schema.Types.Mixed },
    },
  },
  { _id: false },
);
const WorkflowStepSchema = new Schema<IWorkflowStep>(
  {
    sequence: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    approverRoles: { type: [String], required: true },
    allowSelfApproval: { type: Boolean, default: false },
    slaHours: { type: Number, min: 1, max: 720, default: 48 },
    escalationRoles: { type: [String], default: [] },
  },
  { _id: false },
);
const FormDefinitionSchema = new Schema<IFormDefinition>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9-]{2,80}$/ },
    description: { type: String, maxlength: 1000 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    definitionKey: { type: String, required: true, immutable: true, index: true },
    version: { type: Number, default: 1, min: 1, immutable: true },
    previousVersionId: { type: Schema.Types.ObjectId, ref: "FormDefinition", immutable: true },
    definitionHash: { type: String, required: true, immutable: true },
    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "archived"],
      default: "draft",
      index: true,
    },
    fields: {
      type: [FormFieldSchema],
      validate: [(rows: IFormField[]) => rows.length > 0 && rows.length <= 100, "Use 1-100 fields"],
    },
    workflow: { type: [WorkflowStepSchema], default: [] },
    submissionRoles: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedForReviewBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
  },
  { timestamps: true },
);
FormDefinitionSchema.index({ slug: 1, version: 1 }, { unique: true });
FormDefinitionSchema.index({ definitionKey: 1, version: 1 }, { unique: true });
FormDefinitionSchema.plugin(auditPlugin);

const FormSubmissionSchema = new Schema<IFormSubmission>(
  {
    formId: { type: Schema.Types.ObjectId, ref: "FormDefinition", required: true, index: true },
    formVersion: { type: Number, required: true },
    formName: { type: String, required: true },
    schemaSnapshot: { type: [FormFieldSchema], required: true },
    workflowSnapshot: { type: [WorkflowStepSchema], default: [] },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    submittedByName: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["submitted", "in_review", "approved", "rejected", "withdrawn"],
      default: "submitted",
      index: true,
    },
    currentStep: { type: Number, default: 1, min: 1 },
    decisions: [
      new Schema(
        {
          step: { type: Number, required: true },
          decision: { type: String, enum: ["approved", "rejected"], required: true },
          note: { type: String, maxlength: 1000 },
          decidedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          decidedByName: { type: String, required: true },
          decidedAt: { type: Date, default: Date.now },
          delegatedFor: { type: Schema.Types.ObjectId, ref: "User" },
        },
        { _id: false },
      ),
    ],
    submittedAt: { type: Date, default: Date.now },
    completedAt: Date,
    stepDueAt: { type: Date, index: true },
    lastReminderAt: Date,
    reminderCount: { type: Number, default: 0, min: 0 },
    escalatedAt: Date,
    escalationCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
FormSubmissionSchema.index({ status: 1, currentStep: 1, createdAt: -1 });
FormSubmissionSchema.plugin(auditPlugin);

export const FormDefinitionModel = mongoose.model<IFormDefinition>(
  "FormDefinition",
  FormDefinitionSchema,
);
export const FormSubmissionModel = mongoose.model<IFormSubmission>(
  "FormSubmission",
  FormSubmissionSchema,
);

export interface IWorkflowDelegation extends Document {
  delegatorId: Types.ObjectId;
  delegateId: Types.ObjectId;
  role: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  revokedAt?: Date;
  createdAt: Date;
}
const WorkflowDelegationSchema = new Schema<IWorkflowDelegation>(
  {
    delegatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    delegateId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, trim: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    revokedAt: Date,
  },
  { timestamps: true },
);
WorkflowDelegationSchema.plugin(auditPlugin);
WorkflowDelegationSchema.index({ delegateId: 1, role: 1, startsAt: 1, endsAt: 1 });
WorkflowDelegationSchema.index({ delegatorId: 1, revokedAt: 1, endsAt: -1 });
export const WorkflowDelegationModel = mongoose.model<IWorkflowDelegation>(
  "WorkflowDelegation",
  WorkflowDelegationSchema,
);
