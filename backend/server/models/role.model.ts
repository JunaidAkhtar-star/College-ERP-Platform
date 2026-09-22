import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import type { IPermission } from "../constants/permissions";
import { PermissionAction } from "../constants/permissions";
import { auditPlugin } from "../plugins/audit.plugin";
import type { SystemRole } from "../constants/roles";
import { ALL_ROLES } from "../constants/roles";

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IRole extends Document {
  _id: Types.ObjectId;
  /** Maps to a SystemRole enum value OR a custom role name created by Super Admin. */
  name: string;
  /** Legacy/system role used for record-scope rules while this permission role is active. */
  baseRole: SystemRole;
  displayName: string;
  description?: string;
  permissions: IPermission[];
  /** NavItem ids this role can see in the sidebar. Empty = use legacy requiredRoles match. */
  allowedNavItems: Types.ObjectId[];
  isSystem: boolean; // true = shipped with the product, cannot be deleted
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema: single permission entry
// ─────────────────────────────────────────────────────────────────────────────

const permissionSchema = new Schema<IPermission>(
  {
    module: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },
    actions: {
      type: [String],
      enum: Object.values(PermissionAction),
      required: true,
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    baseRole: { type: String, enum: ALL_ROLES, required: true, index: true },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: { type: [permissionSchema], default: [] },
    allowedNavItems: { type: [Schema.Types.ObjectId], ref: "NavItem", default: [] },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
      },
    },
  },
);

roleSchema.plugin(auditPlugin);

export const RoleModel = mongoose.model<IRole>("Role", roleSchema);
