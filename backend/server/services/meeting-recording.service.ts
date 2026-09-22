import crypto from "crypto";
import cloudinary from "cloudinary";
import createError from "http-errors";
import { tenantLocalStorage } from "../configs/connectionManager";
import { MeetingModel } from "../models/meeting.model";
import { MeetingRecordingModel } from "../models/meeting-recording.model";
import { MeetingUsageModel } from "../models/meeting-usage.model";
import { meetingEntitlementService } from "./meeting-entitlement.service";
import { configureCloudinary } from "./cloudinary-client.service";

async function assertHost(meetingId: string, userId: string) {
  const meeting = await MeetingModel.findById(meetingId)
    .select("title conductedBy createdBy")
    .lean();
  if (!meeting) throw createError(404, "Meeting not found");
  if (![String(meeting.conductedBy), String(meeting.createdBy)].includes(userId))
    throw createError(403, "Only the meeting host can manage recordings");
  return meeting;
}

export const meetingRecordingService = {
  async deletionImpact(meetingId: string) {
    const recordings = await MeetingRecordingModel.find({ meetingId, status: "active" })
      .select("bytes")
      .lean();
    return {
      recordingCount: recordings.length,
      recordingBytes: recordings.reduce((total, recording) => total + recording.bytes, 0),
    };
  },

  async removeForMeeting(meetingId: string) {
    const recordings = await MeetingRecordingModel.find({ meetingId, status: "active" });
    if (recordings.length === 0) return { deletedCount: 0, deletedBytes: 0 };

    await configureCloudinary();
    let deletedBytes = 0;
    for (const recording of recordings) {
      const result = await cloudinary.v2.uploader.destroy(recording.publicId, {
        resource_type: "video",
        type: "authenticated",
      });
      if (!["ok", "not found"].includes(String(result.result))) {
        throw createError(
          502,
          `Meeting was not deleted because recording storage cleanup failed for ${recording.title}`,
        );
      }
      recording.status = "deleted";
      recording.deletedAt = new Date();
      await recording.save();
      deletedBytes += recording.bytes;
    }
    return { deletedCount: recordings.length, deletedBytes };
  },

  async signature(meetingId: string, userId: string) {
    await assertHost(meetingId, userId);
    const limits = await meetingEntitlementService.limits();
    if (!limits.recordingEnabled)
      throw createError(402, "Meeting recording is not included in the current plan", {
        code: "MEETING_RECORDING_UPGRADE_REQUIRED",
      });
    const storage = await configureCloudinary();
    const tenantId = tenantLocalStorage.getStore()?.tenantId;
    if (!tenantId) throw createError(400, "Tenant context required");
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `erp/${tenantId}/meeting-recordings/${meetingId}`;
    const publicId = `${timestamp}-${crypto.randomBytes(8).toString("hex")}`;
    const signature = cloudinary.v2.utils.api_sign_request(
      { folder, public_id: publicId, timestamp, type: "authenticated" },
      storage.apiSecret,
    );
    return {
      cloudName: storage.cloudName,
      apiKey: storage.apiKey,
      timestamp,
      folder,
      publicId,
      signature,
      resourceType: "video",
      deliveryType: "authenticated",
      maxStorageBytes: limits.recordingStorageMb * 1024 * 1024,
    };
  },

  async register(meetingId: string, userId: string, input: Record<string, unknown>) {
    await configureCloudinary();
    const meeting = await assertHost(meetingId, userId);
    const consentState = await MeetingModel.findById(meetingId)
      .select("recordingConsentRequired recordingConsentUserIds attendees")
      .lean();
    if (consentState?.recordingConsentRequired) {
      const consented = new Set((consentState.recordingConsentUserIds ?? []).map(String));
      const missing = (consentState.attendees ?? [])
        .filter((attendee) => attendee.attended)
        .some((attendee) => !consented.has(String(attendee.userId)));
      if (missing) throw createError(409, "Recording cannot be retained without attendee consent");
    }
    const limits = await meetingEntitlementService.limits();
    if (!limits.recordingEnabled) throw createError(402, "Meeting recording requires an add-on");
    const publicId = String(input.publicId || "");
    const tenantId = tenantLocalStorage.getStore()?.tenantId;
    const expectedPrefix = `erp/${tenantId}/meeting-recordings/${meetingId}/`;
    if (!publicId.startsWith(expectedPrefix)) throw createError(400, "Invalid recording location");

    const asset = await cloudinary.v2.api.resource(publicId, {
      resource_type: "video",
      type: "authenticated",
    });
    const bytes = Number(asset.bytes || 0);
    if (!bytes || !asset.secure_url)
      throw createError(400, "Recording upload could not be verified");
    const storage = await MeetingRecordingModel.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, bytes: { $sum: "$bytes" } } },
    ]);
    const used = Number(storage[0]?.bytes || 0);
    const limit = limits.recordingStorageMb * 1024 * 1024;
    if (limit <= 0 || used + bytes > limit) {
      await cloudinary.v2.uploader.destroy(publicId, {
        resource_type: "video",
        type: "authenticated",
      });
      throw createError(402, "Recording storage allowance reached", {
        code: "MEETING_RECORDING_STORAGE_LIMIT",
        details: { used, requested: bytes, limit },
      });
    }
    const expiresAt = new Date(Date.now() + limits.retentionDays * 86_400_000);
    const recording = await MeetingRecordingModel.create({
      meetingId,
      title: String(input.title || `${meeting.title} recording`),
      secureUrl: String(asset.secure_url),
      publicId,
      bytes,
      durationSeconds: Math.max(1, Math.ceil(Number(asset.duration || input.durationSeconds || 1))),
      format: String(asset.format || "webm"),
      expiresAt,
      uploadedBy: userId,
    });
    await MeetingUsageModel.updateOne({ meetingId }, { $inc: { recordingBytes: bytes } });
    return recording;
  },

  async list(meetingId: string, userId: string) {
    await configureCloudinary();
    await assertHost(meetingId, userId);
    const recordings = await MeetingRecordingModel.find({ meetingId, status: "active" })
      .sort({ createdAt: -1 })
      .lean();
    return recordings.map((recording) => ({
      ...recording,
      secureUrl: undefined,
      playbackUrl: cloudinary.v2.url(recording.publicId, {
        resource_type: "video",
        type: "authenticated",
        sign_url: true,
        secure: true,
      }),
    }));
  },

  async remove(recordingId: string, userId: string) {
    await configureCloudinary();
    const recording = await MeetingRecordingModel.findById(recordingId);
    if (!recording || recording.status !== "active") throw createError(404, "Recording not found");
    await assertHost(String(recording.meetingId), userId);
    const result = await cloudinary.v2.uploader.destroy(recording.publicId, {
      resource_type: "video",
      type: "authenticated",
    });
    if (!["ok", "not found"].includes(String(result.result)))
      throw createError(502, "Recording storage deletion failed");
    recording.status = "deleted";
    recording.deletedAt = new Date();
    await recording.save();
    return recording;
  },

  async purgeExpired() {
    await configureCloudinary();
    const recordings = await MeetingRecordingModel.find({
      status: "active",
      expiresAt: { $lte: new Date() },
    }).limit(100);
    let deleted = 0;
    for (const recording of recordings) {
      const result = await cloudinary.v2.uploader.destroy(recording.publicId, {
        resource_type: "video",
        type: "authenticated",
      });
      if (!["ok", "not found"].includes(String(result.result))) continue;
      recording.status = "expired";
      recording.deletedAt = new Date();
      await recording.save();
      deleted += 1;
    }
    return deleted;
  },
};
