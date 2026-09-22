import type { Request } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { facultyProfileRepository } from "../repositories";

const DEPARTMENT_SCOPED_ROLES = new Set<SystemRole>([SystemRole.HOD, SystemRole.FACULTY]);

function idOf(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return (
    (value as { _id?: { toString(): string }; toString?: () => string })._id?.toString() ||
    (value as { toString?: () => string }).toString?.() ||
    ""
  );
}

export async function getDepartmentScope(req: Request): Promise<string | undefined> {
  const role = req.activeRole as SystemRole | undefined;
  if (!role || !DEPARTMENT_SCOPED_ROLES.has(role)) {
    return undefined;
  }

  const userDepartment = idOf(req.user?.department);
  if (userDepartment) {
    return userDepartment;
  }

  const profile = await facultyProfileRepository.findByUserId(req.user?._id.toString() || "");
  const profileDepartment = idOf(profile?.department);
  if (profileDepartment) {
    return profileDepartment;
  }

  throw createError(403, "Department ownership is required for this role");
}

export async function applyDepartmentScope(
  req: Request,
  filter: Record<string, unknown>,
  field = "departmentId",
): Promise<Record<string, unknown>> {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) {
    return filter;
  }
  const requestedScope = filter[field];
  if (requestedScope) {
    const requestedIds =
      typeof requestedScope === "object" &&
      requestedScope !== null &&
      "$in" in requestedScope &&
      Array.isArray((requestedScope as { $in?: unknown[] }).$in)
        ? (requestedScope as { $in: unknown[] }).$in.map(idOf)
        : [idOf(requestedScope)];
    if (!requestedIds.includes(departmentId)) {
      throw createError(403, "You can access only your department data");
    }
  }
  return { ...filter, [field]: departmentId };
}

export async function assertDepartmentAccess(req: Request, departmentId?: unknown): Promise<void> {
  const scopedDepartmentId = await getDepartmentScope(req);
  if (!scopedDepartmentId) {
    return;
  }
  if (!departmentId || idOf(departmentId) !== scopedDepartmentId) {
    throw createError(403, "You can manage only your department data");
  }
}
