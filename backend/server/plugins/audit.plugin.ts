/**
 * Mongoose base schema plugin — SRS §6.3
 *
 * Adds to every model:
 *   - isDeleted / deletedAt / deletedBy  (soft deletion)
 *   - createdBy / updatedBy              (audit columns)
 *
 * Usage: apply once per schema before registering the model.
 *   schema.plugin(auditPlugin);
 *
 * Automatically filters out soft-deleted documents from all find* queries.
 * To include deleted docs: Model.find({ isDeleted: true }).
 */
import { Schema } from "mongoose";
import type mongoose from "mongoose";
import type { Types } from "mongoose";

export interface IAuditFields {
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function auditPlugin(schema: Schema<any>): void {
  // ── Audit & Soft Delete Fields ─────────────────────────────────────────────
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    ...(schema.path("createdBy")
      ? {}
      : { createdBy: { type: Schema.Types.ObjectId, ref: "User" } }),
    ...(schema.path("updatedBy")
      ? {}
      : { updatedBy: { type: Schema.Types.ObjectId, ref: "User" } }),
  });

  // ── Auto-filter deleted docs from all find* queries ────────────────────────
  // Register pre-hook per method to avoid TypeScript overload issues
  for (const method of [
    "find",
    "findOne",
    "countDocuments",
    "findOneAndUpdate",
    "findOneAndDelete",
    "findOneAndReplace",
  ] as const) {
    schema.pre(method, function (this: mongoose.Query<unknown, unknown>) {
      const conditions = this.getFilter() as Record<string, unknown>;
      if (!("isDeleted" in conditions)) {
        this.where({ isDeleted: false });
      }
    });
  }

  // findById uses findOne internally — no separate hook needed

  // ── Soft-delete instance method ────────────────────────────────────────────
  schema.methods.softDelete = async function (deletedBy?: Types.ObjectId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (deletedBy) this.deletedBy = deletedBy;
    return this.save();
  };
}
