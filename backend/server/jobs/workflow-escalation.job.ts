import cron from "node-cron";
import { formWorkflowService } from "../services/form-workflow.service";
import { logger } from "../utils/logger.util";

export function startWorkflowEscalationJob(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await formWorkflowService.processEscalations();
      if (result.escalated > 0)
        logger.cron(`workflow — escalated ${result.escalated} overdue approval(s)`);
    } catch (error) {
      logger.error("workflow escalation job failed", error);
    }
  });
  logger.cron("Workflow escalation job started (every 15 minutes)");
}
