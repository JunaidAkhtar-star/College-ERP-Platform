import type { Request, Response, NextFunction } from "express";
import { auditLogService } from "../services/audit-log.service";

export const auditLogController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, module, action, from, to, search, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (userId) filter.userId = userId;
      if (module) filter.module = module;
      if (action) filter.action = action;
      if (search) {
        const safeSearch = String(search)
          .slice(0, 100)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const expression = new RegExp(safeSearch, "i");
        filter.$or = [
          { userName: expression },
          { module: expression },
          { action: expression },
          { description: expression },
        ];
      }
      if (from || to) {
        const range: Record<string, Date> = {};
        if (from) range.$gte = new Date(from as string);
        if (to) {
          const end = new Date(to as string);
          end.setUTCHours(23, 59, 59, 999);
          range.$lte = end;
        }
        filter.createdAt = range;
      }
      const result = await auditLogService.list(filter, Number(page) || 1, Number(limit) || 50);
      const mayViewSecurityContext = ["super_admin", "admin"].includes(String(req.activeRole));
      const logs = result.data.map((row) => {
        const rawAction = row.action.toUpperCase();
        const action = rawAction.includes("LOGIN")
          ? "LOGIN"
          : rawAction.includes("LOGOUT")
            ? "LOGOUT"
            : rawAction.includes("DELETE") || rawAction.includes("REMOVE")
              ? "DELETE"
              : rawAction.includes("UPDATE") ||
                  rawAction.includes("EDIT") ||
                  rawAction.includes("APPROV")
                ? "UPDATE"
                : rawAction.includes("READ") || rawAction.includes("VIEW")
                  ? "READ"
                  : "CREATE";
        return {
          ...row,
          userId: { _id: row.userId, name: row.userName ?? "System", email: "" },
          action,
          rawAction: row.action,
          resourceId: row.targetId,
          resourceName: row.targetModel,
          changes: row.metadata,
          timestamp: row.createdAt,
          risk:
            action === "DELETE" ||
            /(ROLE|PERMISSION|PASSWORD|MFA|PAYMENT|BILLING|SECURITY|BACKUP)/i.test(
              `${row.action} ${row.module}`,
            )
              ? "high"
              : action === "UPDATE" || action === "LOGIN"
                ? "medium"
                : "low",
          ipAddress: mayViewSecurityContext ? row.ipAddress : undefined,
          userAgent: mayViewSecurityContext ? row.userAgent : undefined,
          securityContextRestricted: !mayViewSecurityContext,
        };
      });
      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
