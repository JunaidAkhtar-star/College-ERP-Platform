import type { RequestHandler } from "express";
import { lmsIntegrationService } from "../services/lms-integration.service";
import { assertDepartmentAccess } from "../utils/ownership.util";
import { responseUtil } from "../utils/response.util";
import { auditLogRepository } from "../repositories/audit-log.repository";

const audit = (
  req: Parameters<RequestHandler>[0],
  action: string,
  description: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) =>
  auditLogRepository.create({
    user: req.user,
    action,
    module: "lms_integration",
    targetId,
    targetModel: "LmsIntegrationProfile",
    description,
    metadata,
    req,
  });

async function assertProfileAccess(req: Parameters<RequestHandler>[0], id: string) {
  const profile = await lmsIntegrationService.scope(id);
  for (const departmentId of profile.departmentIds) await assertDepartmentAccess(req, departmentId);
  return profile;
}

export const lmsIntegrationController: Record<string, RequestHandler> = {
  async metadata(_req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.metadata());
    } catch (error) {
      next(error);
    }
  },
  async profiles(_req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.listProfiles());
    } catch (error) {
      next(error);
    }
  },
  async save(req, res, next) {
    try {
      for (const departmentId of req.body.departmentIds ?? [])
        await assertDepartmentAccess(req, departmentId);
      if (req.params.id) await assertProfileAccess(req, req.params.id);
      const data = await lmsIntegrationService.saveProfile(
        req.user!._id.toString(),
        req.body,
        req.params.id,
      );
      await audit(
        req,
        req.params.id ? "LMS_PROFILE_UPDATED" : "LMS_PROFILE_CREATED",
        `${req.params.id ? "Updated" : "Created"} LMS integration profile ${req.body.name}`,
        String(data?._id),
        { provider: data?.provider, enabled: data?.enabled },
      );
      req.params.id
        ? responseUtil.success(res, data, "LMS profile updated")
        : responseUtil.created(res, data, "LMS profile created");
    } catch (error) {
      next(error);
    }
  },
  async runs(req, res, next) {
    try {
      if (req.query.profileId) await assertProfileAccess(req, String(req.query.profileId));
      responseUtil.success(
        res,
        await lmsIntegrationService.listRuns(
          req.query.profileId ? String(req.query.profileId) : undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async sync(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      const data = await lmsIntegrationService.runExport(
        req.params.id!,
        req.body.scope,
        req.user!._id.toString(),
        req.body.idempotencyKey,
      );
      await audit(
        req,
        "LMS_SYNC_COMPLETED",
        `Completed ${req.body.scope} LMS synchronization with status ${data.status}`,
        String(req.params.id),
        {
          runId: String(data._id),
          scope: req.body.scope,
          status: data.status,
          counts: data.counts,
        },
      );
      responseUtil.success(res, data, "LMS synchronization completed");
    } catch (error) {
      next(error);
    }
  },
  async importGrades(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      responseUtil.success(
        res,
        await lmsIntegrationService.importGrades(req.params.id!, req.body.records),
        "LMS grades staged for review",
      );
    } catch (error) {
      next(error);
    }
  },
  async retry(req, res, next) {
    try {
      const data = await lmsIntegrationService.retryRun(req.params.id!, req.user!._id.toString());
      await audit(
        req,
        "LMS_SYNC_RETRIED",
        `Retried LMS synchronization with status ${data.status}`,
        String(data.profileId),
        { previousRunId: req.params.id, runId: String(data._id), status: data.status },
      );
      responseUtil.success(res, data, "LMS synchronization retry completed");
    } catch (error) {
      next(error);
    }
  },
  async pendingGrades(_req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.listPendingGrades());
    } catch (error) {
      next(error);
    }
  },
  async courses(req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.listCourses(req.query));
    } catch (error) {
      next(error);
    }
  },
  async importCourses(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      const data = await lmsIntegrationService.importCourses(req.params.id!, req.body.records);
      await audit(
        req,
        "LMS_CATALOG_IMPORTED",
        `Imported ${data.imported} LMS courses`,
        req.params.id,
        data,
      );
      responseUtil.success(res, data, "LMS course catalogue synchronized");
    } catch (error) {
      next(error);
    }
  },
  async syncCourses(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      const data = await lmsIntegrationService.syncProviderCatalog(
        req.params.id!,
        req.user!._id.toString(),
      );
      await audit(
        req,
        "LMS_CATALOG_SYNCHRONIZED",
        `Synchronized ${data.imported} provider courses`,
        req.params.id,
        data,
      );
      responseUtil.success(res, data, "Provider course catalogue synchronized");
    } catch (error) {
      next(error);
    }
  },
  async assignCourse(req, res, next) {
    try {
      const data = await lmsIntegrationService.assignCourse(
        req.params.id!,
        req.body.studentIds,
        req.user!._id.toString(),
      );
      await audit(
        req,
        "LMS_COURSE_ASSIGNED",
        `Assigned LMS course to ${data.assigned} students`,
        req.params.id,
        data,
      );
      responseUtil.success(res, data, "Course enrollment submitted");
    } catch (error) {
      next(error);
    }
  },
  async enrollments(req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.listEnrollments(req.query));
    } catch (error) {
      next(error);
    }
  },
  async importProgress(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      const data = await lmsIntegrationService.importProgress(req.params.id!, req.body.records);
      await audit(
        req,
        "LMS_PROGRESS_IMPORTED",
        `Imported ${data.updated} LMS progress records and ${data.credentials} credentials`,
        req.params.id,
        data,
      );
      responseUtil.success(res, data, "Learning progress synchronized");
    } catch (error) {
      next(error);
    }
  },
  async syncProgress(req, res, next) {
    try {
      await assertProfileAccess(req, req.params.id!);
      const data = await lmsIntegrationService.syncProviderProgress(
        req.params.id!,
        req.user!._id.toString(),
      );
      await audit(
        req,
        "LMS_PROGRESS_SYNCHRONIZED",
        `Synchronized ${data.updated} progress records and ${data.credentials} credentials`,
        req.params.id,
        data,
      );
      responseUtil.success(res, data, "Provider progress synchronized");
    } catch (error) {
      next(error);
    }
  },
  async credentials(req, res, next) {
    try {
      responseUtil.success(res, await lmsIntegrationService.listCredentials(req.query));
    } catch (error) {
      next(error);
    }
  },
  async myCredentials(req, res, next) {
    try {
      responseUtil.success(
        res,
        await lmsIntegrationService.listCredentials({ studentId: req.user!._id.toString() }),
      );
    } catch (error) {
      next(error);
    }
  },
  async reviewGrade(req, res, next) {
    try {
      const scope = await lmsIntegrationService.gradeScope(req.params.id!);
      await assertDepartmentAccess(req, scope.departmentId);
      const data = await lmsIntegrationService.reviewGrade(
        req.params.id!,
        req.user!._id.toString(),
        req.body.decision,
        req.body.reason,
      );
      await audit(
        req,
        req.body.decision === "apply" ? "LMS_GRADE_APPLIED" : "LMS_GRADE_REJECTED",
        `${req.body.decision === "apply" ? "Applied" : "Rejected"} imported LMS grade`,
        String(req.params.id),
        { decision: req.body.decision },
      );
      responseUtil.success(res, data, "Imported grade reviewed");
    } catch (error) {
      next(error);
    }
  },
};
