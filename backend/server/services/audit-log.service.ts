import { auditLogRepository } from "../repositories/audit-log.repository";

export const auditLogService = {
  log: (params: Parameters<typeof auditLogRepository.create>[0]) =>
    auditLogRepository.create(params),

  list: (filter: Record<string, unknown>, page = 1, limit = 50) =>
    auditLogRepository.paginate(filter, page, limit),
};
