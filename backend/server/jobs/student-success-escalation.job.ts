import cron from "node-cron";
import { studentSuccessService } from "../services/student-success.service";
import { logger } from "../utils/logger.util";

export function startStudentSuccessEscalationJob(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await studentSuccessService.processOverdueCases();
      if (result.escalated > 0)
        logger.cron(`student-success — escalated ${result.escalated} overdue case(s)`);
    } catch (error) {
      logger.error("student-success escalation job failed", error);
    }
  });
  logger.cron("Student-success escalation job started (every 15 minutes)");
}
