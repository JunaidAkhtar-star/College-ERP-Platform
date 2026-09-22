/**
 * Jobs bootstrap — starts all cron jobs.
 * Called from server.ts after DB connection is established.
 */
import type { TaskContext, TaskFn } from "node-cron";
import cron from "node-cron";
import {
  getTenantConnection,
  tenantLocalStorage,
  waitForActiveConnection,
} from "../configs/connectionManager";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { jobQueueService, registerJobHandler } from "../services/job-queue.service";
import { withSchedulerLease } from "../services/scheduler-lease.service";
import { logger } from "../utils/logger.util";
import { startAlumniSyncJob } from "./alumni-sync.job";
import { startAttendanceAlertJob } from "./attendance-alert.job";
import { startCleanupJob } from "./cleanup.job";
import { startDataExportRecoveryJob } from "./data-export.job";
import { startFeeReminderJob } from "./fee-reminder.job";
import "./import-center.job";
import { startLmsSyncJob } from "./lms-sync.job";
import { startMeetingReminderJob } from "./meeting-reminder.job";
import { startNotificationScheduler } from "./notification.job";
import { startOperationalStatusJob } from "./operational-status.job";
import { startOutboxJob } from "./outbox.job";
import { startPayrollJob } from "./payroll.job";
import { startQuizAssignmentJob } from "./quiz-assignment.job";
import { startReportScheduleJob } from "./report-schedule.job";
import { startSemesterEndJob } from "./semester-end.job";
import { startStudentSuccessEscalationJob } from "./student-success-escalation.job";
import { startSubscriptionReminderJob } from "./subscription-reminder.job";
import { startTenantBackupJob } from "./tenant-backup.job";
import { startTenantSuspensionJob } from "./tenant-suspension.job";
import { startWorkflowEscalationJob } from "./workflow-escalation.job";

const durableJobHandlers = new Map<string, TaskFn>();
type ActiveTenant = { tenantId: string; databaseName: string };
let activeTenantCache: { rows: ActiveTenant[]; expiresAt: number } = { rows: [], expiresAt: 0 };
let activeTenantLoad: Promise<ActiveTenant[]> | null = null;

async function getActiveTenants(): Promise<ActiveTenant[]> {
  if (activeTenantCache.expiresAt > Date.now()) return activeTenantCache.rows;
  if (activeTenantLoad) return activeTenantLoad;

  activeTenantLoad = TenantModel.find({
    status: TenantStatus.ACTIVE,
    subscriptionExpiresAt: { $gt: new Date() },
  })
    .select("tenantId databaseName")
    .lean()
    .exec()
    .then((rows) => {
      const tenants = rows.map((row) => ({
        tenantId: row.tenantId,
        databaseName: row.databaseName,
      }));
      activeTenantCache = { rows: tenants, expiresAt: Date.now() + 30_000 };
      return tenants;
    })
    .finally(() => {
      activeTenantLoad = null;
    });

  return activeTenantLoad;
}

registerJobHandler("scheduler.command", {
  async run(payload) {
    const schedulerKey = String(payload.schedulerKey);
    const task = durableJobHandlers.get(schedulerKey);
    if (!task) throw new Error(`Scheduled command handler is unavailable: ${schedulerKey}`);
    const date = new Date(String(payload.scheduledAt));
    const context: TaskContext = {
      date,
      dateLocalIso: date.toISOString(),
      triggeredAt: new Date(),
      execution: {
        id: String(payload.executionId),
        reason: "scheduled",
        startedAt: new Date(),
      },
    };
    await task(context);
  },
});

export const jobRuntimeStatus: {
  running: boolean;
  startedAt: string | null;
  registeredSchedulers: number;
} = { running: false, startedAt: null, registeredSchedulers: 0 };

/**
 * Registers tenant-owned cron callbacks as a fan-out across all active tenants.
 * The tenant registry itself remains in the master database and is scheduled
 * after the original scheduler has been restored.
 */
function registerTenantJobs(register: () => void): void {
  const originalSchedule = cron.schedule.bind(cron);
  let schedulerNumber = 0;
  cron.schedule = ((expression, task, options) => {
    if (typeof task !== "function") {
      return originalSchedule(expression, task, options);
    }
    const schedulerKey = `${String(expression)}:${schedulerNumber++}`;
    durableJobHandlers.set(schedulerKey, task);
    return originalSchedule(
      expression,
      async (context) => {
        const tenants = await getActiveTenants();

        await Promise.allSettled(
          tenants.map(async (tenant) => {
            try {
              await waitForActiveConnection(10000);
              const tenantDb = getTenantConnection(tenant.tenantId, tenant.databaseName);
              await tenantLocalStorage.run({ tenantId: tenant.tenantId, tenantDb }, async () => {
                await withSchedulerLease(`tenant:${tenant.tenantId}:${schedulerKey}`, async () => {
                  const scheduledAt = context.date.toISOString();
                  const executionId = context.execution?.id ?? `${schedulerKey}:${scheduledAt}`;
                  await jobQueueService.enqueue(
                    "scheduler.command",
                    `scheduler:${tenant.tenantId}:${schedulerKey}:${scheduledAt}`,
                    { schedulerKey, scheduledAt, executionId },
                    { maxAttempts: 8 },
                  );
                });
              });
            } catch (error) {
              logger.error(`Tenant cron failed for '${tenant.tenantId}'`, error);
            }
          }),
        );
      },
      {
        ...options,
        noOverlap: true,
        maxRandomDelay: options?.maxRandomDelay ?? 8_000,
      },
    );
  }) as typeof cron.schedule;

  try {
    register();
  } finally {
    cron.schedule = originalSchedule;
  }
}

export function startAllJobs(): void {
  registerTenantJobs(() => {
    startNotificationScheduler();
    startAttendanceAlertJob();
    startFeeReminderJob();
    startPayrollJob();
    startQuizAssignmentJob();
    startSemesterEndJob();
    startAlumniSyncJob();
    startCleanupJob();
    startMeetingReminderJob();
    startOperationalStatusJob();
    startReportScheduleJob();
    startWorkflowEscalationJob();
    startStudentSuccessEscalationJob();
    startDataExportRecoveryJob();
    startLmsSyncJob();
  });
  startOutboxJob();
  startTenantSuspensionJob();
  startSubscriptionReminderJob();
  startTenantBackupJob();
  jobRuntimeStatus.running = true;
  jobRuntimeStatus.startedAt = new Date().toISOString();
  jobRuntimeStatus.registeredSchedulers = 18;
  logger.cron("All scheduled jobs are running");
}
