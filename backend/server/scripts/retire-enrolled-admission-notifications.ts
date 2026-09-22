/**
 * @file retire-enrolled-admission-notifications.ts
 * @description One-shot migration that hides stale admission workflow
 * notifications for users who were already enrolled before notification
 * retirement was added to the live enrollment flow.
 *
 * Run:
 *   pnpm exec ts-node server/scripts/retire-enrolled-admission-notifications.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  AdmissionApplicationModel,
  ApplicationStatus,
} from "../models/admission-application.model";
import { NotificationModel, NotificationType } from "../models";
import { logger } from "../utils/logger.util";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(mongoUri);

  const enrolled = await AdmissionApplicationModel.find({
    status: ApplicationStatus.ENROLLED,
    enrolledUserId: { $exists: true, $ne: null },
  })
    .select("enrolledUserId applicationNumber")
    .lean();

  const userIds = [
    ...new Set(
      enrolled
        .map((app) => app.enrolledUserId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (!userIds.length) {
    logger.info("[retire-enrolled-admission-notifications] no enrolled users found");
    await mongoose.disconnect();
    return;
  }

  const result = await NotificationModel.updateMany(
    {
      isActive: true,
      type: NotificationType.ADMISSION,
      targetUserIds: { $in: userIds },
      actionUrl: { $in: ["/admission-portal", "/student/admission-portal", "/dashboard"] },
    },
    { $set: { isActive: false } },
  );

  logger.info(
    `[retire-enrolled-admission-notifications] enrolledUsers=${userIds.length} matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("[retire-enrolled-admission-notifications] failed", { err });
  process.exit(1);
});
