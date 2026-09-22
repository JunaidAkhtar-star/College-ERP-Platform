import type { Request, Response, NextFunction } from "express";
import { timetableService } from "../services";
import { SystemRole } from "../constants/roles";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";
import { parentService } from "../services/parent.service";
import { studentProfileRepository, studentSectionAllotmentRepository } from "../repositories";

async function timetableViewerFilter(req: Request): Promise<Record<string, unknown>> {
  if (req.activeRole === SystemRole.FACULTY) {
    return { "slots.facultyId": req.user!._id };
  }
  if (req.activeRole === SystemRole.STUDENT || req.activeRole === SystemRole.PARENT) {
    const studentId =
      req.activeRole === SystemRole.STUDENT
        ? req.user!._id.toString()
        : String((await parentService.getWard(req.user!._id.toString())).userId ?? "");
    const allotment =
      await studentSectionAllotmentRepository.findCurrentActiveForStudent(studentId);
    if (!allotment) {
      const profile = await studentProfileRepository.findByUserId(studentId);
      const department = profile?.department as unknown as { _id?: unknown } | undefined;
      if (!profile || !department?._id) return { _id: { $exists: false } };
      return {
        sectionId: { $exists: false },
        academicYear: profile.academicYear,
        program: profile.program,
        semester: profile.currentSemester,
        departmentId: department._id,
      };
    }
    return { sectionId: allotment.sectionId };
  }
  return {};
}

async function applyTimetableDepartmentVisibility(
  req: Request,
  filter: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) return filter;

  const requestedDepartmentId = filter["departmentId"];
  if (requestedDepartmentId && String(requestedDepartmentId) !== departmentId) {
    const error = new Error("You can access only your department data") as Error & {
      status?: number;
    };
    error.status = 403;
    throw error;
  }

  const { departmentId: _requestedDepartmentId, ...baseFilter } = filter;
  return {
    $and: [
      baseFilter,
      {
        $or: [{ departmentId }, { branchDepartmentIds: departmentId }],
      },
    ],
  };
}

async function assertTimetableDepartmentVisibility(
  req: Request,
  data: Record<string, unknown>,
): Promise<void> {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) return;

  const primaryDepartmentId = String(data["departmentId"] ?? "");
  const participatingDepartmentIds = (
    (data["branchDepartmentIds"] as unknown[] | undefined) ?? []
  ).map(String);
  if (primaryDepartmentId !== departmentId && !participatingDepartmentIds.includes(departmentId)) {
    const error = new Error("Not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }
}

async function assertTimetableViewerAccess(req: Request, data: Record<string, unknown>) {
  const viewerFilter = await timetableViewerFilter(req);
  if (viewerFilter["slots.facultyId"]) {
    const facultyId = String(viewerFilter["slots.facultyId"]);
    const slots = (data["slots"] ?? []) as Array<{ facultyId?: unknown }>;
    if (!slots.some((slot) => String(slot.facultyId) === facultyId)) {
      const error = new Error("Not found") as Error & { status?: number };
      error.status = 404;
      throw error;
    }
  }
  const sectionFilter = viewerFilter["sectionId"];
  const requiresNoSection =
    typeof sectionFilter === "object" &&
    sectionFilter !== null &&
    (sectionFilter as Record<string, unknown>)["$exists"] === false;
  const wrongSection =
    Boolean(sectionFilter) &&
    (requiresNoSection
      ? Boolean(data["sectionId"])
      : String(data["sectionId"]) !== String(sectionFilter));
  const wrongAcademicScope = ["academicYear", "program", "semester", "departmentId"].some(
    (field) => viewerFilter[field] && String(data[field]) !== String(viewerFilter[field]),
  );
  if (wrongSection || wrongAcademicScope) {
    const error = new Error("Not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }
}

export const timetableController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        academicYear,
        semesterType,
        curriculumId,
        departmentId,
        semester,
        section,
        sectionId,
      } = req.query;
      const filter: Record<string, unknown> = {};
      if (sectionId) filter.sectionId = sectionId;
      if (academicYear) filter.academicYear = academicYear;
      if (semesterType) filter.semesterType = semesterType;
      if (curriculumId) filter.curriculumId = curriculumId;
      if (departmentId) filter.departmentId = departmentId;
      if (semester) filter.semester = Number(semester);
      if (section) filter.section = section;
      const canViewDrafts = [
        SystemRole.SUPER_ADMIN,
        SystemRole.ADMIN,
        SystemRole.PRINCIPAL,
        SystemRole.DEAN_ACADEMIC,
        SystemRole.HOD,
      ].includes(req.activeRole as SystemRole);
      if (!canViewDrafts) {
        filter.isApproved = true;
        filter.isActive = true;
      }
      const scopedFilter = await applyTimetableDepartmentVisibility(req, {
        ...filter,
        ...(await timetableViewerFilter(req)),
      });
      const result = await timetableService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      await assertTimetableDepartmentVisibility(req, data as unknown as Record<string, unknown>);
      await assertTimetableViewerAccess(req, data as unknown as Record<string, unknown>);
      const canViewDrafts = [
        SystemRole.SUPER_ADMIN,
        SystemRole.ADMIN,
        SystemRole.PRINCIPAL,
        SystemRole.DEAN_ACADEMIC,
        SystemRole.HOD,
      ].includes(req.activeRole as SystemRole);
      if (!canViewDrafts && (!data.isApproved || !data.isActive)) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getForClass: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, semesterType, departmentId, semester, section, sectionId } = req.query;
      const viewerFilter = await timetableViewerFilter(req);
      if (viewerFilter["sectionId"]) {
        if (sectionId && String(sectionId) !== String(viewerFilter["sectionId"])) {
          res
            .status(403)
            .json({ success: false, message: "You can view only your class timetable" });
          return;
        }
      }
      const scopedFilter = await applyDepartmentScope(req, {
        ...(departmentId ? { departmentId } : {}),
      });
      const data = await timetableService.getForClass(
        academicYear as string,
        semesterType as string,
        scopedFilter["departmentId"] as string,
        Number(semester),
        section as string,
        (viewerFilter["sectionId"] as string | undefined) ?? (sectionId as string | undefined),
        ![
          SystemRole.SUPER_ADMIN,
          SystemRole.ADMIN,
          SystemRole.PRINCIPAL,
          SystemRole.DEAN_ACADEMIC,
          SystemRole.HOD,
        ].includes(req.activeRole as SystemRole),
      );
      if (data) await assertTimetableViewerAccess(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getFacultyTimetable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, academicYear, semesterType } = req.query;
      const resolvedFacultyId =
        req.activeRole === SystemRole.FACULTY
          ? req.user?._id.toString()
          : ((facultyId as string | undefined) ?? req.user?._id.toString());
      const data = await timetableService.getFacultyTimetable(
        resolvedFacultyId || "",
        academicYear as string,
        semesterType as string,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      const data = await timetableService.create(
        { ...req.body, createdBy: req.user!._id },
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.createBatch(
        { ...req.body, createdBy: req.user!._id },
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data, count: data.length });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.update(
        req.params.id,
        req.body,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updatePublicationDetails: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.updatePublicationDetails(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.delete(req.params.id, await getDepartmentScope(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.approve(
        req.params.id,
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  validateForPublish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.validateForPublish(
        req.params.id,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  archive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.archive(
        req.params.id,
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  assignSubstitute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slotIndex, substituteFacultyId, date, reason } = req.body;
      const data = await timetableService.assignSubstitute(
        req.params.id,
        Number(slotIndex),
        substituteFacultyId,
        date,
        reason ?? "",
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancelSubstitute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.cancelSubstitute(
        req.params.id,
        req.params.substituteEntryId,
        String(req.body.reason ?? ""),
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listClassOperations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.listClassOperations(
        req.params.id,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createExtraClass: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.createExtraClass(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancelExtraClass: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await timetableService.cancelExtraClass(
        req.params.id,
        req.params.operationId,
        String(req.body.reason ?? ""),
        req.user!._id.toString(),
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
