import createError from "http-errors";
import { Types } from "mongoose";
import { DepartmentModel } from "../models/department.model";
import {
  CommunicationCampaignModel,
  CommunicationSuppressionModel,
  CommunicationTemplateModel,
} from "../models/communication-hub.model";
import { createHash } from "node:crypto";
import { SystemRole } from "../constants/roles";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "../models/notification.model";
import { NotificationModel } from "../models/notification.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { UserModel } from "../models/user.model";
import { notificationService } from "./notification.service";
import { externalConnectorService } from "./external-connector.service";
import { jobQueueService } from "./job-queue.service";

type TChannel = "in_app" | "email" | "push" | "sms";
type TAudience = "all" | "students" | "faculty" | "parents" | "admin" | "specific_users";

const channelMap: Record<Exclude<TChannel, "sms">, NotificationChannel> = {
  in_app: NotificationChannel.IN_APP,
  email: NotificationChannel.EMAIL,
  push: NotificationChannel.PUSH,
};
function templateVariables(subject: string, body: string) {
  return Array.from(
    new Set(
      [
        ...subject.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g),
        ...body.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g),
      ]
        .map((match) => match[1])
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

async function recipientIds(input: {
  audience: TAudience;
  targetDepartments?: string[];
  targetPrograms?: string[];
  targetSemesters?: number[];
  targetUserIds?: string[];
}) {
  if (input.audience === "specific_users") {
    const users = await UserModel.find({
      _id: { $in: input.targetUserIds ?? [] },
      status: "active",
    })
      .select("_id")
      .lean();
    return users.map((user) => user._id.toString());
  }
  if (
    input.audience === "students" &&
    (input.targetDepartments?.length ||
      input.targetPrograms?.length ||
      input.targetSemesters?.length)
  ) {
    const studentFilter: Record<string, unknown> = { status: StudentStatus.ACTIVE };
    if (input.targetPrograms?.length) studentFilter["program"] = { $in: input.targetPrograms };
    if (input.targetSemesters?.length)
      studentFilter["currentSemester"] = { $in: input.targetSemesters };
    if (input.targetDepartments?.length)
      studentFilter["department"] = {
        $in: input.targetDepartments.map((id) => new Types.ObjectId(id)),
      };
    const profiles = await StudentProfileModel.find(studentFilter).select("userId").lean();
    return profiles.map((profile) => profile.userId.toString());
  }
  const roleFilter: Partial<Record<TAudience, SystemRole[]>> = {
    students: [SystemRole.STUDENT],
    faculty: [SystemRole.FACULTY],
    parents: [SystemRole.PARENT],
    admin: [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL, SystemRole.HOD],
  };
  const filter: Record<string, unknown> = { status: "active" };
  const roles = roleFilter[input.audience];
  if (roles) filter["roles"] = { $in: roles };
  if (input.targetDepartments?.length)
    filter["department"] = {
      $in: input.targetDepartments.map((id) => new Types.ObjectId(id)),
    };
  const users = await UserModel.find(filter).select("_id").lean();
  return users.map((user) => user._id.toString());
}

async function consentedRecipientIds(recipientIds: string[], channels: TChannel[]) {
  const consentChecks = channels.map((channel) => ({
    $or: [
      {
        [`notificationPreferences.${channel === "in_app" ? "inApp" : channel}`]: { $exists: false },
      },
      { [`notificationPreferences.${channel === "in_app" ? "inApp" : channel}`]: true },
    ],
  }));
  const users = await UserModel.find({
    _id: { $in: recipientIds },
    status: "active",
    ...(consentChecks.length ? { $and: consentChecks } : {}),
  })
    .select("_id email phone")
    .lean();
  const suppressible = channels.filter(
    (channel): channel is "email" | "sms" => channel === "email" || channel === "sms",
  );
  if (!suppressible.length) return users.map((user) => user._id.toString());
  const destinationHash = (value: unknown) =>
    createHash("sha256")
      .update(
        String(value ?? "")
          .trim()
          .toLowerCase(),
      )
      .digest("hex");
  const candidateHashes = users.flatMap((user) =>
    suppressible.map((channel) => ({
      channel,
      destinationHash: destinationHash(channel === "email" ? user.email : user.phone),
    })),
  );
  const suppressed = await CommunicationSuppressionModel.find({
    active: true,
    $or: candidateHashes,
  })
    .select("channel destinationHash")
    .lean();
  const blocked = new Set(suppressed.map((row) => `${row.channel}:${row.destinationHash}`));
  return users
    .filter((user) =>
      suppressible.every(
        (channel) =>
          !blocked.has(
            `${channel}:${destinationHash(channel === "email" ? user.email : user.phone)}`,
          ),
      ),
    )
    .map((user) => user._id.toString());
}

export const communicationHubService = {
  async metadata(departmentId?: string) {
    const [departments, programs] = await Promise.all([
      DepartmentModel.find({ isActive: true, ...(departmentId ? { _id: departmentId } : {}) })
        .select("name code")
        .sort({ name: 1 })
        .lean(),
      StudentProfileModel.distinct("program", { status: StudentStatus.ACTIVE }),
    ]);
    return {
      channels: ["in_app", "email", "push", "sms"],
      audiences: ["all", "students", "faculty", "parents", "admin", "specific_users"],
      departments,
      programs: programs.filter(Boolean).sort(),
      semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    };
  },
  listCampaigns: (filter: Record<string, unknown> = {}) =>
    CommunicationCampaignModel.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
  audiencePreview: async (input: {
    channels: TChannel[];
    audience: TAudience;
    targetDepartments?: string[];
    targetPrograms?: string[];
    targetSemesters?: number[];
    targetUserIds?: string[];
  }) => {
    const audienceIds = await recipientIds(input);
    const eligibleIds = await consentedRecipientIds(audienceIds, input.channels);
    return {
      matched: audienceIds.length,
      eligible: eligibleIds.length,
      excluded: Math.max(0, audienceIds.length - eligibleIds.length),
      note:
        audienceIds.length === eligibleIds.length
          ? "Everyone matched is eligible for the selected channels."
          : "Excluded recipients have disabled a selected channel or are on the suppression list.",
    };
  },
  campaignDetail: async (id: string, filter: Record<string, unknown> = {}) => {
    const campaign = await CommunicationCampaignModel.findOne({ _id: id, ...filter })
      .populate("createdBy", "name email")
      .lean();
    if (!campaign) throw createError(404, "Campaign not found");
    const notification = campaign.notificationId
      ? await NotificationModel.findById(campaign.notificationId)
          .select("totalRead readBy sentAt isSent")
          .lean()
      : null;
    return {
      ...campaign,
      readCount: notification?.totalRead ?? notification?.readBy?.length ?? 0,
      unreadCount: Math.max(
        0,
        campaign.recipientCount - (notification?.totalRead ?? notification?.readBy?.length ?? 0),
      ),
    };
  },
  listTemplates: () =>
    CommunicationTemplateModel.find({ isActive: true }).sort({ updatedAt: -1 }).lean(),
  listSuppressions: () =>
    CommunicationSuppressionModel.find().sort({ updatedAt: -1 }).limit(500).lean(),
  suppress: async (
    channel: "email" | "sms",
    destination: string,
    reason: string,
    userId: string,
  ) => {
    const destinationHash = createHash("sha256")
      .update(destination.trim().toLowerCase())
      .digest("hex");
    return CommunicationSuppressionModel.findOneAndUpdate(
      { channel, destinationHash },
      {
        $set: { reason, active: true, createdBy: userId },
        $unset: { releasedBy: 1, releasedAt: 1 },
      },
      { returnDocument: "after", upsert: true, runValidators: true },
    ).lean();
  },
  releaseSuppression: async (id: string, userId: string) => {
    const row = await CommunicationSuppressionModel.findOneAndUpdate(
      { _id: id, active: true },
      { $set: { active: false, releasedBy: userId, releasedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(404, "Active suppression entry not found");
    return row;
  },
  saveTemplate: async (
    input: { name: string; category: string; subject: string; body: string; channels: TChannel[] },
    userId: string,
    id?: string,
  ) => {
    const data = {
      ...input,
      variables: templateVariables(input.subject, input.body),
      isActive: true,
    };
    if (!id) return CommunicationTemplateModel.create({ ...data, createdBy: userId });
    const row = await CommunicationTemplateModel.findByIdAndUpdate(
      id,
      { $set: { ...data, updatedBy: userId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw createError(404, "Communication template not found");
    return row;
  },
  createCampaign: async (
    input: {
      title: string;
      body: string;
      channels: TChannel[];
      audience: TAudience;
      targetDepartments?: string[];
      targetPrograms?: string[];
      targetSemesters?: number[];
      targetUserIds?: string[];
      scheduledAt?: string;
      priority?: "normal" | "important" | "emergency";
      requireAcknowledgement?: boolean;
    },
    userId: string,
    userName: string,
  ) => {
    if (!input.channels.length) throw createError(400, "Select at least one delivery channel");
    if (input.audience === "specific_users" && !input.targetUserIds?.length)
      throw createError(400, "Select at least one recipient");
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    if (scheduledAt && scheduledAt <= new Date())
      throw createError(400, "Scheduled time must be in the future");
    const audienceRecipientIds = await recipientIds(input);
    const resolvedRecipientIds = await consentedRecipientIds(audienceRecipientIds, input.channels);
    const count = resolvedRecipientIds.length;
    if (count === 0) throw createError(400, "The selected audience has no active recipients");
    const supported = input.channels.filter((channel) => channel !== "sms") as Array<
      Exclude<TChannel, "sms">
    >;
    const notification = supported.length
      ? await notificationService.create({
          title: input.title,
          body: input.body,
          type: NotificationType.GENERAL,
          channels: supported.map((channel) => channelMap[channel]),
          audience: NotificationAudience.SPECIFIC_USER,
          targetDepartments: input.targetDepartments,
          targetPrograms: input.targetPrograms,
          targetSemesters: input.targetSemesters,
          targetUserIds: resolvedRecipientIds,
          isScheduled: Boolean(scheduledAt),
          scheduledAt: scheduledAt?.toISOString(),
          createdBy: userId,
          createdByName: userName,
        })
      : null;
    const smsConnector = input.channels.includes("sms")
      ? await externalConnectorService.enabledFor("sms.send")
      : null;
    const status = scheduledAt ? "scheduled" : "sent";
    const campaign = await CommunicationCampaignModel.create({
      ...input,
      targetUserIds: resolvedRecipientIds,
      scheduledAt,
      status,
      notificationId: notification?._id,
      recipientCount: count,
      priority: input.priority ?? "normal",
      requireAcknowledgement: Boolean(input.requireAcknowledgement),
      channelStats: input.channels.map((channel) =>
        channel === "sms" && !smsConnector
          ? {
              channel,
              queued: 0,
              accepted: 0,
              delivered: 0,
              failed: count,
              status: "unavailable",
              message: "Configure an SMS connector before enabling SMS delivery",
            }
          : {
              channel,
              queued: count,
              accepted: channel === "sms" ? 0 : scheduledAt ? 0 : count,
              delivered: channel === "sms" ? 0 : scheduledAt ? 0 : count,
              failed: 0,
              status: channel === "sms" || scheduledAt ? "pending" : "sent",
            },
      ),
      createdBy: userId,
      sentAt: scheduledAt ? undefined : new Date(),
    });
    if (smsConnector && !scheduledAt) {
      const recipients = await UserModel.find({
        _id: { $in: resolvedRecipientIds },
        phone: { $exists: true, $ne: "" },
        $or: [
          { "notificationPreferences.sms": { $exists: false } },
          { "notificationPreferences.sms": true },
        ],
      })
        .select("phone")
        .lean();
      await Promise.all(
        recipients.map((recipient) =>
          jobQueueService.enqueue(
            "connector.sms.send",
            `campaign:${campaign._id}:${recipient._id}`,
            {
              campaignId: String(campaign._id),
              connectorId: String(smsConnector._id),
              to: recipient.phone,
              body: input.body,
              deliveryKey: `campaign:${campaign._id}:${recipient._id}`,
              requestedBy: userId,
            },
          ),
        ),
      );
      return CommunicationCampaignModel.findById(campaign._id).lean().exec();
    }
    return campaign;
  },
  cancelCampaign: async (id: string, userId: string, canManageAll = false) => {
    const campaign = await CommunicationCampaignModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["draft", "scheduled"] },
        ...(canManageAll ? {} : { createdBy: userId }),
      },
      { $set: { status: "cancelled", cancelledAt: new Date(), updatedBy: userId } },
      { returnDocument: "after" },
    );
    if (!campaign) throw createError(409, "Only draft or scheduled campaigns can be cancelled");
    if (campaign.notificationId)
      await notificationService.deactivate(campaign.notificationId.toString());
    return campaign;
  },
  retryCampaign: async (id: string, userId: string, reason: string, canManageAll = false) => {
    const campaign = await CommunicationCampaignModel.findOne({
      _id: id,
      ...(canManageAll ? {} : { createdBy: userId }),
    }).lean();
    if (!campaign) throw createError(404, "Campaign not found");
    const sms = campaign.channelStats.find((item) => item.channel === "sms");
    if (!sms?.failed) throw createError(409, "This campaign has no failed SMS deliveries to retry");
    const deadEvents = (await jobQueueService.listDead()).filter(
      (event) =>
        event.topic === "connector.sms.send" && event.idempotencyKey.startsWith(`campaign:${id}:`),
    );
    if (!deadEvents.length)
      throw createError(409, "No retryable delivery records remain for this campaign");
    await Promise.all(
      deadEvents.map((event) => jobQueueService.replay(String(event._id), userId, reason)),
    );
    await CommunicationCampaignModel.updateOne(
      { _id: id, "channelStats.channel": "sms" },
      {
        $set: {
          "channelStats.$.failed": Math.max(0, sms.failed - deadEvents.length),
          "channelStats.$.status": "pending",
          "channelStats.$.message": `${deadEvents.length} failed deliveries queued for retry`,
        },
      },
    );
    return {
      campaignId: id,
      queued: deadEvents.length,
      message: "Failed deliveries were safely queued with new idempotency keys",
    };
  },
  processScheduledSms: async () => {
    const campaigns = await CommunicationCampaignModel.find({
      status: { $in: ["sent", "scheduled"] },
      scheduledAt: { $lte: new Date() },
      channelStats: { $elemMatch: { channel: "sms", status: "pending" } },
    })
      .limit(50)
      .exec();
    const connector = campaigns.length
      ? await externalConnectorService.enabledFor("sms.send")
      : null;
    if (!connector) return 0;
    for (const campaign of campaigns) {
      const recipients = await UserModel.find({
        _id: { $in: campaign.targetUserIds },
        phone: { $exists: true, $ne: "" },
        $or: [
          { "notificationPreferences.sms": { $exists: false } },
          { "notificationPreferences.sms": true },
        ],
      })
        .select("phone")
        .lean();
      await Promise.all(
        recipients.map((recipient) =>
          jobQueueService.enqueue(
            "connector.sms.send",
            `campaign:${campaign._id}:${recipient._id}`,
            {
              campaignId: String(campaign._id),
              connectorId: String(connector._id),
              to: recipient.phone,
              body: campaign.body,
              deliveryKey: `campaign:${campaign._id}:${recipient._id}`,
              requestedBy: campaign.createdBy.toString(),
            },
          ),
        ),
      );
      await CommunicationCampaignModel.updateOne(
        { _id: campaign._id, "channelStats.channel": "sms" },
        {
          $set: {
            status: "sent",
            sentAt: campaign.sentAt ?? new Date(),
            "channelStats.$.queued": recipients.length,
            "channelStats.$.status": "pending",
          },
        },
      ).exec();
    }
    return campaigns.length;
  },
};
