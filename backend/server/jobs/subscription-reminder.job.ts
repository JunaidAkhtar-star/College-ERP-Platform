import cron from "node-cron";
import { sendEmail, EmailTemplate } from "../email/email.service";
import { SubscriptionPlanModel } from "../models/platform.model";
import { TenantModel } from "../models/tenant.model";
import { logger } from "../utils/logger.util";
import { withSchedulerLease } from "../services/scheduler-lease.service";
import { formatIndiaDate } from "../utils/date.util";

type ReminderDay = 7 | 4;

const dayWindow = (days: ReminderDay) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + days);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

async function sendReminders(kind: "trial" | "subscription", days: ReminderDay): Promise<void> {
  const expiryField = kind === "trial" ? "trialEndsAt" : "subscriptionExpiresAt";
  const sentField =
    kind === "trial"
      ? days === 7
        ? "trialReminder7SentAt"
        : "trialReminder4SentAt"
      : days === 7
        ? "subscriptionReminder7SentAt"
        : "subscriptionReminder4SentAt";
  const { start, end } = dayWindow(days);
  const tenants = await TenantModel.find({
    billingEmail: { $exists: true, $ne: "" },
    billingStatus: kind === "trial" ? "trialing" : { $in: ["active", "past_due"] },
    [expiryField]: { $gte: start, $lt: end },
    [sentField]: { $exists: false },
  })
    .populate("planId", "name sortOrder")
    .lean();

  for (const tenant of tenants) {
    const claimed = await TenantModel.findOneAndUpdate(
      { _id: tenant._id, [sentField]: { $exists: false } },
      { $set: { [sentField]: new Date() } },
    );
    if (!claimed || !tenant.billingEmail) continue;
    const currentPlan = tenant.planId as unknown as
      | { name?: string; sortOrder?: number }
      | undefined;
    const suggested = await SubscriptionPlanModel.findOne({
      isActive: true,
      planType: "paid",
      sortOrder: { $gt: currentPlan?.sortOrder ?? -1 },
    })
      .sort({ sortOrder: 1 })
      .select("name priceLabel")
      .lean();
    const expiry = tenant[expiryField] as Date | undefined;
    await sendEmail({
      to: tenant.billingEmail,
      subject: `${kind === "trial" ? "Free trial" : "Subscription"} expires in ${days} days`,
      template: EmailTemplate.GENERAL_NOTIFICATION,
      context: {
        title: `${days} days remaining`,
        message: `${tenant.name}'s ${kind === "trial" ? "free trial" : `${currentPlan?.name ?? "Devvelocity"} subscription`} expires on ${expiry ? formatIndiaDate(expiry) : "the scheduled date"}. ${suggested ? `Recommended upgrade: ${suggested.name} (${suggested.priceLabel}). ` : ""}Complete annual renewal before expiry to avoid service interruption.`,
      },
    });
  }
}

export function startSubscriptionReminderJob(): void {
  cron.schedule("0 8 * * *", async () => {
    try {
      await withSchedulerLease("master:subscription-reminders", async () => {
        await Promise.all([
          sendReminders("trial", 7),
          sendReminders("trial", 4),
          sendReminders("subscription", 7),
          sendReminders("subscription", 4),
        ]);
      });
    } catch (error) {
      logger.error("subscription-reminder job failed", error);
    }
  });
  logger.cron("Subscription reminder job started (daily at 08:00)");
}
