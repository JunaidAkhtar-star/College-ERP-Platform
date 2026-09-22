/**
 * Meeting Reminder Job
 * Runs every minute — scans for meetings starting in the next 10 minutes
 * and sends email and in-app reminders to participants.
 */
import cron from "node-cron";
import { MeetingModel, StudentProfileModel } from "../models";
import { notifyUsers } from "../services/helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { logger } from "../utils/logger.util";
import { tenantLocalStorage } from "../configs/connectionManager";
import { getIO } from "../socket/socket.gateway";
import { meetingEntitlementService } from "../services/meeting-entitlement.service";

export function startMeetingReminderJob(): void {
  // Every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      // A duration-free meeting is deliberately open-ended. Timed meetings expire
      // from the moment the host actually started them, not from their scheduled time.
      const elapsedMeetings = await MeetingModel.find({
        status: "ongoing",
        durationSpecified: true,
        durationMinutes: { $gt: 0 },
        startedAt: { $type: "date" },
        $expr: {
          $lte: [
            {
              $add: ["$startedAt", { $multiply: ["$durationMinutes", 60_000] }],
            },
            now,
          ],
        },
      })
        .select("_id")
        .lean();

      if (elapsedMeetings.length > 0) {
        const elapsedIds = elapsedMeetings.map((meeting) => meeting._id);
        await MeetingModel.updateMany(
          { _id: { $in: elapsedIds }, status: "ongoing" },
          { $set: { status: "completed", endedAt: now, updatedAt: now } },
        );

        const tenantId = tenantLocalStorage.getStore()?.tenantId;
        for (const meeting of elapsedMeetings) {
          const meetingId = meeting._id.toString();
          await meetingEntitlementService.end(meetingId).catch(() => undefined);
          if (tenantId) {
            try {
              getIO().to(`meet:${tenantId}:${meetingId}`).emit("meet_ended", {
                meetingId,
                reason: "duration_elapsed",
              });
              getIO().to(`tenant:${tenantId}`).emit("meeting_status_changed", {
                meetingId,
                status: "completed",
              });
            } catch {
              // Socket.IO may not be ready during a worker-only process. The persisted
              // completed state remains authoritative for the next client refresh.
            }
          }
        }
        logger.cron(`meeting — Auto-completed ${elapsedMeetings.length} elapsed meeting(s)`);
      }

      // Find scheduled meetings starting in the next 10 minutes that haven't had reminders sent
      const upcomingMeetings = await MeetingModel.find({
        status: "scheduled",
        scheduledAt: { $gte: now, $lte: tenMinFromNow },
        reminderSent10m: { $ne: true },
      });

      for (const meeting of upcomingMeetings) {
        const formattedTime = new Date(meeting.scheduledAt).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const meetingUrl = meeting.meetingLink || `/meeting/room/${meeting._id}`;
        const organizerIds = [
          meeting.createdBy,
          meeting.conductedBy,
          ...(meeting.coHostIds ?? []),
        ].map((id) => id.toString());

        if (meeting.meetingType === "faculty") {
          const inviteeIds = [...organizerIds, ...meeting.invitees.map((id) => id.toString())];
          if (inviteeIds.length > 0) {
            await notifyUsers(inviteeIds, {
              title: `Upcoming Meeting Reminder: ${meeting.title}`,
              body: `The meeting "${meeting.title}" is starting in 10 minutes at ${formattedTime}. Join link: ${meetingUrl}`,
              type: NotificationType.INFO,
              withEmail: true,
              actionUrl: meetingUrl,
            });
          }
        } else {
          // Student meeting — notify target departments and years
          const query: Record<string, unknown> = { status: "active" };
          if (meeting.targetDepartments && meeting.targetDepartments.length > 0) {
            query.department = { $in: meeting.targetDepartments };
          }
          if (meeting.targetYears && meeting.targetYears.length > 0) {
            query.currentYear = { $in: meeting.targetYears };
          }

          const students = await StudentProfileModel.find(query).select("userId").lean();
          const studentUserIds = [...organizerIds, ...students.map((s) => s.userId.toString())];

          if (studentUserIds.length > 0) {
            await notifyUsers(studentUserIds, {
              title: `Upcoming Student Meeting Reminder: ${meeting.title}`,
              body: `The student meeting "${meeting.title}" is starting in 10 minutes at ${formattedTime}. Join link: ${meetingUrl}`,
              type: NotificationType.INFO,
              withEmail: true,
              actionUrl: meetingUrl,
            });
          }
        }

        // Persist only after the notification workflow has been attempted. The
        // tenant scheduler lease prevents another replica from duplicating this run.
        meeting.reminderSent10m = true;
        await meeting.save();

        logger.cron(`meeting — Sent 10-minute reminders for meeting: ${meeting.title}`);
      }
    } catch (err) {
      logger.error("meeting reminder job failed", err);
    }
  });

  logger.cron("Meeting 10-minute reminder job started (every minute)");
}
