import type { NextFunction, Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import createError from "http-errors";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { importCenterService } from "../services/import-center.service";
import { Module, PermissionAction } from "../constants/permissions";

const hasImportPermission = (req: Request, action: PermissionAction) =>
  Boolean(
    req.permissions?.some(
      (permission) =>
        permission.module === Module.IMPORT_CENTER && permission.actions.includes(action),
    ),
  );

const targetModules: Readonly<Record<string, Module>> = {
  curricula: Module.CURRICULUM,
  departments: Module.DEPARTMENT,
  batches: Module.BATCH_MANAGEMENT,
  students: Module.STUDENT_PROFILE,
  faculty: Module.FACULTY_MANAGEMENT,
  subjects: Module.SUBJECT,
  fee_opening_balances: Module.FEE_MANAGEMENT,
};

const hasPermission = (req: Request, module: Module, action: PermissionAction) =>
  Boolean(
    req.permissions?.some(
      (permission) => permission.module === module && permission.actions.includes(action),
    ),
  );

export const importCenterController = {
  metadata: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: importCenterService
          .metadata()
          .filter((target) =>
            hasPermission(req, targetModules[target.key]!, PermissionAction.CREATE),
          ),
      });
    } catch (error) {
      next(error);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await importCenterService.list(
          String(req.user?._id),
          hasImportPermission(req, PermissionAction.APPROVE) ||
            hasImportPermission(req, PermissionAction.DELETE),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await importCenterService.get(
        String(req.params["id"]),
        String(req.user?._id),
        hasImportPermission(req, PermissionAction.APPROVE) ||
          hasImportPermission(req, PermissionAction.DELETE),
      );
      if (!data) throw createError(404, "Import job not found");
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  stage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.["file"] as UploadedFile | undefined;
      if (!file || Array.isArray(file)) throw createError(400, "One CSV file is required");
      const targetKey = String(req.body.target ?? "");
      const targetModule = targetModules[targetKey];
      if (!targetModule) throw createError(400, "Unsupported import target");
      if (!hasPermission(req, targetModule, PermissionAction.CREATE)) {
        throw createError(403, `Missing permission: ${targetModule}:${PermissionAction.CREATE}`);
      }
      if (
        !/\.csv$/i.test(file.name) ||
        !["text/csv", "application/vnd.ms-excel", "application/octet-stream"].includes(
          file.mimetype,
        )
      )
        throw createError(400, "Only CSV files are accepted");
      let mapping: Record<string, string> | undefined;
      let options: { skipDuplicates?: boolean; updateExisting?: boolean } | undefined;
      if (req.body.mapping) {
        try {
          mapping = JSON.parse(String(req.body.mapping)) as Record<string, string>;
        } catch {
          throw createError(400, "Mapping must be valid JSON");
        }
      }
      if (req.body.options) {
        try {
          options = JSON.parse(String(req.body.options)) as typeof options;
        } catch {
          throw createError(400, "Import options must be valid JSON");
        }
      }
      const data = await importCenterService.stage(
        file.name,
        file.data,
        targetKey,
        mapping,
        String(req.user?._id),
        options,
      );
      await auditLogRepository.create({
        user: req.user,
        action: "IMPORT_VALIDATED",
        module: "import_center",
        targetId: String(data._id),
        targetModel: "ImportJob",
        description: `Validated ${data.target} import`,
        metadata: {
          totalRows: data.totalRows,
          validRows: data.validRows,
          invalidRows: data.invalidRows,
        },
        req,
      });
      res.status(201).json({ success: true, data, message: "Import validation completed" });
    } catch (error) {
      next(error);
    }
  },
  commit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await importCenterService.queueCommit(
        String(req.params["id"]),
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "IMPORT_COMMIT_APPROVED",
        module: "import_center",
        targetId: String(data._id),
        targetModel: "ImportJob",
        description: `Approved and queued ${data.target} import`,
        metadata: { committedRows: data.committedRows, failedRows: data.failedRows },
        req,
      });
      res.status(202).json({ success: true, data, message: "Import queued for processing" });
    } catch (error) {
      next(error);
    }
  },
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await importCenterService.cancel(String(req.params["id"]), String(req.user?._id)),
        message: "Import cancelled",
      });
    } catch (error) {
      next(error);
    }
  },
  rollback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await importCenterService.rollback(
        String(req.params["id"]),
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "IMPORT_ROLLED_BACK",
        module: "import_center",
        targetId: String(data._id),
        targetModel: "ImportJob",
        description: `Rolled back ${data.target} import`,
        metadata: { removedRows: data.committedRows },
        req,
      });
      res.json({ success: true, data, message: "Import safely rolled back" });
    } catch (error) {
      next(error);
    }
  },
};
