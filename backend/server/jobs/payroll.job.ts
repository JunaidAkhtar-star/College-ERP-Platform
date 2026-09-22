/**
 * Payroll Generation Job
 * Runs on the 1st of every month at 1 AM — auto-generates payslips
 * for all active faculty for the previous month.
 */
import cron from "node-cron";
import { payrollService } from "../services/payroll.service";
import { userRepository } from "../repositories/user.repository";
import { SystemRole } from "../constants/roles";
import { logger } from "../utils/logger.util";

export function startPayrollJob(): void {
  // 1st of every month at 1 AM
  cron.schedule("0 1 1 * *", async () => {
    try {
      const now = new Date();
      // Previous month
      const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = targetDate.getMonth() + 1;
      const year = targetDate.getFullYear();

      logger.cron(`payroll — Generating payslips for ${month}/${year}…`);

      // Fetch all active faculty + HR + admin users
      const facultyRoles = [
        SystemRole.FACULTY,
        SystemRole.HOD,
        SystemRole.PRINCIPAL,
        SystemRole.DEAN_ACADEMIC,
      ];
      const users = await userRepository.paginate({ status: "active" }, { page: 1, limit: 1000 });

      let generated = 0;
      for (const user of users.data) {
        const hasPayrollRole = user.roles.some((r: string) =>
          facultyRoles.includes(r as SystemRole),
        );
        if (!hasPayrollRole) continue;

        // Check if payslip already exists for this month/year
        const existing = await payrollService.getPayslipByEmployeeMonthYear(
          user._id.toString(),
          month,
          year,
        );
        if (existing) continue;

        // Generate with default basic pay from faculty profile (or stub 0 if not set)
        try {
          await payrollService.generatePayslip(
            user._id.toString(),
            user.name,
            user.roles[0] ?? "faculty",
            "", // departmentId — HR fills in when publishing
            month,
            year,
            0, // basicPay — HR updates when publishing
            0, // presentDays
            0, // absentDays
            0, // lopDays
            0, // payableDays
            "system",
          );
          generated++;
        } catch {
          // Skip if profile not complete
        }
      }

      logger.cron(`payroll — Generated ${generated} payslip(s) for ${month}/${year}`);
    } catch (err) {
      logger.error("payroll job failed", err);
    }
  });

  logger.cron("Payroll job started (1st of month, 01:00)");
}
