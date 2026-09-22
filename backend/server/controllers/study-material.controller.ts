import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { studyMaterialService } from "../services";
import { SystemRole } from "../constants/roles";
import { StudyMaterialStatus } from "../models/study-material.model";
import { RegistrationStatus } from "../models/semester-registration.model";
import {
  sectionRepository,
  semesterRegistrationRepository,
  studentSectionAllotmentRepository,
} from "../repositories";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

async function studentMaterialScope(req: Request) {
  const allotment = await studentSectionAllotmentRepository.findCurrentActiveForStudent(
    req.user!._id.toString(),
  );
  if (!allotment) throw createError(403, "An active class allotment is required");
  const registration = await semesterRegistrationRepository.findByStudentSemester(
    req.user!._id.toString(),
    allotment.semesterNo,
    allotment.academicYear,
  );
  if (
    !registration ||
    ![RegistrationStatus.APPROVED, RegistrationStatus.FROZEN].includes(registration.status)
  )
    throw createError(403, "Approved semester registration is required");
  return {
    sectionId: allotment.sectionId,
    subjectIds: registration.registeredSubjects.map((subject) => subject.subjectId),
  };
}

async function assertTargetSections(req: Request, rawSectionIds: unknown) {
  const sectionIds = Array.isArray(rawSectionIds) ? [...new Set(rawSectionIds.map(String))] : [];
  if (!sectionIds.length) throw createError(400, "Target sections are required");
  const [sections, scopedDepartmentId] = await Promise.all([
    sectionRepository.findRawByIds(sectionIds),
    getDepartmentScope(req),
  ]);
  if (sections.length !== sectionIds.length) throw createError(404, "Target section not found");
  if (
    scopedDepartmentId &&
    sections.some((section) => String(section.departmentId) !== scopedDepartmentId)
  )
    throw createError(403, "You can manage only your department data");
}

async function assertMaterialAccess(req: Request, material: Record<string, unknown>) {
  if (req.activeRole === SystemRole.STUDENT) {
    const scope = await studentMaterialScope(req);
    if (
      material.status !== StudyMaterialStatus.PUBLISHED ||
      !material.isActive ||
      !Array.isArray(material.sectionIds) ||
      !material.sectionIds.some((id) => String(id) === String(scope.sectionId)) ||
      !scope.subjectIds.some((id) => String(id) === String(material.subjectId))
    )
      throw createError(403, "This material is not available to your registered class");
    return;
  }
  await assertDepartmentAccess(req, material.departmentId);
  if (
    req.activeRole === SystemRole.FACULTY &&
    String(material.uploadedBy) !== req.user!._id.toString()
  )
    throw createError(403, "Faculty can access only materials they uploaded");
}

export const studyMaterialController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subjectId, departmentId, semester, materialType, status } = req.query;
      const filter: Record<string, unknown> = {};
      if (subjectId) filter.subjectId = subjectId;
      if (departmentId) filter.departmentId = departmentId;
      if (semester) filter.semester = Number(semester);
      if (materialType) filter.materialType = materialType;
      if (status) filter.status = status;
      let scopedFilter: Record<string, unknown>;
      if (req.activeRole === SystemRole.STUDENT) {
        const scope = await studentMaterialScope(req);
        scopedFilter = {
          ...filter,
          sectionIds: scope.sectionId,
          subjectId: { $in: scope.subjectIds },
          status: StudyMaterialStatus.PUBLISHED,
          isActive: true,
        };
      } else {
        scopedFilter = await applyDepartmentScope(req, filter);
        if (req.activeRole === SystemRole.FACULTY) scopedFilter.uploadedBy = req.user!._id;
      }
      const result = await studyMaterialService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      if (req.activeRole === SystemRole.STUDENT) {
        const data = result.data.map((material) => {
          const { fileUrl: _fileUrl, externalLink: _externalLink, ...metadata } = material;
          return { ...metadata, hasSource: Boolean(_fileUrl || _externalLink) };
        });
        res.json({ success: true, ...result, data });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studyMaterialService.getById(req.params.id);
      if (!data) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, data as unknown as Record<string, unknown>);
      await studyMaterialService.trackAccess(req.params.id, req.user!._id.toString(), "view");
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertTargetSections(req, req.body.sectionIds);
      const data = await studyMaterialService.create(
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await studyMaterialService.getById(req.params.id);
      if (!existing) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, existing as unknown as Record<string, unknown>);
      await assertTargetSections(req, req.body.sectionIds);
      const data = await studyMaterialService.update(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createRevision: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await studyMaterialService.getById(req.params.id);
      if (!existing) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, existing as unknown as Record<string, unknown>);
      await assertTargetSections(req, req.body.sectionIds);
      const data = await studyMaterialService.createRevision(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await studyMaterialService.getById(req.params.id);
      if (!existing) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, existing as unknown as Record<string, unknown>);
      const ownerId = req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      const data = await studyMaterialService.publish(req.params.id, ownerId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  archive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await studyMaterialService.getById(req.params.id);
      if (!existing) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, existing as unknown as Record<string, unknown>);
      const ownerId = req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      const data = await studyMaterialService.archive(
        req.params.id,
        req.user!._id.toString(),
        ownerId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await studyMaterialService.getById(req.params.id);
      if (!existing) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, existing as unknown as Record<string, unknown>);
      const ownerId = req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      await studyMaterialService.delete(req.params.id, ownerId);
      res.json({ success: true, message: "Unused draft deleted" });
    } catch (err) {
      next(err);
    }
  },

  trackDownload: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await studyMaterialService.getById(req.params.id);
      if (!material) throw createError(404, "Study material not found");
      await assertMaterialAccess(req, material as unknown as Record<string, unknown>);
      await studyMaterialService.trackAccess(req.params.id, req.user!._id.toString(), "download");
      const url =
        material.materialType === "link"
          ? material.externalLink
          : (material.fileUrl ?? material.externalLink);
      if (!url) throw createError(409, "Material source is unavailable");
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },
};
