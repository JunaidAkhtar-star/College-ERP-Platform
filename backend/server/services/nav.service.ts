/**
 * @file nav.service.ts
 * @description Builds the role-filtered sidebar navigation tree for a given
 *   user. Resolves gates (e.g. chat access) before returning so blocked
 *   students never see entries they cannot use. Also provides CRUD for the
 *   admin console.
 */

import { Types } from "mongoose";
import createError from "http-errors";
import type { INavItem, NavGate } from "../models/nav-item.model";
import { NavItemModel } from "../models/nav-item.model";
import { UserModel } from "../models/user.model";
import { RoleModel } from "../models/role.model";
import { canonicalEntitlementSlug, entitlementForNavHref } from "../constants/module-entitlements";
import { permissionModulesForNavHref } from "../constants/route-permissions";
import { PermissionAction, type IPermission } from "../constants/permissions";

export interface INavLinkDto {
  _id: string;
  label: string;
  href: string;
  icon?: string;
  requiredRoles: string[];
  gate?: NavGate;
  sortOrder: number;
}

export interface INavGroupDto {
  _id: string;
  group: string;
  sortOrder: number;
  items: INavLinkDto[];
}

const ALL_ACTIVE_FILTER = { isActive: true };
const NAV_EDITABLE_FIELDS = new Set([
  "kind",
  "label",
  "roleLabels",
  "href",
  "icon",
  "parentId",
  "requiredRoles",
  "gate",
  "sortOrder",
  "isActive",
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickEditable(data: Partial<INavItem>): Partial<INavItem> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => NAV_EDITABLE_FIELDS.has(key)),
  ) as Partial<INavItem>;
}

async function validateNavItem(
  data: Partial<INavItem>,
  editingId?: string,
): Promise<Partial<INavItem>> {
  const kind = data.kind;
  const label = data.label?.trim();
  if (kind !== "group" && kind !== "link") throw createError(400, "Choose a valid menu item type.");
  if (!label) throw createError(400, "A user-facing menu label is required.");

  const normalized: Partial<INavItem> = {
    ...pickEditable(data),
    kind,
    label,
    requiredRoles: [...new Set(data.requiredRoles ?? [])],
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    isActive: data.isActive !== false,
  };

  if (normalized.requiredRoles?.length) {
    const validRoleCount = await RoleModel.countDocuments({
      name: { $in: normalized.requiredRoles },
      isActive: true,
    });
    if (validRoleCount !== normalized.requiredRoles.length) {
      throw createError(400, "One or more selected roles are no longer active.");
    }
  }

  if (kind === "group") {
    normalized.parentId = null;
    normalized.href = undefined;
    normalized.icon = undefined;
    normalized.gate = undefined;
  } else {
    const href = data.href?.trim();
    if (!href || !/^\/[a-z0-9][a-z0-9/_-]*$/i.test(href)) {
      throw createError(400, "Enter a valid internal page path beginning with /.");
    }
    if (!data.parentId || !Types.ObjectId.isValid(String(data.parentId))) {
      throw createError(400, "Choose the menu group where this page should appear.");
    }
    const parent = await NavItemModel.findOne({ _id: data.parentId, kind: "group" }).select("_id");
    if (!parent) throw createError(400, "The selected menu group no longer exists.");
    normalized.parentId = parent._id;
    normalized.href = href;
    normalized.icon = data.icon?.trim() || undefined;
  }

  const duplicateConditions: Array<Record<string, object | string | null>> = [
    {
      kind,
      parentId: kind === "group" ? null : (normalized.parentId as unknown as object),
      label: { $regex: `^${escapeRegex(label)}$`, $options: "i" },
    },
  ];
  if (kind === "link" && normalized.href) {
    duplicateConditions.push({
      kind: "link",
      href: { $regex: `^${escapeRegex(normalized.href)}$`, $options: "i" },
    });
  }
  const duplicate = await NavItemModel.exists({
    ...(editingId ? { _id: { $ne: editingId } } : {}),
    $or: duplicateConditions,
  });
  if (duplicate) throw createError(409, "This menu label or page path is already in use.");
  return normalized;
}

async function fetchUserRoles(userId: string): Promise<string[]> {
  const user = await UserModel.findById(userId).select("roles");
  return (user?.roles as string[] | undefined) ?? [];
}

function hasRole(userRoles: string[], required: string[]): boolean {
  if (!required.length) return true;
  return userRoles.some((r) => required.includes(r));
}

function resolveRoleLabel(item: INavItem, activeRole?: string): string {
  if (!activeRole) return item.label;
  const normalizedRole = activeRole.toLowerCase();
  if (item.roleLabels && typeof item.roleLabels === "object") {
    const custom = item.roleLabels[normalizedRole] || item.roleLabels[activeRole];
    if (custom && typeof custom === "string" && custom.trim().length > 0) {
      return custom.trim();
    }
  }
  return item.label;
}

/**
 * Resolve the set of NavItem ids the role is allowed to see.
 * - If the active role doc or user token has `allowedNavItems`, use that.
 * - Auto-include parent group ObjectIds for any allowed link ObjectIds.
 * - Else fall back to legacy role-name match against `nav.requiredRoles`.
 */
async function resolveAllowedNavIds(
  activeRole: string | undefined,
  allowedNavItems: string[] | undefined,
): Promise<Set<string> | null> {
  const allowedIds = new Set(allowedNavItems ?? []);

  // If no allowed items provided in req, try fetching from the Role model
  if (allowedIds.size === 0 && activeRole) {
    const roleDoc = await RoleModel.findOne({ name: activeRole.toLowerCase() })
      .select("allowedNavItems")
      .lean()
      .exec();
    const storedIds = (roleDoc?.allowedNavItems ?? []) as unknown as Types.ObjectId[];
    storedIds.forEach((id) => allowedIds.add(String(id)));
  }

  // Fallback to roleDefaults ONLY if no explicit allowedNavItems are configured for this role
  if (allowedIds.size === 0 && activeRole) {
    const roleDefaults = await NavItemModel.find({ isActive: true, requiredRoles: activeRole })
      .select("_id")
      .lean()
      .exec();
    roleDefaults.forEach((item) => allowedIds.add(String(item._id)));
  }

  if (allowedIds.size === 0) return null; // fall back to legacy role matching

  // Ensure parent groups of allowed links are also in allowedIds
  const links = await NavItemModel.find({
    _id: { $in: Array.from(allowedIds).map((id) => new Types.ObjectId(id)) },
    kind: "link",
    parentId: { $ne: null },
  })
    .select("parentId")
    .lean()
    .exec();

  links.forEach((l) => {
    if (l.parentId) allowedIds.add(String(l.parentId));
  });

  return allowedIds;
}

export const navService = {
  // ── Read: full tree (admin console) ───────────────────────────────────────
  async list(): Promise<INavItem[]> {
    return NavItemModel.find().sort({ kind: 1, sortOrder: 1, label: 1 });
  },

  // ── Read: role-filtered tree for current user ────────────────────────────
  async getForUser(
    userId: string,
    activeRole?: string,
    allowedNavItems?: string[],
    permissions?: IPermission[],
    enabledModuleSlugs?: string[],
    entitlementEnforced = false,
  ): Promise<INavGroupDto[]> {
    const userRoles = await fetchUserRoles(userId);
    const authorizationRoles = activeRole ? [activeRole] : userRoles;
    const allowedIds = await resolveAllowedNavIds(activeRole, allowedNavItems);

    const [groups, links] = await Promise.all([
      NavItemModel.find({ ...ALL_ACTIVE_FILTER, kind: "group" }).sort({ sortOrder: 1 }),
      NavItemModel.find({ ...ALL_ACTIVE_FILTER, kind: "link" }).sort({ sortOrder: 1 }),
    ]);

    const isExplicitlyAllowed = (item: INavItem): boolean =>
      !allowedIds || allowedIds.has(String(item._id));

    const groupDtos: INavGroupDto[] = [];
    for (const g of groups) {
      if (!isExplicitlyAllowed(g)) continue;
      const items: INavLinkDto[] = [];
      for (const l of links) {
        if (!l.parentId || String(l.parentId) !== String(g._id)) continue;
        if (!l.href) continue;
        if (!isExplicitlyAllowed(l)) continue;
        const permissionModules = permissionModulesForNavHref(l.href);
        if (
          !allowedIds &&
          permissionModules.length === 0 &&
          !hasRole(authorizationRoles, l.requiredRoles)
        )
          continue;
        if (
          permissionModules.length > 0 &&
          !permissionModules.some((module) =>
            (permissions ?? []).some(
              (permission) =>
                permission.module === module && permission.actions.includes(PermissionAction.VIEW),
            ),
          )
        )
          continue;
        const requiredModule = entitlementForNavHref(l.href);
        if (
          requiredModule &&
          entitlementEnforced &&
          !(enabledModuleSlugs ?? [])
            .map(canonicalEntitlementSlug)
            .includes(canonicalEntitlementSlug(requiredModule))
        ) {
          continue;
        }

        const resolvedLabel = resolveRoleLabel(l, activeRole);
        items.push({
          _id: String(l._id),
          label: resolvedLabel,
          href: l.href,
          icon: l.icon,
          requiredRoles: l.requiredRoles,
          gate: l.gate,
          sortOrder: l.sortOrder,
        });
      }
      if (!items.length) continue;

      const resolvedGroupTitle = resolveRoleLabel(g, activeRole);
      groupDtos.push({
        _id: String(g._id),
        group: resolvedGroupTitle,
        sortOrder: g.sortOrder,
        items,
      });
    }
    return groupDtos;
  },

  // ── Admin CRUD ───────────────────────────────────────────────────────────
  async create(data: Partial<INavItem>): Promise<INavItem> {
    const normalized = await validateNavItem(data);
    return NavItemModel.create(normalized);
  },

  async update(id: string, data: Partial<INavItem>): Promise<INavItem | null> {
    if (!Types.ObjectId.isValid(id)) throw createError(400, "Invalid navigation item.");
    const existing = await NavItemModel.findById(id).lean();
    if (!existing) throw createError(404, "Navigation item not found.");
    const normalized = await validateNavItem(
      { ...existing, ...pickEditable(data) } as Partial<INavItem>,
      id,
    );
    return NavItemModel.findByIdAndUpdate(id, normalized, {
      returnDocument: "after",
      runValidators: true,
    });
  },

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw createError(400, "Invalid navigation item.");
    const _id = new Types.ObjectId(id);
    // Deleting a group cascades to its links.
    await NavItemModel.deleteMany({ $or: [{ _id }, { parentId: _id }] });
  },

  async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
    if (
      !Array.isArray(items) ||
      !items.length ||
      items.some(
        (item) =>
          !Types.ObjectId.isValid(item.id) ||
          !Number.isInteger(item.sortOrder) ||
          item.sortOrder < 0,
      )
    ) {
      throw createError(400, "Navigation order contains an invalid item.");
    }
    await Promise.all(
      items.map((i) => NavItemModel.updateOne({ _id: i.id }, { $set: { sortOrder: i.sortOrder } })),
    );
  },
};
