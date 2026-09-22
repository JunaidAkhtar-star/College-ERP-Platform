import type { Request } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { CampusUserAssignmentModel } from "../models/campus-governance.model";
import { DepartmentModel } from "../models/department.model";

const GLOBAL = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
]);

export async function getCampusScope(req: Request): Promise<string[] | null> {
  const role = req.activeRole as SystemRole | undefined;
  const requested = String(req.headers["x-campus-id"] ?? "").trim();
  if (role && GLOBAL.has(role)) return requested ? [requested] : null;
  const now = new Date();
  const assignments = await CampusUserAssignmentModel.find({
    userId: req.user?._id,
    status: "active",
    startsAt: { $lte: now },
    $or: [{ endsAt: { $exists: false } }, { endsAt: { $gte: now } }],
  })
    .select("campusId")
    .lean();
  const ids = new Set(assignments.map((row) => String(row.campusId)));
  if (req.user?.department) {
    const department = await DepartmentModel.findById(req.user.department)
      .select("campusId")
      .lean();
    if (department?.campusId) ids.add(String(department.campusId));
  }
  if (!ids.size) throw createError(403, "A campus assignment is required for this role");
  if (requested && !ids.has(requested))
    throw createError(403, "You cannot access the requested campus");
  return requested ? [requested] : [...ids];
}

export async function assertCampusAccess(req: Request, campusId: unknown): Promise<void> {
  const scope = await getCampusScope(req);
  if (scope === null) return;
  if (!campusId || !scope.includes(String(campusId)))
    throw createError(403, "You can manage only assigned campus data");
}

export async function applyCampusScope(
  req: Request,
  filter: Record<string, unknown>,
  field = "campusId",
) {
  const scope = await getCampusScope(req);
  if (scope === null) return filter;
  if (filter[field] && !scope.includes(String(filter[field])))
    throw createError(403, "You cannot access the requested campus");
  return { ...filter, [field]: filter[field] ?? { $in: scope } };
}
