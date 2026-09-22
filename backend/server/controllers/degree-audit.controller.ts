import type { RequestHandler } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { degreeAuditService } from "../services/degree-audit.service";
import { assertDepartmentAccess } from "../utils/ownership.util";
import { responseUtil } from "../utils/response.util";
import { MentorModel, StudentProfileModel } from "../models";

const isStudent = (role?: string) => role === SystemRole.STUDENT;

async function ownedProfileId(userId: string): Promise<string> {
  const profile = await degreeAuditService.profileForUser(userId);
  return profile._id.toString();
}

async function assertDegreeAuditAccess(
  req: Parameters<RequestHandler>[0],
  studentProfileId: string,
  departmentId?: unknown,
): Promise<void> {
  await assertDepartmentAccess(req, departmentId);
  if (req.activeRole !== SystemRole.FACULTY) return;

  const profile = await StudentProfileModel.findById(studentProfileId)
    .select("userId mentor")
    .lean();
  if (!profile) throw createError(404, "Student profile not found");
  const facultyId = req.user!._id.toString();
  const directlyAssigned = String(profile.mentor ?? "") === facultyId;
  const activeAssignment = directlyAssigned
    ? true
    : Boolean(
        await MentorModel.exists({
          facultyId,
          menteeIds: profile.userId,
          isActive: true,
        }),
      );
  if (!activeAssignment) {
    throw createError(403, "Faculty can access degree audits only for their assigned advisees");
  }
}

export const degreeAuditController: Record<string, RequestHandler> = {
  async mine(req, res, next) {
    try {
      responseUtil.success(
        res,
        await degreeAuditService.audit(await ownedProfileId(req.user!._id.toString())),
      );
    } catch (error) {
      next(error);
    }
  },

  async student(req, res, next) {
    try {
      const data = await degreeAuditService.audit(req.params.studentProfileId!);
      await assertDegreeAuditAccess(req, req.params.studentProfileId!, data.student.departmentId);
      responseUtil.success(res, data);
    } catch (error) {
      next(error);
    }
  },

  async savePlan(req, res, next) {
    try {
      const requested = req.params.studentProfileId!;
      const studentProfileId = isStudent(req.activeRole)
        ? await ownedProfileId(req.user!._id.toString())
        : requested;
      if (!studentProfileId) throw createError(400, "Student profile is required");
      if (!isStudent(req.activeRole)) {
        const audit = await degreeAuditService.audit(studentProfileId);
        await assertDegreeAuditAccess(req, studentProfileId, audit.student.departmentId);
      }
      const data = await degreeAuditService.savePlan(
        studentProfileId,
        req.user!._id.toString(),
        req.body,
      );
      responseUtil.success(
        res,
        data,
        req.body.submit ? "Academic plan submitted" : "Academic plan saved",
      );
    } catch (error) {
      next(error);
    }
  },

  async reviewPlan(req, res, next) {
    try {
      const audit = await degreeAuditService.audit(req.params.studentProfileId!);
      await assertDepartmentAccess(req, audit.student.departmentId);
      const data = await degreeAuditService.reviewPlan(
        req.params.studentProfileId!,
        req.user!._id.toString(),
        req.body.decision,
        req.body.remarks,
      );
      responseUtil.success(res, data, "Academic plan reviewed");
    } catch (error) {
      next(error);
    }
  },

  async createTransfer(req, res, next) {
    try {
      const studentProfileId = isStudent(req.activeRole)
        ? await ownedProfileId(req.user!._id.toString())
        : req.body.studentProfileId;
      const audit = await degreeAuditService.audit(studentProfileId);
      if (!isStudent(req.activeRole)) {
        await assertDegreeAuditAccess(req, studentProfileId, audit.student.departmentId);
      }
      const data = await degreeAuditService.createTransferEvaluation(req.user!._id.toString(), {
        ...req.body,
        studentProfileId,
      });
      responseUtil.created(res, data, "Transfer-credit evaluation saved");
    } catch (error) {
      next(error);
    }
  },

  async reviewTransfer(req, res, next) {
    try {
      const evaluation = await degreeAuditService.transferById(req.params.id!);
      const audit = await degreeAuditService.audit(evaluation.studentProfileId.toString());
      await assertDepartmentAccess(req, audit.student.departmentId);
      const data = await degreeAuditService.reviewTransferEvaluation(
        req.params.id!,
        req.user!._id.toString(),
        req.body,
      );
      responseUtil.success(res, data, "Transfer-credit evaluation reviewed");
    } catch (error) {
      next(error);
    }
  },
};
