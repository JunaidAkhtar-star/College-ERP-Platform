import createError from "http-errors";
import { tenantLocalStorage } from "../configs/connectionManager";
import { TenantModel } from "../models/tenant.model";
import { ProductAddonModel, SubscriptionPlanModel } from "../models/platform.model";
import { MeetingModel } from "../models/meeting.model";
import { MeetingUsageModel } from "../models/meeting-usage.model";
import { MeetingRecordingModel } from "../models/meeting-recording.model";
const upgrade = (message: string, details: Record<string, unknown>) =>
  createError(402, message, { code: "MEETING_PLAN_LIMIT_REACHED", details });
async function resolve() {
  const tenantId = tenantLocalStorage.getStore()?.tenantId;
  if (!tenantId) throw createError(400, "Tenant context required");
  const tenant = await TenantModel.findOne({ tenantId }).lean();
  if (!tenant) throw createError(404, "Tenant subscription was not found");
  const plan = tenant.planId ? await SubscriptionPlanModel.findById(tenant.planId).lean() : null;
  if (!plan) throw upgrade("A meeting-enabled plan is required", {});
  const addons = tenant.enabledAddonSlugs.length
    ? await ProductAddonModel.find({
        slug: { $in: tenant.enabledAddonSlugs },
        isActive: true,
      }).lean()
    : [];
  const limits = addons.reduce(
    (current, addon) => {
      const boost = addon.meetingLimitBoost;
      if (!boost) return current;
      return {
        ...current,
        maxParticipants: current.maxParticipants + boost.additionalParticipants,
        monthlyMinutes: current.monthlyMinutes + boost.additionalMonthlyMinutes,
        concurrentMeetings: current.concurrentMeetings + boost.additionalConcurrentMeetings,
        recordingStorageMb: current.recordingStorageMb + boost.additionalRecordingStorageMb,
        retentionDays: current.retentionDays + boost.additionalRetentionDays,
        recordingEnabled: current.recordingEnabled || boost.enableRecording,
      };
    },
    { ...plan.meetingLimits },
  );
  if (
    tenant.unlimitedMeetingsUntil &&
    new Date(tenant.unlimitedMeetingsUntil).getTime() >= Date.now()
  ) {
    limits.monthlyMinutes = Number.MAX_SAFE_INTEGER;
  }
  return { tenant, plan, limits, addons };
}
const range = (date = new Date()) => {
  const n = date;
  return {
    start: new Date(n.getFullYear(), n.getMonth(), 1),
    end: new Date(n.getFullYear(), n.getMonth() + 1, 1),
  };
};
export const meetingEntitlementService = {
  async assertSchedule(minutes: number, scheduledAt = new Date()) {
    const { limits } = await resolve();
    if (minutes > limits.maxDurationMinutes)
      throw upgrade("Meeting duration exceeds your plan", {
        limit: limits.maxDurationMinutes,
        requested: minutes,
      });
    const { start, end } = range(scheduledAt);
    const r = await MeetingModel.aggregate([
      { $match: { scheduledAt: { $gte: start, $lt: end }, status: { $ne: "cancelled" } } },
      { $group: { _id: null, used: { $sum: "$durationMinutes" } } },
    ]);
    const used = Number(r[0]?.used ?? 0);
    if (!limits.monthlyMinutes || used + minutes > limits.monthlyMinutes)
      throw upgrade("Monthly meeting allowance reached", {
        used,
        requested: minutes,
        limit: limits.monthlyMinutes,
      });
    return limits;
  },
  async limits() {
    return (await resolve()).limits;
  },
  async usage() {
    const { tenant, plan, limits, addons } = await resolve();
    const { start, end } = range();
    const r = await MeetingUsageModel.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          minutes: { $sum: "$consumedMinutes" },
          meetings: { $sum: 1 },
          peak: { $max: "$peakParticipants" },
          recordingBytes: { $sum: "$recordingBytes" },
        },
      },
    ]);
    const storage = await MeetingRecordingModel.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, bytes: { $sum: "$bytes" } } },
    ]);
    const activeMeetings = await MeetingUsageModel.countDocuments({ endedAt: { $exists: false } });
    return {
      plan: plan.name,
      limits,
      unlimitedMeetingsUntil: tenant.unlimitedMeetingsUntil,
      periodStart: start,
      periodEnd: end,
      usedMinutes: r[0]?.minutes ?? 0,
      meetings: r[0]?.meetings ?? 0,
      peakParticipants: r[0]?.peak ?? 0,
      recordingBytes: storage[0]?.bytes ?? 0,
      activeMeetings,
      enabledAddonSlugs: addons.map((addon) => addon.slug),
    };
  },
  async start(meetingId: string, hostId: string) {
    const { limits } = await resolve();
    const active = await MeetingUsageModel.countDocuments({
      endedAt: { $exists: false },
      meetingId: { $ne: meetingId },
    });
    if (active >= limits.concurrentMeetings)
      throw upgrade("Concurrent meeting capacity reached", {
        current: active,
        limit: limits.concurrentMeetings,
      });
    return MeetingUsageModel.findOneAndUpdate(
      { meetingId },
      { $setOnInsert: { hostId, startedAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
  },
  async end(meetingId: string) {
    const u = await MeetingUsageModel.findOne({ meetingId });
    if (!u) return;
    const end = new Date();
    u.endedAt = end;
    u.consumedMinutes = Math.max(
      1,
      Math.ceil((end.getTime() - (u.startedAt ?? end).getTime()) / 60000),
    );
    for (const s of u.participantSessions)
      if (!s.leftAt) {
        s.leftAt = end;
        s.durationSeconds = Math.max(0, Math.floor((end.getTime() - s.joinedAt.getTime()) / 1000));
      }
    await u.save();
  },
  async join(meetingId: string, userId: string) {
    const limits = await this.limits();
    const joinedAt = new Date();
    const usage = await MeetingUsageModel.findOneAndUpdate(
      {
        meetingId,
        activeParticipantIds: { $ne: userId },
        $expr: {
          $lt: [{ $size: { $ifNull: ["$activeParticipantIds", []] } }, limits.maxParticipants],
        },
      },
      [
        {
          $set: {
            activeParticipantIds: {
              $concatArrays: [{ $ifNull: ["$activeParticipantIds", []] }, [userId]],
            },
            participantSessions: {
              $concatArrays: [
                { $ifNull: ["$participantSessions", []] },
                [{ userId, joinedAt, durationSeconds: 0 }],
              ],
            },
            peakParticipants: {
              $max: [
                { $ifNull: ["$peakParticipants", 0] },
                { $add: [{ $size: { $ifNull: ["$activeParticipantIds", []] } }, 1] },
              ],
            },
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true },
    );
    if (usage) return;

    const existing = await MeetingUsageModel.findOne({ meetingId })
      .select("activeParticipantIds")
      .lean();
    if (existing?.activeParticipantIds.map(String).includes(userId)) return;
    if (!existing) throw createError(409, "Meeting usage has not been started by the host");
    if (existing.activeParticipantIds.length >= limits.maxParticipants)
      throw upgrade("Participant capacity reached", {
        limit: limits.maxParticipants,
        current: existing.activeParticipantIds.length,
      });
    throw createError(409, "Meeting join state changed; please try again");
  },
  async leave(meetingId: string, userId: string) {
    const usage = await MeetingUsageModel.findOne({ meetingId });
    if (!usage) return;
    const session = [...usage.participantSessions]
      .reverse()
      .find((item) => String(item.userId) === userId && !item.leftAt);
    if (!session) return;
    session.leftAt = new Date();
    session.durationSeconds = Math.max(
      0,
      Math.floor((session.leftAt.getTime() - session.joinedAt.getTime()) / 1000),
    );
    usage.activeParticipantIds = usage.activeParticipantIds.filter(
      (participantId) => String(participantId) !== userId,
    );
    await usage.save();
    const meeting = await MeetingModel.findById(meetingId).select("durationMinutes attendees");
    if (!meeting) return;
    const totalSeconds = Math.max(60, Number(meeting.durationMinutes || 60) * 60);
    const sessions = usage.participantSessions.filter((item) => String(item.userId) === userId);
    const durationSeconds = sessions.reduce(
      (sum, item) => sum + Number(item.durationSeconds || 0),
      0,
    );
    const attendancePercentage = Math.min(100, Math.round((durationSeconds / totalSeconds) * 100));
    const existing = meeting.attendees.find((item) => String(item.userId) === userId);
    if (existing) {
      existing.joinedAt = existing.joinedAt || sessions[0]?.joinedAt;
      existing.leftAt = session.leftAt;
      existing.durationSeconds = durationSeconds;
      existing.attendancePercentage = attendancePercentage;
      existing.attended = attendancePercentage >= 60;
    } else {
      meeting.attendees.push({
        userId: session.userId,
        joinedAt: sessions[0]?.joinedAt,
        leftAt: session.leftAt,
        durationSeconds,
        attendancePercentage,
        attended: attendancePercentage >= 60,
      });
    }
    await meeting.save();
  },
};
