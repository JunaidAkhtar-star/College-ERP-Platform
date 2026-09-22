import { meetingRepository } from "../repositories";
import { logger } from "../utils/logger.util";
import { MeetingModel, StudentProfileModel } from "../models";
import createError from "http-errors";
import { meetingEntitlementService } from "./meeting-entitlement.service";
import { Types } from "mongoose";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { meetingRecordingService } from "./meeting-recording.service";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";

const buildNotificationBody = (data: {
  title: string;
  agenda: string;
  scheduledAt: Date | string;
  mode: string;
  venue?: string;
  meetingLink?: string;
}) => {
  const date = new Date(data.scheduledAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const locationPart =
    data.mode === "online"
      ? `Join: ${data.meetingLink}`
      : data.mode === "hybrid"
        ? `Venue: ${data.venue ?? "TBD"} | Link: ${data.meetingLink ?? "TBD"}`
        : `Venue: ${data.venue ?? "TBD"}`;
  return `Agenda: ${data.agenda}\nDate & Time: ${date}\n${locationPart}`;
};

const editableMeetingFields = new Set([
  "title",
  "meetingType",
  "agenda",
  "scheduledAt",
  "durationMinutes",
  "mode",
  "venue",
  "meetingLink",
  "invitees",
  "targetDepartments",
  "targetYears",
  "department",
  "conductedBy",
  "recurrence",
  "recurrenceCount",
]);

export function normalizeMeeting(data: Record<string, unknown>) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([key]) => editableMeetingFields.has(key)),
  );
  clean.title = String(clean.title ?? "").trim();
  clean.agenda = String(clean.agenda ?? "").trim();
  if (String(clean.title).length < 3 || String(clean.title).length > 200)
    throw createError(400, "Meeting title must be 3-200 characters");
  if (String(clean.agenda).length < 3 || String(clean.agenda).length > 5000)
    throw createError(400, "Meeting agenda must be 3-5000 characters");
  const scheduledAt = new Date(String(clean.scheduledAt));
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
    throw createError(400, "Meeting must be scheduled in the future");
  clean.scheduledAt = scheduledAt;
  if (
    clean.durationMinutes === undefined ||
    clean.durationMinutes === null ||
    clean.durationMinutes === ""
  ) {
    delete clean.durationMinutes;
    clean.durationSpecified = false;
  } else {
    const duration = Number(clean.durationMinutes);
    if (!Number.isInteger(duration) || duration < 5 || duration > 1440)
      throw createError(400, "Duration must be between 5 and 1440 minutes");
    clean.durationMinutes = duration;
    clean.durationSpecified = true;
  }
  const mode = String(clean.mode ?? "");
  if ((mode === "online" || mode === "hybrid") && !String(clean.meetingLink ?? "").trim())
    throw createError(400, "Online and hybrid meetings require a meeting link");
  if ((mode === "physical" || mode === "hybrid") && !String(clean.venue ?? "").trim())
    throw createError(400, "Physical and hybrid meetings require a venue");
  const link = String(clean.meetingLink ?? "").trim();
  if (link && link !== "internal") {
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      throw createError(400, "Meeting link must be a valid HTTPS URL");
    }
    clean.meetingLink = link;
  }
  const recurrence = String(clean.recurrence ?? "none");
  if (!["none", "daily", "weekly", "monthly"].includes(recurrence))
    throw createError(400, "Invalid recurrence frequency");
  const recurrenceCount = recurrence === "none" ? 1 : Number(clean.recurrenceCount ?? 1);
  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 52)
    throw createError(400, "Recurring meetings support between 1 and 52 occurrences");
  clean.recurrence = recurrence;
  clean.recurrenceCount = recurrenceCount;
  return clean;
}

export const meetingService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    meetingRepository.list(filter, page, limit),

  getById: (id: string) => meetingRepository.findById(id),

  getMyMeetings: (
    userId: string,
    page: number,
    limit: number,
    status?: "scheduled" | "ongoing" | "completed" | "cancelled",
  ) => meetingRepository.listForInvitee(userId, page, limit, status),

  getStudentMeetings: (
    departmentId: string,
    year: number,
    page: number,
    limit: number,
    status?: "scheduled" | "ongoing" | "completed" | "cancelled",
  ) => meetingRepository.listForStudent(departmentId, year, page, limit, status),

  create: async (data: Record<string, unknown>, createdBy: string, createdByName: string) => {
    const normalized = normalizeMeeting(data);
    const recurrence = String(normalized.recurrence || "none");
    const recurrenceCount = Number(normalized.recurrenceCount || 1);
    const groupId = recurrenceCount > 1 ? new Types.ObjectId() : undefined;
    let meeting = null;
    for (let index = 0; index < recurrenceCount; index += 1) {
      const scheduledAt = new Date(normalized.scheduledAt as Date);
      if (recurrence === "daily") scheduledAt.setUTCDate(scheduledAt.getUTCDate() + index);
      if (recurrence === "weekly") scheduledAt.setUTCDate(scheduledAt.getUTCDate() + index * 7);
      if (recurrence === "monthly") scheduledAt.setUTCMonth(scheduledAt.getUTCMonth() + index);
      await meetingEntitlementService.assertSchedule(
        Number(normalized.durationMinutes ?? 60),
        scheduledAt,
      );
      const { recurrenceCount: _count, ...payload } = normalized;
      const created = await meetingRepository.create({
        ...payload,
        scheduledAt,
        recurrenceGroupId: groupId,
        occurrenceNumber: index + 1,
        createdBy,
      });
      if (payload.meetingLink === "internal") {
        created.meetingLink = `/meeting/room/${created._id}`;
        await created.save();
      }
      meeting ||= created;
      setImmediate(() =>
        meetingService
          ._notifyParticipants(created._id.toString(), createdBy, createdByName)
          .catch((err: unknown) => logger.error("Meeting notification failed", err)),
      );
    }

    // Fire-and-forget notification after creation
    return meeting!;
  },
  usage: () => meetingEntitlementService.usage(),

  update: async (id: string, data: Record<string, unknown>) => {
    const current = await meetingRepository.findById(id);
    if (!current) throw createError(404, "Meeting not found");
    const updated = await meetingRepository.updateById(
      id,
      normalizeMeeting({ ...current, ...data }),
    );
    if (!updated) throw createError(409, "Only scheduled meetings can be edited");
    return updated;
  },

  updateStatus: async (id: string, status: "scheduled" | "ongoing" | "completed" | "cancelled") => {
    const allowedFrom = {
      scheduled: [] as const,
      ongoing: ["scheduled"] as const,
      completed: [] as const,
      cancelled: ["scheduled", "ongoing"] as const,
    };
    const updated = await meetingRepository.updateStatus(id, [...allowedFrom[status]], status);
    if (!updated) throw createError(409, `Meeting cannot transition to ${status}`);
    return updated;
  },

  submitConcludingRemarks: async (id: string, remarks: string, submittedBy: string) => {
    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw Object.assign(new Error("Meeting not found"), { status: 404 });
    const updated = await meetingRepository.submitConcludingRemarks(id, remarks, submittedBy);
    if (!updated) throw createError(409, "Concluding remarks require an ongoing meeting");
    return updated;
  },

  async reviewMinutes(
    id: string,
    reviewerId: string,
    decision: "approved" | "rejected",
    note?: string,
  ) {
    if (decision === "rejected" && String(note ?? "").trim().length < 10)
      throw createError(400, "A meaningful rejection note is required");
    const meeting = await MeetingModel.findOne({
      _id: id,
      minutesStatus: "pending_approval",
    }).lean();
    if (!meeting) throw createError(409, "Meeting minutes are not awaiting approval");
    if (String(meeting.minutesSubmittedBy) === reviewerId)
      throw createError(409, "Minutes submitter cannot approve their own minutes");
    return MeetingModel.findOneAndUpdate(
      { _id: id, minutesStatus: "pending_approval" },
      {
        $set: {
          minutesStatus: decision,
          minutesReviewedBy: reviewerId,
          minutesReviewedAt: new Date(),
          minutesReviewNote: note?.trim(),
        },
      },
      { returnDocument: "after" },
    ).lean();
  },

  async consentToRecording(id: string, userId: string) {
    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw createError(404, "Meeting not found");
    return MeetingModel.findByIdAndUpdate(
      id,
      { $addToSet: { recordingConsentUserIds: userId } },
      { returnDocument: "after" },
    ).lean();
  },

  markAttendance: async (meetingId: string, userId: string) => {
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) throw Object.assign(new Error("Meeting not found"), { status: 404 });

    if (meeting.status === "cancelled" || meeting.status === "completed")
      throw createError(409, "Attendance is closed for this meeting");
    const starts = new Date(meeting.scheduledAt).getTime();
    const ends = starts + (meeting.durationMinutes || 60) * 60_000;
    const now = Date.now();
    if (now < starts - 15 * 60_000 || now > ends + 30 * 60_000)
      throw createError(
        409,
        "Attendance is available from 15 minutes before until 30 minutes after the meeting",
      );

    const hasAttendee = meeting.attendees?.some((a) => a.userId.toString() === userId);

    if (!hasAttendee) {
      await meetingRepository.addAttendee(meetingId, userId);
    } else {
      await meetingRepository.markAttendance(meetingId, userId);
    }
    return meetingRepository.findById(meetingId);
  },

  deletionImpact: async (id: string) => {
    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw createError(404, "Meeting not found");
    const impact = await meetingRecordingService.deletionImpact(id);
    return { ...impact, meetingStatus: meeting.status };
  },

  delete: async (id: string, _updatedBy: string) => {
    const meeting = await meetingRepository.findById(id);
    if (!meeting) throw createError(404, "Meeting not found");
    if (meeting.status === "ongoing")
      throw createError(409, "End the live meeting before permanently deleting it");

    const removedRecordings = await meetingRecordingService.removeForMeeting(id);
    await MeetingMessageModel.deleteMany({ meetingId: id });
    await MeetingModel.deleteOne({ _id: id });
    return removedRecordings;
  },

  getUpcomingMeeting: async (userId: string, roles: string[]) => {
    const now = new Date();
    const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const query: Record<string, unknown> = {
      status: { $in: ["scheduled", "ongoing"] },
      isDeleted: { $ne: true },
      endedAt: null,
      scheduledAt: { $gte: sixHoursAgo, $lte: tenMinFromNow },
    };

    if (roles.includes("student")) {
      let studentDeptId = null;
      let studentYear = 0;
      const profile = await StudentProfileModel.findOne({ userId })
        .select("department currentYear")
        .lean();
      if (profile) {
        studentDeptId = profile.department;
        studentYear = profile.currentYear;
      }

      query.meetingType = "student";
      query.$and = [
        {
          $or: [{ targetDepartments: studentDeptId }, { targetDepartments: { $size: 0 } }],
        },
        {
          $or: [{ targetYears: studentYear }, { targetYears: { $size: 0 } }],
        },
      ];
    } else if (roles.includes("super_admin") || roles.includes("principal")) {
      // Admins & principal have global visibility for reminders
    } else {
      // HODs, Faculty, and other staff members: see meetings where invited, conducted, or created
      query.$or = [{ invitees: userId }, { conductedBy: userId }, { createdBy: userId }];
    }

    const candidates = await MeetingModel.find(query)
      .sort({ scheduledAt: 1 })
      .limit(10)
      .select("title agenda scheduledAt durationMinutes meetingLink mode venue status")
      .lean();

    const activeMeeting = candidates.find((m) => {
      const start = new Date(m.scheduledAt).getTime();
      const durationMs = (m.durationMinutes || 60) * 60_000;
      return start + durationMs >= now.getTime();
    });

    return activeMeeting ?? null;
  },

  /** Resolves participants and dispatches an in-app + optional push notification */
  _notifyParticipants: async (meetingId: string, createdBy: string, createdByName: string) => {
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) return;

    const body = buildNotificationBody({
      title: meeting.title,
      agenda: meeting.agenda,
      scheduledAt: meeting.scheduledAt,
      mode: meeting.mode,
      venue: meeting.venue,
      meetingLink: meeting.meetingLink,
    });

    if (meeting.meetingType === "faculty") {
      const inviteeIds = [
        meeting.createdBy,
        meeting.conductedBy,
        ...(meeting.coHostIds ?? []),
        ...meeting.invitees,
      ].map((user) => String((user as unknown as { _id?: unknown })._id ?? user));

      if (inviteeIds.length === 0) return;

      await notifyUsers(inviteeIds, {
        title: `Meeting Scheduled: ${meeting.title}`,
        body,
        type: NotificationType.INFO,
        withEmail: true,
        actionUrl: meeting.meetingLink || `/meeting/room/${meeting._id}`,
        createdBy,
        createdByName,
      });
    } else {
      // Resolve exact student recipients so both department and target year are respected.
      const studentFilter: Record<string, unknown> = { status: { $ne: "inactive" } };
      if (meeting.targetDepartments.length > 0) {
        studentFilter.department = {
          $in: meeting.targetDepartments.map((department) =>
            String((department as unknown as { _id?: unknown })._id ?? department),
          ),
        };
      }
      if (meeting.targetYears.length > 0) {
        studentFilter.currentYear = { $in: meeting.targetYears };
      }
      const students = await StudentProfileModel.find(studentFilter).select("userId").lean();
      await notifyUsers(
        [
          meeting.createdBy,
          meeting.conductedBy,
          ...(meeting.coHostIds ?? []),
          ...students.map((student) => student.userId),
        ],
        {
          title: `Student Meeting Scheduled: ${meeting.title}`,
          body,
          type: NotificationType.INFO,
          withEmail: true,
          actionUrl: meeting.meetingLink || `/meeting/room/${meeting._id}`,
          createdBy,
          createdByName,
        },
      );
    }

    await meetingRepository.markNotified(meetingId);
  },
};
