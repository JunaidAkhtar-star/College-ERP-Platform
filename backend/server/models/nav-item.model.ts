/**
 * @file nav-item.model.ts
 * @description Sidebar navigation items stored in the database so an admin
 *   can manage menu structure, visibility, and ordering without a code
 *   deploy. A flat list — group rows have `kind: 'group'` and serve as the
 *   `parentId` for `kind: 'link'` rows.
 *
 *   `requiredRoles` is a string array matching `TSystemRole` values. Empty
 *   array means "visible to everyone".
 *
 *   `gate` is an optional named guard the backend resolves before deciding
 *   visibility. Currently supported: `'chat'` (hidden if ChatAccessPolicy
 *   denies the user).
 */

import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type NavItemKind = "group" | "link";
export type NavGate = "chat";

export interface INavItem extends Document {
  kind: NavItemKind;
  label: string;
  roleLabels?: Record<string, string>;
  href?: string; // required when kind === 'link'
  icon?: string; // Lucide icon name (resolved client-side)
  parentId?: Types.ObjectId | null; // null for groups
  requiredRoles: string[];
  gate?: NavGate;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NavItemSchema = new Schema<INavItem>(
  {
    kind: { type: String, enum: ["group", "link"], required: true, index: true },
    label: { type: String, required: true, trim: true },
    roleLabels: { type: Schema.Types.Mixed, default: {} },
    href: { type: String, trim: true },
    icon: { type: String, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "NavItem", default: null, index: true },
    requiredRoles: { type: [String], default: [] },
    gate: { type: String, enum: ["chat"], default: undefined },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

NavItemSchema.plugin(auditPlugin);

// Ordering: sort groups by sortOrder, then items inside each group by sortOrder.
NavItemSchema.index({ parentId: 1, sortOrder: 1 });

export const NavItemModel = mongoose.model<INavItem>("NavItem", NavItemSchema);
