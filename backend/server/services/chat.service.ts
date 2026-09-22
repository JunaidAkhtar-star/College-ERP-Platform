import { chatRepository } from "../repositories";
import { emitToUser, getIO } from "../socket/socket.gateway";
import { tenantLocalStorage } from "../configs/connectionManager";
import { UserModel } from "../models/user.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { DepartmentModel } from "../models/department.model";
import { ClubModel } from "../models/club.model";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "../models/notification.model";
import { notificationService } from "./notification.service";
import { SystemRole } from "../constants/roles";
import type { Types } from "mongoose";
import createError from "http-errors";

const USER_PROJECTION = "name email avatar roles";

interface IContactUser {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  avatar?: string;
  roles: SystemRole[];
  /** Short label rendered as a chip on the frontend. */
  tag?: string;
}

interface IContactSection {
  label: string;
  users: IContactUser[];
}

interface IChatActor {
  _id: Types.ObjectId | string;
  roles?: SystemRole[];
}

interface IChatContactFilters {
  contactType?: "default" | "faculty" | "students";
  departmentId?: string;
  program?: string;
  academicYear?: string;
}

const INSTITUTION_WIDE_CHAT_ROLES = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
]);

const ACADEMIC_LEADERSHIP_CHAT_ROLES = new Set<SystemRole>([
  SystemRole.DEAN_ACADEMIC,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
]);

async function getChatDepartment(userId: string): Promise<string | null> {
  const user = await UserModel.findById(userId).select("department").lean();
  if (user?.department) return String(user.department);
  const [student, faculty] = await Promise.all([
    StudentProfileModel.findOne({ userId }).select("department").lean(),
    FacultyProfileModel.findOne({ userId }).select("department").lean(),
  ]);
  return String(student?.department ?? faculty?.department ?? "") || null;
}

/** Batch-enforces the institution hierarchy for direct chats and group changes. */
async function assertCanInitiateChats(
  actor: IChatActor,
  targetUserIds: string[],
  activeRole?: SystemRole,
): Promise<void> {
  const actorId = String(actor._id);
  const uniqueTargetIds = [...new Set(targetUserIds)].filter((id) => id !== actorId);
  if (!uniqueTargetIds.length) return;
  let role = activeRole ?? actor.roles?.[0];
  if (!role) {
    const actorUser = await UserModel.findById(actorId).select("roles").lean();
    role = actorUser?.roles?.[0];
  }
  const targets = await UserModel.find({ _id: { $in: uniqueTargetIds }, status: "active" })
    .select("roles department")
    .lean();
  if (!role || targets.length !== uniqueTargetIds.length)
    throw createError(404, "One or more active recipients were not found");
  if (INSTITUTION_WIDE_CHAT_ROLES.has(role)) return;

  const academicRoles = new Set<SystemRole>([
    SystemRole.PRINCIPAL,
    SystemRole.DEAN_ACADEMIC,
    SystemRole.ADMINISTRATION_OFFICE,
    SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
    SystemRole.HOD,
    SystemRole.FACULTY,
    SystemRole.STUDENT,
  ]);
  if (
    ACADEMIC_LEADERSHIP_CHAT_ROLES.has(role) &&
    targets.every((target) =>
      (target.roles ?? []).some((targetRole) => academicRoles.has(targetRole)),
    )
  )
    return;

  const [actorDepartment, students, faculty, clubs, actorStudent] = await Promise.all([
    getChatDepartment(actorId),
    StudentProfileModel.find({ userId: { $in: uniqueTargetIds } })
      .select("userId department mentor")
      .lean(),
    FacultyProfileModel.find({ userId: { $in: uniqueTargetIds } })
      .select("userId department")
      .lean(),
    ClubModel.find({
      isActive: true,
      $or: [{ "members.userId": actorId }, { studentHead: actorId }, { facultyAdvisor: actorId }],
    })
      .select("members.userId studentHead facultyAdvisor")
      .lean(),
    role === SystemRole.STUDENT
      ? StudentProfileModel.findOne({ userId: actorId }).select("mentor").lean()
      : null,
  ]);

  const departments = new Map<string, string>();
  targets.forEach((target) => {
    if (target.department) departments.set(String(target._id), String(target.department));
  });
  students.forEach((profile) =>
    departments.set(String(profile.userId), String(profile.department ?? "")),
  );
  faculty.forEach((profile) =>
    departments.set(String(profile.userId), String(profile.department ?? "")),
  );
  const menteeIds = new Set(
    students
      .filter((profile) => String(profile.mentor ?? "") === actorId)
      .map((profile) => String(profile.userId)),
  );
  const clubPeerIds = new Set<string>();
  clubs.forEach((club) => {
    club.members?.forEach((member) => clubPeerIds.add(String(member.userId)));
    if (club.studentHead) clubPeerIds.add(String(club.studentHead));
    if (club.facultyAdvisor) clubPeerIds.add(String(club.facultyAdvisor));
  });

  const unauthorized = targets.some((target) => {
    const targetId = String(target._id);
    const targetRoles = target.roles ?? [];
    if (
      targetRoles.some((targetRole) =>
        [SystemRole.PRINCIPAL, SystemRole.DEAN_ACADEMIC].includes(targetRole),
      )
    )
      return false;
    if (clubPeerIds.has(targetId)) return false;
    if (role === SystemRole.HOD && targetRoles.includes(SystemRole.HOD)) return false;
    const sameDepartment = Boolean(
      actorDepartment && departments.get(targetId) === actorDepartment,
    );
    if (
      role === SystemRole.HOD &&
      sameDepartment &&
      targetRoles.some((targetRole) =>
        [SystemRole.FACULTY, SystemRole.STUDENT].includes(targetRole),
      )
    )
      return false;
    if (role === SystemRole.FACULTY) {
      if (sameDepartment && targetRoles.includes(SystemRole.FACULTY)) return false;
      if (sameDepartment && targetRoles.includes(SystemRole.HOD)) return false;
      if (targetRoles.includes(SystemRole.STUDENT) && menteeIds.has(targetId)) return false;
    }
    if (role === SystemRole.STUDENT) {
      if (String(actorStudent?.mentor ?? "") === targetId) return false;
      if (
        sameDepartment &&
        targetRoles.some((targetRole) => [SystemRole.HOD, SystemRole.FACULTY].includes(targetRole))
      )
        return false;
    }
    if (
      role === SystemRole.PARENT &&
      targetRoles.some((targetRole) =>
        [SystemRole.PRINCIPAL, SystemRole.HOD, SystemRole.FACULTY].includes(targetRole),
      )
    )
      return false;
    return true;
  });
  if (unauthorized)
    throw createError(403, "One or more people are outside your permitted chat network");
}

async function assertCanInitiateChat(
  actor: IChatActor,
  targetUserId: string,
  activeRole?: SystemRole,
): Promise<void> {
  return assertCanInitiateChats(actor, [targetUserId], activeRole);
}

function participantIds(conversation: { participants: unknown[] }) {
  return (conversation.participants ?? []).map((participant) => {
    if (!participant) return "";
    if (typeof participant === "object" && "_id" in participant) {
      return String((participant as { _id?: unknown })._id ?? "");
    }
    return String(participant);
  });
}

export async function assertConversationParticipant(conversationId: string, userId: string) {
  const conversation = await chatRepository.findById(conversationId);
  if (!conversation || !conversation.isActive) throw createError(404, "Conversation not found");
  const participants = participantIds(conversation);
  const normalizedUserId = String(userId);
  if (!participants.includes(normalizedUserId)) {
    throw createError(403, "You are not a participant of this conversation");
  }
  return conversation;
}

export const chatService = {
  getOrCreateDirect: async (
    userId1: string,
    userId2: string,
    actor?: IChatActor,
    activeRole?: SystemRole,
  ) => {
    if (userId1 === userId2)
      throw createError(400, "You cannot start a conversation with yourself");
    const recipient = await UserModel.exists({ _id: userId2, status: "active" });
    if (!recipient) throw createError(404, "Active recipient not found");
    const existing = await chatRepository.findDirectConversation(userId1, userId2);
    if (existing) {
      return chatRepository.findByIdPopulated(String(existing._id));
    }
    await assertCanInitiateChat(actor ?? { _id: userId1 }, userId2, activeRole);
    const created = await chatRepository.create({
      type: "direct",
      participants: [userId1, userId2],
      createdBy: userId1,
    });
    return chatRepository.findByIdPopulated(String(created._id));
  },

  createGroup: async (
    name: string,
    participantIds: string[],
    createdBy: string,
    description?: string,
    actor?: IChatActor,
    activeRole?: SystemRole,
  ) => {
    const cleanName = name?.trim();
    if (!cleanName || cleanName.length > 120) throw createError(400, "Group name is invalid");
    const uniqueIds = [...new Set(participantIds.filter((id) => id !== createdBy))];
    if (uniqueIds.length > 199) throw createError(400, "A group can contain at most 200 users");
    const activeCount = await UserModel.countDocuments({
      _id: { $in: uniqueIds },
      status: "active",
    });
    if (activeCount !== uniqueIds.length)
      throw createError(400, "Every group member must be active");
    await assertCanInitiateChats(actor ?? { _id: createdBy }, uniqueIds, activeRole);
    const created = await chatRepository.create({
      type: "group",
      groupName: cleanName,
      groupDescription: description,
      participants: [createdBy, ...uniqueIds],
      groupAdmins: [createdBy],
      createdBy,
    });
    const populated = await chatRepository.findByIdPopulated(String(created._id));

    // Send notifications & real-time events to all group members
    const creator = await UserModel.findById(createdBy).select("name").lean();
    const creatorName = creator?.name ?? "Someone";

    for (const memberId of uniqueIds) {
      try {
        emitToUser(memberId, "new_conversation", { conversation: populated });
        await notificationService.create({
          title: `Added to Group: ${cleanName}`,
          body: `${creatorName} added you to the group chat "${cleanName}".`,
          type: NotificationType.GENERAL,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          audience: NotificationAudience.SPECIFIC_USER,
          targetUserIds: [memberId],
          actionUrl: `/chat?conv=${created._id}`,
          createdBy,
          createdByName: creatorName,
        });
      } catch {
        /* non-critical */
      }
    }

    return populated;
  },

  getUserConversations: (userId: string, page: number, limit: number) =>
    chatRepository.getUserConversations(userId, page, limit),

  sendMessage: async (
    conversationId: string,
    senderId: string,
    content: string,
    messageType = "text" as "text" | "file" | "image" | "audio" | "video" | "call_log",
    fileUrl?: string,
    fileName?: string,
    replyTo?: string,
  ) => {
    await assertConversationParticipant(conversationId, senderId);
    const trimmed = (content ?? "").trim();
    // Reject empty messages that have no attachment — prevents blank bubbles.
    // call_log messages are always system-generated with content, skip for them.
    if (!trimmed && !fileUrl && messageType !== "call_log") {
      throw new Error("Message content or attachment is required");
    }
    const updated = await chatRepository.addMessage(conversationId, {
      senderId,
      content: trimmed,
      messageType,
      fileUrl,
      fileName,
      replyTo,
    });
    if (!updated) throw new Error("Conversation not found");
    const message = updated; // addMessage now returns the ChatMessage document

    // Fetch conversation metadata needed for notifications
    const conversation = await chatRepository.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Resolve sender once for nicer notification copy.
    const sender = await UserModel.findById(senderId).select("name").lean();
    const senderName = sender?.name ?? "Someone";

    // Preview text (60 chars) — covers text + simple file labels.
    const preview =
      messageType === "image"
        ? "📷 Photo"
        : messageType === "file"
          ? `📄 ${fileName ?? "File"}`
          : messageType === "audio"
            ? "🎵 Voice message"
            : messageType === "video"
              ? "🎬 Video"
              : messageType === "call_log"
                ? content
                : (content ?? "").slice(0, 60) || "New message";

    // Always include the conversation id so clicking the notification opens
    // the exact chat (not the generic list). The frontend reads `?conv=<id>`
    // from the URL and auto-selects that conversation.
    const actionUrl = `/chat?conv=${conversationId}`;

    // Resolve which participants are currently viewing this conversation
    // (i.e. their socket has joined `conv:<id>`). They do NOT need an in-app
    // notification — the message already lands in their UI in real time.
    // This prevents the "ghost notification" the user sees on the bell after
    // every send.
    let activeViewerIds = new Set<string>();
    try {
      const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
      const sockets = await getIO().in(`conv:${tenantId}:${conversationId}`).fetchSockets();
      activeViewerIds = new Set(
        sockets
          .map((s) => (s.data as Record<string, string>).userId)
          .filter((u): u is string => Boolean(u)),
      );
    } catch {
      /* IO not ready — fall back to creating notifications for everyone */
    }

    // Resolve which participants muted this conversation — they still see the
    // message in real time but should not get a notification / sound / FCM.
    let mutedUserIds = new Set<string>();
    try {
      const muted = await UserModel.find({
        _id: { $in: conversation.participants },
        mutedConversations: conversationId,
      })
        .select("_id")
        .lean();
      mutedUserIds = new Set(muted.map((u) => String(u._id)));
    } catch {
      /* ignore */
    }

    // Real-time push via Socket.IO + always persist an in-app notification.
    // Emit to every participant (including sender) so the sender's own UI also
    // sees their message instantly. Persisting unconditionally guarantees the
    // recipient sees it after a logout/login cycle (we cannot trust live
    // online state because sockets may linger or reconnect during logout).
    for (const participantId of conversation.participants.map(String)) {
      try {
        emitToUser(participantId, "new_message", { conversationId, message });
      } catch {
        /* IO not ready */
      }

      if (participantId === senderId) continue;
      if (activeViewerIds.has(participantId)) continue; // already viewing — skip noise
      if (mutedUserIds.has(participantId)) continue; // user muted this chat
      if (messageType === "call_log") continue; // skip persistent notifications for call system logs

      try {
        await notificationService.create({
          title:
            conversation.type === "group"
              ? `${senderName} in ${conversation.groupName ?? "Group"}`
              : `New message from ${senderName}`,
          body: preview,
          type: NotificationType.GENERAL,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          audience: NotificationAudience.SPECIFIC_USER,
          targetUserIds: [participantId],
          actionUrl,
          createdBy: senderId,
          createdByName: senderName,
        });
      } catch {
        /* Don't fail message send if notification create fails */
      }
    }

    return updated;
  },

  getMessages: async (conversationId: string, userId: string, page: number, limit: number) => {
    await assertConversationParticipant(conversationId, userId);
    return chatRepository.getMessages(conversationId, userId, page, Math.min(limit, 100));
  },

  markRead: async (conversationId: string, userId: string) => {
    await assertConversationParticipant(conversationId, userId);
    const res = await chatRepository.markMessagesRead(conversationId, userId);
    try {
      const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
      getIO().to(`conv:${tenantId}:${conversationId}`).emit("message_read", {
        conversationId,
        userId,
        readAt: new Date().toISOString(),
      });
    } catch {
      /* ignore if IO not ready */
    }
    return res;
  },

  // ── Group Management ───────────────────────────────────────────────────────

  /** Only group admins can add members */
  addMembers: async (
    conversationId: string,
    requesterId: string,
    userIds: string[],
    actor?: IChatActor,
    activeRole?: SystemRole,
  ) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    if (!conv.groupAdmins?.map(String).includes(requesterId))
      throw new Error("Only group admins can add members");
    const uniqueIds = [...new Set(userIds)].filter((id) => !participantIds(conv).includes(id));
    const activeCount = await UserModel.countDocuments({
      _id: { $in: uniqueIds },
      status: "active",
    });
    if (activeCount !== uniqueIds.length) throw createError(400, "Every new member must be active");
    if (conv.participants.length + uniqueIds.length > 200)
      throw createError(400, "Group member limit exceeded");
    await assertCanInitiateChats(actor ?? { _id: requesterId }, uniqueIds, activeRole);
    return chatRepository.addParticipants(conversationId, uniqueIds);
  },

  /** Admin can remove others; anyone can remove themselves (leave) */
  removeMember: async (conversationId: string, requesterId: string, targetUserId: string) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    const isAdmin = conv.groupAdmins?.map(String).includes(requesterId);
    if (requesterId !== targetUserId && !isAdmin) throw new Error("Only admins can remove members");
    return chatRepository.removeParticipant(conversationId, targetUserId);
  },

  /** Leave group (self-remove) */
  leaveGroup: async (conversationId: string, userId: string) => {
    const conv = await assertConversationParticipant(conversationId, userId);
    if (conv.type !== "group") throw createError(400, "Only group conversations can be left");
    if (
      conv.groupAdmins?.map(String).includes(userId) &&
      conv.groupAdmins.length === 1 &&
      conv.participants.length > 1
    )
      throw createError(409, "Assign another group admin before leaving");
    return chatRepository.removeParticipant(conversationId, userId);
  },

  makeAdmin: async (conversationId: string, requesterId: string, targetUserId: string) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    if (!conv.groupAdmins?.map(String).includes(requesterId))
      throw new Error("Only admins can promote members");
    const participantIds = conv.participants.map((p) =>
      String((p as unknown as Record<string, unknown>)._id || p),
    );
    if (!participantIds.includes(targetUserId)) throw new Error("User is not a member");
    return chatRepository.makeAdmin(conversationId, targetUserId);
  },

  removeAdmin: async (conversationId: string, requesterId: string, targetUserId: string) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    if (!conv.groupAdmins?.map(String).includes(requesterId))
      throw new Error("Only admins can demote admins");
    // Prevent removing last admin
    if (
      (conv.groupAdmins?.length ?? 0) <= 1 &&
      conv.groupAdmins?.map(String).includes(targetUserId)
    ) {
      throw new Error("Cannot remove the last admin");
    }
    return chatRepository.removeAdmin(conversationId, targetUserId);
  },

  updateGroupInfo: async (
    conversationId: string,
    requesterId: string,
    data: { groupName?: string; groupAvatar?: string; groupDescription?: string },
  ) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    if (!conv.groupAdmins?.map(String).includes(requesterId))
      throw new Error("Only admins can update group info");
    return chatRepository.updateGroupInfo(conversationId, data);
  },

  generateInviteLink: async (conversationId: string, requesterId: string) => {
    const conv = await chatRepository.findById(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Group not found");
    if (!conv.groupAdmins?.map(String).includes(requesterId))
      throw new Error("Only admins can generate invite links");
    return chatRepository.generateInviteLink(conversationId);
  },

  /** Join group via invite link token */
  joinByInviteLink: async (token: string, userId: string) => {
    const conv = await chatRepository.findByInviteLink(token);
    if (!conv) throw new Error("Invalid or expired invite link");
    const participantIds = conv.participants.map((p) =>
      String((p as unknown as Record<string, unknown>)._id || p),
    );
    const alreadyMember = participantIds.includes(userId);
    if (alreadyMember) return conv;
    return chatRepository.addParticipants(String(conv._id), [userId]);
  },

  // ── Message Actions ────────────────────────────────────────────────────────

  deleteForEveryone: async (conversationId: string, messageId: string, requesterId: string) => {
    await assertConversationParticipant(conversationId, requesterId);
    const updated = await chatRepository.deleteMessageForEveryone(
      conversationId,
      messageId,
      requesterId,
    );
    if (!updated) throw new Error("Message not found or you are not the sender");
    return updated;
  },

  deleteForMe: async (conversationId: string, messageId: string, userId: string) => {
    await assertConversationParticipant(conversationId, userId);
    return chatRepository.deleteMessageForMe(conversationId, messageId, userId);
  },

  addReaction: async (conversationId: string, messageId: string, userId: string, emoji: string) => {
    await assertConversationParticipant(conversationId, userId);
    if (!/^\p{Extended_Pictographic}$/u.test(emoji))
      throw createError(400, "Reaction emoji is invalid");
    return chatRepository.addReaction(conversationId, messageId, userId, emoji);
  },

  // ── Contacts & Directory ───────────────────────────────────────────────────

  /**
   * Suggested contacts for the current user, grouped by relationship.
   * Used by the chat left panel to bootstrap a useful list of people the user
   * can directly message without typing a Mongo ID.
   */
  getContacts: async (
    currentUser: IChatActor,
    activeRole?: SystemRole,
    filters: IChatContactFilters = {},
  ): Promise<{ sections: IContactSection[] }> => {
    const sections: IContactSection[] = [];
    const roles = activeRole ? [activeRole] : (currentUser.roles ?? []);
    const role = roles[0];
    const selfId = String(currentUser._id);
    const seen = new Set<string>([selfId]);
    const tagMap = new Map<string, string>();

    /** Builds a clean, compact program code (e.g. B.Tech, M.Tech, MBA, MCA, BCA). */
    const formatStudentTag = (program?: string, batch?: string): string => {
      if (!program) return batch ? `${batch} Batch` : "Student";
      const PROGRAM_MAP: Record<string, string> = {
        btech: "B.Tech",
        mtech: "M.Tech",
        bsc: "B.Sc",
        msc: "M.Sc",
        bcom: "B.Com",
        mcom: "M.Com",
        ba: "B.A",
        ma: "M.A",
        bca: "BCA",
        mca: "MCA",
        mba: "MBA",
        bba: "BBA",
        phd: "Ph.D",
      };
      const cleanProg = String(program).trim().toLowerCase();
      const head = cleanProg.split(/[\s_-]+/)[0] ?? "";
      const prettyProg = PROGRAM_MAP[head] || cleanProg.toUpperCase();
      return batch ? `${prettyProg} ${batch}` : prettyProg;
    };

    const formatRoleTag = (userRoles: SystemRole[] = []): string => {
      const primary = userRoles[0];
      if (!primary) return "";
      switch (primary) {
        case SystemRole.PRINCIPAL:
          return "Principal";
        case SystemRole.DEAN_ACADEMIC:
          return "Dean";
        case SystemRole.HOD:
          return "HOD";
        case SystemRole.FACULTY:
          return "Faculty";
        case SystemRole.STUDENT:
          return "Student";
        case SystemRole.SUPER_ADMIN:
          return "Super Admin";
        case SystemRole.PARENT:
          return "Parent";
        default:
          return String(primary)
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
      }
    };

    const attachTag = (users: { _id: Types.ObjectId | string; roles?: SystemRole[] }[]) =>
      users.map((u) => ({
        ...u,
        tag: tagMap.get(String(u._id)) ?? formatRoleTag(u.roles ?? []),
      })) as unknown as IContactUser[];

    const pushSection = (label: string, users: IContactUser[]) => {
      const unique = users.filter((u) => {
        const id = String(u._id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (unique.length) sections.push({ label, users: unique });
    };

    const fetchUsersByIds = async (ids: (Types.ObjectId | string)[]) => {
      if (!ids.length) return [] as IContactUser[];
      const users = await UserModel.find({ _id: { $in: ids }, status: "active" })
        .select(USER_PROJECTION)
        .lean();
      return attachTag(users as unknown as IContactUser[]);
    };

    const fetchUsersByRole = async (role: SystemRole, limit = 50) => {
      const users = await UserModel.find({ roles: role, status: "active" })
        .select(USER_PROJECTION)
        .limit(limit)
        .lean();
      return attachTag(users as unknown as IContactUser[]);
    };

    const fetchFacultyWithDepartmentTags = async (departmentId?: string) => {
      const facultyFilter: Record<string, unknown> = {};
      if (departmentId) facultyFilter.department = departmentId;
      const profiles = await FacultyProfileModel.find(facultyFilter)
        .select("userId department")
        .limit(200)
        .lean();
      const departmentIds = [...new Set(profiles.map((profile) => String(profile.department)))];
      const departments = await DepartmentModel.find({ _id: { $in: departmentIds } })
        .select("code")
        .lean();
      const codeByDepartment = new Map(
        departments.map((department) => [String(department._id), department.code]),
      );
      profiles.forEach((profile) => {
        const code = codeByDepartment.get(String(profile.department));
        tagMap.set(String(profile.userId), code ? `${code} Faculty` : "Faculty");
      });
      return fetchUsersByIds(profiles.map((profile) => profile.userId));
    };

    if (filters.contactType === "faculty") {
      const actorDepartment = await getChatDepartment(selfId);
      const mayBrowseAll = Boolean(
        role && (INSTITUTION_WIDE_CHAT_ROLES.has(role) || ACADEMIC_LEADERSHIP_CHAT_ROLES.has(role)),
      );
      if (
        !mayBrowseAll &&
        ![SystemRole.HOD, SystemRole.FACULTY, SystemRole.STUDENT].includes(
          role ?? SystemRole.PARENT,
        )
      )
        return { sections };
      const departmentId = mayBrowseAll ? filters.departmentId : actorDepartment;
      if (!mayBrowseAll && !departmentId) return { sections };
      pushSection("Faculty", await fetchFacultyWithDepartmentTags(departmentId ?? undefined));
      return { sections };
    }

    if (filters.contactType === "students") {
      const mayBrowseAll = Boolean(
        role && (INSTITUTION_WIDE_CHAT_ROLES.has(role) || ACADEMIC_LEADERSHIP_CHAT_ROLES.has(role)),
      );
      const studentFilter: Record<string, unknown> = {};
      if (mayBrowseAll && !filters.departmentId && !filters.program && !filters.academicYear)
        return { sections };
      if (mayBrowseAll && filters.departmentId) studentFilter.department = filters.departmentId;
      if (!mayBrowseAll && role === SystemRole.HOD) {
        const departmentId = await getChatDepartment(selfId);
        if (!departmentId) return { sections };
        studentFilter.department = departmentId;
      } else if (!mayBrowseAll && role === SystemRole.FACULTY) {
        studentFilter.mentor = currentUser._id;
      } else if (!mayBrowseAll) {
        return { sections };
      }
      if (filters.program) studentFilter.program = filters.program;
      if (filters.academicYear) studentFilter.academicYear = filters.academicYear;
      const profiles = await StudentProfileModel.find(studentFilter)
        .select("userId program batch department currentSemester")
        .limit(250)
        .lean();
      const departmentIds = [...new Set(profiles.map((profile) => String(profile.department)))];
      const departments = await DepartmentModel.find({ _id: { $in: departmentIds } })
        .select("code shortName")
        .lean();
      const codeByDepartment = new Map(
        departments.map((department) => [
          String(department._id),
          department.shortName || department.code || "",
        ]),
      );
      profiles.forEach((profile) => {
        const branchShort = codeByDepartment.get(String(profile.department));
        const semTag = profile.currentSemester ? `Sem ${profile.currentSemester}` : "";
        const progTag = formatStudentTag(profile.program);
        const tagParts = [branchShort, semTag, progTag].filter(Boolean);
        tagMap.set(String(profile.userId), tagParts.join(" · "));
      });
      pushSection("Students", await fetchUsersByIds(profiles.map((profile) => profile.userId)));
      return { sections };
    }

    if (roles.includes(SystemRole.STUDENT)) {
      const profile = await StudentProfileModel.findOne({ userId: currentUser._id })
        .select("mentor department currentYear section program batch")
        .lean();

      if (profile?.mentor) {
        tagMap.set(String(profile.mentor), "Mentor");
        const mentor = await fetchUsersByIds([profile.mentor]);
        pushSection("My Mentor", mentor);
      }

      const deptId = profile?.department;
      if (deptId) {
        const dept = await DepartmentModel.findById(deptId).select("code hodId").lean();
        const deptCode = dept?.code ?? "";

        if (dept?.hodId) {
          tagMap.set(String(dept.hodId), deptCode ? `HOD - ${deptCode}` : "HOD");
          const hod = await fetchUsersByIds([dept.hodId]);
          pushSection("My HOD", hod);
        }

        const facultyProfiles = await FacultyProfileModel.find({ department: deptId })
          .select("userId")
          .limit(100)
          .lean();
        facultyProfiles.forEach((p) => {
          if (!tagMap.has(String(p.userId))) {
            tagMap.set(String(p.userId), deptCode ? `${deptCode} Faculty` : "Faculty");
          }
        });
        const facultyUsers = await fetchUsersByIds(facultyProfiles.map((p) => p.userId));
        pushSection("Department Faculty", facultyUsers);
      }

      pushSection("Dean", await fetchUsersByRole(SystemRole.DEAN_ACADEMIC, 10));
      pushSection("Principal", await fetchUsersByRole(SystemRole.PRINCIPAL, 5));
    } else if (roles.includes(SystemRole.FACULTY) || roles.includes(SystemRole.HOD)) {
      const facultyProfile = await FacultyProfileModel.findOne({ userId: currentUser._id })
        .select("department")
        .lean();
      const deptId = facultyProfile?.department;

      if (deptId) {
        const dept = await DepartmentModel.findById(deptId).select("code hodId").lean();
        const deptCode = dept?.code ?? "";

        if (dept?.hodId && String(dept.hodId) !== selfId) {
          tagMap.set(String(dept.hodId), deptCode ? `HOD - ${deptCode}` : "HOD");
          const hod = await fetchUsersByIds([dept.hodId]);
          pushSection("My HOD", hod);
        }

        const peerProfiles = await FacultyProfileModel.find({
          department: deptId,
          userId: { $ne: currentUser._id },
        })
          .select("userId")
          .limit(100)
          .lean();
        peerProfiles.forEach((p) => {
          if (!tagMap.has(String(p.userId))) {
            tagMap.set(String(p.userId), deptCode ? `${deptCode} Faculty` : "Faculty");
          }
        });
        const peers = await fetchUsersByIds(peerProfiles.map((p) => p.userId));
        pushSection("Faculty Peers", peers);

        const mentorships = await StudentProfileModel.find({ mentor: currentUser._id })
          .select("userId program batch currentSemester")
          .limit(100)
          .lean();
        mentorships.forEach((m) => {
          const semTag = m.currentSemester ? `Sem ${m.currentSemester}` : "";
          const progTag = formatStudentTag(m.program);
          tagMap.set(String(m.userId), [deptCode, semTag, progTag].filter(Boolean).join(" · "));
        });
        const mentees = await fetchUsersByIds(mentorships.map((m) => m.userId));
        pushSection("My Mentees", mentees);

        if (roles.includes(SystemRole.HOD)) {
          const branchProfiles = await StudentProfileModel.find({ department: deptId })
            .select("userId program batch currentSemester")
            .limit(300)
            .lean();
          branchProfiles.forEach((p) => {
            if (!tagMap.has(String(p.userId))) {
              const semTag = p.currentSemester ? `Sem ${p.currentSemester}` : "";
              const progTag = formatStudentTag(p.program);
              tagMap.set(String(p.userId), [deptCode, semTag, progTag].filter(Boolean).join(" · "));
            }
          });
          const branchStudents = await fetchUsersByIds(branchProfiles.map((p) => p.userId));
          pushSection("Department Students", branchStudents);
          pushSection("Other HODs", await fetchUsersByRole(SystemRole.HOD, 50));
        }
      }

      pushSection("Dean", await fetchUsersByRole(SystemRole.DEAN_ACADEMIC, 10));
      pushSection("Principal", await fetchUsersByRole(SystemRole.PRINCIPAL, 5));
    } else if (
      roles.some((role) =>
        [...INSTITUTION_WIDE_CHAT_ROLES, ...ACADEMIC_LEADERSHIP_CHAT_ROLES].includes(role),
      )
    ) {
      if (role && INSTITUTION_WIDE_CHAT_ROLES.has(role)) {
        pushSection("Super Administrators", await fetchUsersByRole(SystemRole.SUPER_ADMIN, 20));
        pushSection("Administration", await fetchUsersByRole(SystemRole.ADMIN, 20));
      }
      pushSection("Principal", await fetchUsersByRole(SystemRole.PRINCIPAL, 5));
      pushSection("Dean", await fetchUsersByRole(SystemRole.DEAN_ACADEMIC, 10));
      pushSection("Academic Office", await fetchUsersByRole(SystemRole.ADMINISTRATION_OFFICE, 50));
      pushSection(
        "Assistant Academic Officers",
        await fetchUsersByRole(SystemRole.ASSISTANT_ADMINISTRATION_OFFICER, 50),
      );
      pushSection("HODs", await fetchUsersByRole(SystemRole.HOD, 50));
      pushSection("Faculty", await fetchFacultyWithDepartmentTags());
    } else {
      pushSection("Principal", await fetchUsersByRole(SystemRole.PRINCIPAL, 5));
      pushSection("Dean", await fetchUsersByRole(SystemRole.DEAN_ACADEMIC, 10));
      pushSection("HODs", await fetchUsersByRole(SystemRole.HOD, 50));
    }

    // ── Club & Committee Members (Cross-Branch / Cross-Department) ───────────
    const userClubs = await ClubModel.find({
      isActive: true,
      $or: [
        { "members.userId": currentUser._id },
        { studentHead: currentUser._id },
        { facultyAdvisor: currentUser._id },
      ],
    })
      .select("name members facultyAdvisor studentHead")
      .lean();

    if (userClubs.length > 0) {
      const clubUserIds: (Types.ObjectId | string)[] = [];
      userClubs.forEach((c) => {
        if (c.studentHead && String(c.studentHead) !== selfId) {
          tagMap.set(String(c.studentHead), `${c.name} Head`);
          clubUserIds.push(c.studentHead);
        }
        if (c.facultyAdvisor && String(c.facultyAdvisor) !== selfId) {
          tagMap.set(String(c.facultyAdvisor), `${c.name} Advisor`);
          clubUserIds.push(c.facultyAdvisor);
        }
        c.members?.forEach((m) => {
          const mId = String(m.userId);
          if (mId !== selfId && !tagMap.has(mId)) {
            tagMap.set(mId, `${c.name} Member`);
            clubUserIds.push(m.userId);
          }
        });
      });
      if (clubUserIds.length > 0) {
        const clubPeers = await fetchUsersByIds(clubUserIds);
        pushSection("My Clubs & Committees", clubPeers);
      }
    }

    return { sections };
  },

  /**
   * Free-text search across active users by name or email, scoped by role-based hierarchy.
   */
  searchUsers: async (
    query: string,
    currentUser: IChatActor,
    limit = 20,
    activeRole?: SystemRole,
  ) => {
    const q = query.trim();
    if (!q) return { users: [] as IContactUser[] };
    const selfId = String(currentUser._id);
    const role = activeRole ?? currentUser.roles?.[0];
    const isLeadership = Boolean(
      role && (INSTITUTION_WIDE_CHAT_ROLES.has(role) || ACADEMIC_LEADERSHIP_CHAT_ROLES.has(role)),
    );

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const queryFilter: Record<string, unknown> = {
      _id: { $ne: selfId },
      status: "active",
      $or: [{ name: regex }, { email: regex }],
    };

    if (role && ACADEMIC_LEADERSHIP_CHAT_ROLES.has(role)) {
      queryFilter.roles = {
        $in: [
          SystemRole.PRINCIPAL,
          SystemRole.DEAN_ACADEMIC,
          SystemRole.ADMINISTRATION_OFFICE,
          SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
          SystemRole.HOD,
          SystemRole.FACULTY,
          SystemRole.STUDENT,
        ],
      };
    }

    // For non-leadership roles (Student, Faculty, HOD, Parent), limit search to allowed hierarchical contacts
    if (!isLeadership) {
      const contactsRes = await chatService.getContacts(currentUser, activeRole);
      const allowedUserIds = new Set<string>();
      contactsRes.sections.forEach((sec) =>
        sec.users.forEach((u) => allowedUserIds.add(String(u._id))),
      );
      queryFilter._id = { $in: Array.from(allowedUserIds), $ne: selfId };
    }

    const users = await UserModel.find(queryFilter)
      .select(USER_PROJECTION)
      .limit(Math.min(Math.max(limit, 1), 50))
      .lean();

    const formatRoleTag = (r: SystemRole[] = []): string => {
      const primary = r[0];
      if (!primary) return "";
      const map: Record<string, string> = {
        [SystemRole.PRINCIPAL]: "Principal",
        [SystemRole.DEAN_ACADEMIC]: "Dean",
        [SystemRole.HOD]: "HOD",
        [SystemRole.FACULTY]: "Faculty",
        [SystemRole.STUDENT]: "Student",
        [SystemRole.SUPER_ADMIN]: "Super Admin",
        [SystemRole.PARENT]: "Parent",
      };
      return (
        map[primary] ??
        String(primary)
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      );
    };

    const tagged = users.map((u) => ({
      ...u,
      tag: formatRoleTag((u as { roles?: SystemRole[] }).roles ?? []),
    }));
    return { users: tagged as unknown as IContactUser[] };
  },

  // ── Mute / Unmute ──────────────────────────────────────────────────────────

  /** Toggle mute on a conversation for the current user. Returns new mute state. */
  toggleMute: async (userId: string, conversationId: string): Promise<{ muted: boolean }> => {
    await assertConversationParticipant(conversationId, userId);
    const user = await UserModel.findById(userId).select("mutedConversations").lean();
    const muted = (user?.mutedConversations ?? []).map(String);
    if (muted.includes(conversationId)) {
      await UserModel.updateOne({ _id: userId }, { $pull: { mutedConversations: conversationId } });
      return { muted: false };
    }
    await UserModel.updateOne(
      { _id: userId },
      { $addToSet: { mutedConversations: conversationId } },
    );
    return { muted: true };
  },

  getMutedConversations: async (userId: string): Promise<string[]> => {
    const user = await UserModel.findById(userId).select("mutedConversations").lean();
    return (user?.mutedConversations ?? []).map(String);
  },

  togglePin: async (userId: string, conversationId: string): Promise<{ pinned: boolean }> => {
    await assertConversationParticipant(conversationId, userId);
    const user = await UserModel.findById(userId).select("pinnedConversations").lean();
    const pinned = (user?.pinnedConversations ?? []).map(String);
    if (pinned.includes(conversationId)) {
      await UserModel.updateOne(
        { _id: userId },
        { $pull: { pinnedConversations: conversationId } },
      );
      return { pinned: false };
    }
    await UserModel.updateOne(
      { _id: userId },
      { $addToSet: { pinnedConversations: conversationId } },
    );
    return { pinned: true };
  },

  getPinnedConversations: async (userId: string): Promise<string[]> => {
    const user = await UserModel.findById(userId).select("pinnedConversations").lean();
    return (user?.pinnedConversations ?? []).map(String);
  },

  clearChatHistory: async (userId: string, conversationId: string) => {
    await assertConversationParticipant(conversationId, userId);
    return chatRepository.clearChatHistory(conversationId, userId);
  },

  deleteConversation: async (userId: string, conversationId: string) => {
    await assertConversationParticipant(conversationId, userId);
    return chatRepository.deleteConversation(conversationId, userId);
  },
};
