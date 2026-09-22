import createError from "http-errors";
import { MeetingModel } from "../models/meeting.model";
import { StudentProfileModel } from "../models/student-profile.model";

const id = (value: unknown) => String((value as { _id?: unknown })?._id ?? value ?? "");

export const meetingAccessService = {
  async meeting(meetingId: string) {
    const meeting = await MeetingModel.findById(meetingId).lean();
    if (!meeting) throw createError(404, "Meeting not found");
    return meeting;
  },

  async isHost(meetingId: string, userId: string) {
    const meeting = await this.meeting(meetingId);
    return [
      id(meeting.conductedBy),
      id(meeting.createdBy),
      ...(meeting.coHostIds || []).map(id),
    ].includes(userId);
  },

  async assertJoinWindow(meetingId: string) {
    const meeting = await this.meeting(meetingId);
    if (meeting.status === "cancelled") throw createError(409, "This meeting was cancelled");
    if (meeting.status === "completed") throw createError(409, "This meeting has ended");
    if (meeting.status === "ongoing") {
      if (meeting.durationSpecified && meeting.durationMinutes && meeting.startedAt) {
        const endsAt =
          new Date(meeting.startedAt).getTime() + Number(meeting.durationMinutes) * 60_000;
        if (Date.now() >= endsAt) {
          await MeetingModel.updateOne(
            { _id: meetingId, status: "ongoing" },
            { $set: { status: "completed", endedAt: new Date() } },
          );
          throw createError(409, "This meeting has reached its scheduled duration and ended");
        }
      }
      return meeting;
    }

    const startsAt = new Date(meeting.scheduledAt).getTime();
    const endsAt = startsAt + Number(meeting.durationMinutes || 60) * 60_000;
    const now = Date.now();
    const earlyJoinAt = startsAt - 10 * 60_000;
    if (now < earlyJoinAt) {
      throw createError(
        409,
        `You can join from ${new Date(earlyJoinAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })}`,
      );
    }
    if (now > endsAt) throw createError(409, "The scheduled meeting time has ended");
    return meeting;
  },

  async assertHost(meetingId: string, userId: string) {
    if (!(await this.isHost(meetingId, userId)))
      throw createError(403, "Meeting host permission required");
    return this.meeting(meetingId);
  },

  async assertParticipant(meetingId: string, userId: string) {
    const meeting = await this.meeting(meetingId);
    if (
      [
        id(meeting.conductedBy),
        id(meeting.createdBy),
        ...(meeting.coHostIds || []).map(id),
        ...meeting.invitees.map(id),
      ].includes(userId)
    )
      return meeting;
    if (meeting.meetingType === "student") {
      const profile = await StudentProfileModel.findOne({ userId })
        .select("department currentYear")
        .lean();
      if (profile) {
        const departmentAllowed =
          meeting.targetDepartments.length === 0 ||
          meeting.targetDepartments.map(id).includes(id(profile.department));
        const yearAllowed =
          meeting.targetYears.length === 0 || meeting.targetYears.includes(profile.currentYear);
        if (departmentAllowed && yearAllowed) return meeting;
      }
    }
    throw createError(403, "You are not invited to this meeting");
  },
};
