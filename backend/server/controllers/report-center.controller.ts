import type { NextFunction, Request, Response } from "express";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { reportCenterService } from "../services/report-center.service";
import { getDepartmentScope } from "../utils/ownership.util";

const identity = (req: Request) => ({
  userId: String(req.user?._id),
  role: String(req.activeRole ?? ""),
});

export const reportCenterController = {
  metadata: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.metadata(identity(req).role, await getDepartmentScope(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      res.json({ success: true, data: await reportCenterService.list(userId, role) });
    } catch (error) {
      next(error);
    }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      const data = await reportCenterService.save(req.body, userId, role);
      await auditLogRepository.create({
        user: req.user,
        action: "REPORT_CREATED",
        module: "report_center",
        targetId: String(data._id),
        targetModel: "ReportDefinition",
        description: `Created report ${data.name}`,
        req,
      });
      res.status(201).json({ success: true, data, message: "Report saved" });
    } catch (error) {
      next(error);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      const data = await reportCenterService.save(req.body, userId, role, String(req.params["id"]));
      res.json({ success: true, data, message: "Report updated" });
    } catch (error) {
      next(error);
    }
  },
  preview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = identity(req);
      res.json({
        success: true,
        data: await reportCenterService.preview(req.body, {
          role,
          departmentId: await getDepartmentScope(req),
          asOf: req.body.asOf ? new Date(req.body.asOf) : undefined,
        }),
      });
    } catch (error) {
      next(error);
    }
  },
  exportAdHoc: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = identity(req);
      const data = await reportCenterService.exportAdHoc(req.body, {
        role,
        departmentId: await getDepartmentScope(req),
        asOf: req.body.asOf ? new Date(req.body.asOf) : undefined,
      });
      await auditLogRepository.create({
        user: req.user,
        action: "REPORT_EXPORTED",
        module: "report_center",
        targetId: String(req.body.dataset),
        targetModel: "AdHocReport",
        description: `Generated governed ${String(req.body.dataset)} export`,
        metadata: { rows: data.rows.length, total: data.total, truncated: data.truncated },
        req,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  run: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      const data = await reportCenterService.run(
        String(req.params["id"]),
        userId,
        role,
        Number(req.query["limit"] ?? 1000),
        await getDepartmentScope(req),
        req.query.asOf ? new Date(String(req.query.asOf)) : undefined,
      );
      await auditLogRepository.create({
        user: req.user,
        action: "REPORT_EXPORTED",
        module: "report_center",
        targetId: String(req.params["id"]),
        targetModel: "ReportDefinition",
        description: `Generated report ${data.definition.name}`,
        metadata: { rows: data.rows.length, total: data.total },
        req,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.submit(req.params.id, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.publish(req.params.id, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  snapshot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      res.status(201).json({
        success: true,
        data: await reportCenterService.snapshot(
          req.params.id,
          userId,
          role,
          await getDepartmentScope(req),
          req.body.asOf ? new Date(req.body.asOf) : new Date(),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  listSnapshots: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.listSnapshots(String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  getSnapshot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await reportCenterService.getSnapshot(req.params.id, String(req.user?._id));
      if (!data) {
        res.status(404).json({ success: false, message: "Snapshot not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  listSchedules: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.listSchedules(String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  createSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = identity(req);
      res.status(201).json({
        success: true,
        data: await reportCenterService.createSchedule(
          req.body,
          userId,
          role,
          await getDepartmentScope(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  setScheduleStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await reportCenterService.setScheduleStatus(
          req.params.id,
          String(req.user?._id),
          req.body.status,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
};
