import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  /** The user who performed the action (null for system events). */
  userId?: Types.ObjectId;
  userName?: string;
  userRole?: string;
  roleId?: string;
  tenantId?: string;
  requestId?: string;
  action: string; // e.g., "USER_LOGIN", "ADMISSION_APPROVED"
  module: string; // e.g., "user_management", "admission"
  targetId?: string; // The resource ID that was acted upon
  targetModel?: string; // Mongoose model name of the target resource
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  eventHash: string;
  hashVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    userName: { type: String },
    userRole: { type: String },
    roleId: { type: String, index: true },
    tenantId: { type: String, index: true },
    requestId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    targetId: { type: String },
    targetModel: { type: String },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    reason: { type: String },
    eventHash: { type: String, required: true, unique: true, immutable: true },
    hashVersion: { type: Number, required: true, default: 1, immutable: true },
  },
  {
    timestamps: true,
    // Audit logs are append-only — no updates allowed in application code
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
      },
    },
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });

function immutableAuditError() {
  return new Error("Audit logs are append-only and cannot be changed or deleted");
}

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const) {
  auditLogSchema.pre(operation, function () {
    throw immutableAuditError();
  });
}

auditLogSchema.pre("save", function () {
  if (!this.isNew) throw immutableAuditError();
});
// NOTE: auditPlugin is intentionally NOT applied here.
// Audit logs must be immutable and append-only — they must never be soft-deleted.
// Applying auditPlugin would add isDeleted / softDelete() which would allow tampering.

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
