import createError from "http-errors";
import { roleRepository } from "../repositories/role.repository";
import type { IRole } from "../models/role.model";
import type { SystemRole } from "../constants/roles";
import { UserModel } from "../models/user.model";

/** Fields a Super Admin may edit on a system role (everything else is locked). */
const SYSTEM_ROLE_EDITABLE_FIELDS = new Set([
  "displayName",
  "description",
  "permissions",
  "allowedNavItems",
  "isActive",
]);
const CUSTOM_ROLE_EDITABLE_FIELDS = new Set([
  "displayName",
  "description",
  "permissions",
  "allowedNavItems",
  "isActive",
]);

async function revokeSessionsForRole(role: IRole) {
  const filter = role.isSystem ? { roles: role.baseRole } : { customRoleIds: role._id };
  await UserModel.updateMany(filter, { $set: { activeSessions: [] } }).exec();
}

function validatePermissions(permissions: unknown[]) {
  for (const entry of permissions) {
    if (!entry || typeof entry !== "object") throw createError(400, "Invalid permission entry");
    const permission = entry as { module?: unknown; actions?: unknown };
    if (
      typeof permission.module !== "string" ||
      !/^[a-z0-9_]+$/.test(permission.module) ||
      !Array.isArray(permission.actions)
    )
      throw createError(400, "Every permission requires a valid module and action list");
    const actions = permission.actions.map(String);
    const elevated = actions.some((action) =>
      ["create", "edit", "delete", "approve", "export"].includes(action),
    );
    if (elevated && !actions.includes("view"))
      throw createError(
        400,
        `Permission conflict: '${permission.module}' requires view access before elevated actions`,
      );
  }
  return permissions;
}

export const roleService = {
  create: async (data: {
    name?: string;
    displayName: string;
    description?: string;
    baseRole: SystemRole;
    permissions?: unknown[];
    allowedNavItems?: string[];
    createdBy: string;
  }) => {
    // Auto-derive the role key (slug) from displayName if the client didn't send one.
    // Slug rule: lowercase, spaces → underscore, strip any non [a-z0-9_].
    const slugify = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    let name = (data.name ?? "").trim() || slugify(data.displayName);
    if (!name) throw createError(400, "Could not derive role key from display name");

    // Ensure uniqueness — append a numeric suffix if a role with the same key exists.
    let attempt = name;
    let i = 2;
    while (await roleRepository.findByName(attempt)) {
      attempt = `${name}_${i++}`;
      if (i > 100) throw createError(409, `Role '${name}' already exists`);
    }
    name = attempt;

    if (!data.baseRole) throw createError(400, "A base system role is required");
    return roleRepository.create({
      ...data,
      permissions: validatePermissions(data.permissions ?? []),
      name,
      isSystem: false,
      isActive: true,
    });
  },

  getAll: async (includeInactive = false, query?: Record<string, unknown>) => {
    const filter = includeInactive ? {} : { isActive: true };

    let roles: IRole[];
    let paginationInfo: unknown;

    if (query && (query.page || query.limit)) {
      const paginated = await roleRepository.paginate(filter, query);
      roles = paginated.data;
      paginationInfo = paginated.pagination;
    } else {
      roles = await roleRepository.findAll(filter);
    }

    const [systemCounts, customCounts] = await Promise.all([
      UserModel.aggregate<{ _id: string; count: number }>([
        { $unwind: "$roles" },
        { $group: { _id: "$roles", count: { $sum: 1 } } },
      ]),
      UserModel.aggregate<{ _id: import("mongoose").Types.ObjectId; count: number }>([
        { $unwind: "$customRoleIds" },
        { $group: { _id: "$customRoleIds", count: { $sum: 1 } } },
      ]),
    ]);
    const systemCountMap = new Map(systemCounts.map((item) => [item._id, item.count]));
    const customCountMap = new Map(customCounts.map((item) => [String(item._id), item.count]));
    const data = roles.map((role) => ({
      ...role,
      baseRole: role.baseRole ?? role.name,
      usersCount: role.isSystem
        ? (systemCountMap.get(role.name) ?? 0)
        : (customCountMap.get(String(role._id)) ?? 0),
    }));

    if (paginationInfo) {
      return { data, pagination: paginationInfo };
    }
    return data;
  },

  getById: async (id: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    return role;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    const typedRole = role as unknown as IRole;
    if (typedRole.isSystem) {
      const requested = Object.keys(data);
      const illegal = requested.filter((k) => !SYSTEM_ROLE_EDITABLE_FIELDS.has(k));
      if (illegal.length) {
        throw createError(
          403,
          `System role fields are locked: ${illegal.join(", ")}. Only ${[...SYSTEM_ROLE_EDITABLE_FIELDS].join(", ")} may be edited.`,
        );
      }
    } else {
      const illegal = Object.keys(data).filter((key) => !CUSTOM_ROLE_EDITABLE_FIELDS.has(key));
      if (illegal.length)
        throw createError(403, `Custom role fields are locked: ${illegal.join(", ")}`);
    }
    const updated = await roleRepository.update(id, data);
    await revokeSessionsForRole(typedRole);
    return updated;
  },

  updatePermissions: async (id: string, permissions: unknown[]) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    const updated = await roleRepository.update(id, {
      permissions: validatePermissions(permissions),
    });
    await revokeSessionsForRole(role as unknown as IRole);
    return updated;
  },

  updateNavItems: async (id: string, allowedNavItems: string[]) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    const updated = await roleRepository.update(id, { allowedNavItems });
    await revokeSessionsForRole(role as unknown as IRole);
    return updated;
  },

  delete: async (id: string, deletedBy: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    const typedRole = role as unknown as IRole;
    if (typedRole.isSystem) throw createError(403, "System roles cannot be deleted");
    await revokeSessionsForRole(typedRole);
    await UserModel.updateMany(
      { customRoleIds: typedRole._id },
      { $pull: { customRoleIds: typedRole._id } },
    ).exec();
    return roleRepository.delete(id, deletedBy);
  },

  toggleActive: async (id: string) => {
    const role = await roleRepository.findById(id);
    if (!role) throw createError(404, "Role not found");
    const typedRole = role as unknown as IRole;
    if (typedRole.isSystem) throw createError(403, "System roles cannot be deactivated");
    const updated = await roleRepository.update(id, { isActive: !typedRole.isActive });
    await revokeSessionsForRole(typedRole);
    return updated;
  },

  assignToUser: async (roleId: string, userId: string, assigned: boolean) => {
    const role = await roleRepository.findById(roleId);
    if (!role || role.isActive === false) throw createError(404, "Active role not found");
    const typedRole = role as unknown as IRole;
    if (typedRole.isSystem)
      throw createError(400, "System roles are assigned through the user's system roles");

    const user = await UserModel.findById(userId).select("roles customRoleIds").lean().exec();
    if (!user) throw createError(404, "User not found");
    if (!user.roles.includes(typedRole.baseRole)) {
      throw createError(
        409,
        `User must hold the '${typedRole.baseRole}' base role before this custom role can be assigned`,
      );
    }

    await UserModel.updateOne(
      { _id: userId },
      {
        [assigned ? "$addToSet" : "$pull"]: { customRoleIds: typedRole._id },
        // Role authority changed: revoke all sessions so stale permissions
        // cannot survive until access-token expiry.
        $set: { activeSessions: [] },
      },
    ).exec();
    return { roleId, userId, assigned };
  },
};
