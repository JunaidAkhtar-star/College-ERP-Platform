/**
 * Socket.IO Gateway
 * - JWT auth handshake (token in handshake.auth.token)
 * - Per-user room  : user:<userId>
 * - Per-conversation room : conv:<conversationId>
 *
 * Events (client → server):
 *   join_conversation   { conversationId }
 *   leave_conversation  { conversationId }
 *   send_message        { conversationId, content, messageType?, fileUrl?, fileName? }
 *   typing_start        { conversationId }
 *   typing_stop         { conversationId }
 *   mark_read           { conversationId }
 *
 * Events (server → client):
 *   new_message         { conversationId, message }
 *   message_read        { conversationId, userId, readAt }
 *   typing              { conversationId, userId, isTyping }
 *   notification_push   { notification }
 *   pending_notifications { notifications: INotification[] }  // emitted once on connect
 *   user_online         { userId }
 *   user_offline        { userId }
 *   error               { message }
 */

import type { Server as HttpServer } from "http";
import type { Connection } from "mongoose";
import { Server as SocketServer, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { tokenUtil } from "../utils/token.util";
import { userRepository } from "../repositories/user.repository";
import { roleRepository } from "../repositories/role.repository";
import { assertConversationParticipant, chatService } from "../services/chat.service";
import { chatRepository } from "../repositories/chat.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { sendFcmToUser } from "../utils/fcm.util";
import { configs } from "../configs";
import type { IUser } from "../models/user.model";
import { logger } from "../utils/logger.util";
import { isAllowedCorsOrigin } from "../utils/cors.util";
import { MeetingModel } from "../models/meeting.model";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { meetingEntitlementService } from "../services/meeting-entitlement.service";
import { meetingAccessService } from "../services/meeting-access.service";
import {
  getTenantConnection,
  normalizeTenantId,
  tenantLocalStorage,
} from "../configs/connectionManager";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { redisUtil } from "../utils/redis.util";
import { SystemRole } from "../constants/roles";
import { transportRepository } from "../repositories/transport.repository";
import { Module, PermissionAction } from "../constants/permissions";

// Singleton Socket.IO server instance — importable by services for push
let _io: SocketServer | null = null;

export function getIO(): SocketServer {
  if (!_io) throw new Error("Socket.IO not initialised");
  return _io;
}

// Track online users: userId → Set<socketId>
const onlineUsers = new Map<string, Set<string>>();
const localMeetingAdmissions = new Set<string>();

function addOnline(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)?.add(socketId);
}

function removeOnline(userId: string, socketId: string) {
  onlineUsers.get(userId)?.delete(socketId);
  if (onlineUsers.get(userId)?.size === 0) onlineUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return (onlineUsers.get(userId)?.size ?? 0) > 0;
}

export async function getOnlineUserIds(): Promise<string[]> {
  if (!_io) return [];
  const sockets = await _io.fetchSockets();
  return Array.from(
    new Set(
      sockets
        .map((socket) => String(socket.data.userId ?? ""))
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
}

// ── Per-user send_message throttle ──────────────────────────────────────────
// Sliding-window rate limit keyed by userId. Prevents a runaway client from
// flooding the server (and every other participant) with messages. Limits are
// well above any human typing pace so legitimate use is never blocked.
const SEND_WINDOW_MS = 10_000;
const SEND_MAX_PER_WINDOW = 30;
const sendTimestamps = new Map<string, number[]>();
function isSendAllowed(userId: string): boolean {
  const now = Date.now();
  const arr = sendTimestamps.get(userId) ?? [];
  const recent = arr.filter((t) => now - t < SEND_WINDOW_MS);
  if (recent.length >= SEND_MAX_PER_WINDOW) {
    sendTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  sendTimestamps.set(userId, recent);
  return true;
}
// Periodically prune stale entries so the map can't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - SEND_WINDOW_MS;
  for (const [uid, arr] of sendTimestamps) {
    const fresh = arr.filter((t) => t > cutoff);
    if (fresh.length === 0) sendTimestamps.delete(uid);
    else sendTimestamps.set(uid, fresh);
  }
}, 60_000).unref();

/** Emit to every socket for a given userId in the correct tenant context */
export function emitToUser(userId: string, event: string, payload: unknown) {
  const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
  _io?.to(`user:${tenantId}:${userId}`).emit(event, payload);
}

/** Emit a validated position only to authorized transport subscribers. */
export function emitTransportPosition(routeId: string, payload: unknown) {
  const tenantId = tenantLocalStorage.getStore()?.tenantId;
  if (!tenantId) return;
  _io?.to(`transport:fleet:${tenantId}`).emit("transport_position", payload);
  _io?.to(`transport:route:${tenantId}:${routeId}`).emit("transport_position", payload);
}

/** Push a notification to a user in real-time (Socket.IO + FCM) */
export function pushNotification(
  userId: string,
  notification: unknown,
  channels: { inApp?: boolean; push?: boolean } = { inApp: true, push: true },
) {
  // We need the user's preferences before emitting so each channel
  // (real-time in-app popup / FCM push) can be skipped individually when
  // the user has opted out. The in-app DB row is written upstream by
  // notificationRepository.create — it is intentionally NOT gated by
  // preferences so the bell-dropdown history stays complete.
  userRepository
    .findById(userId)
    .then((user) => {
      if (!user) return;
      const typedUser = user as unknown as IUser;
      const prefs = typedUser.notificationPreferences;
      const inAppEnabled = prefs?.inApp !== false; // default ON
      const pushEnabled = prefs?.push === true; // explicit opt-in only

      // Real-time right-side slide-in toast.
      if (channels.inApp !== false && inAppEnabled) {
        emitToUser(userId, "notification_push", { notification });
      }

      // OS-level / browser FCM push.
      if (channels.push !== false && pushEnabled) {
        const n = notification as {
          _id?: unknown;
          title?: string;
          body?: string;
          message?: string;
          actionUrl?: string;
        };
        sendFcmToUser(
          typedUser.fcmToken,
          {
            title: n?.title ?? "New notification",
            body: n?.body ?? n?.message ?? "",
            data: {
              ...(n?._id ? { notificationId: String(n._id) } : {}),
              ...(n?.actionUrl ? { actionUrl: n.actionUrl, url: n.actionUrl } : {}),
            },
          },
          typedUser.fcmTokens,
        )
          .then(async ({ invalidTokens }) => {
            if (!invalidTokens.length) return;
            const unset = Object.fromEntries(
              (["web", "ios", "android"] as const)
                .filter((platform) => invalidTokens.includes(typedUser.fcmToken?.[platform] ?? ""))
                .map((platform) => [`fcmToken.${platform}`, ""]),
            );
            await userRepository.updateById(userId, {
              ...(Object.keys(unset).length ? { $unset: unset } : {}),
              $pull: { fcmTokens: { token: { $in: invalidTokens } } },
            });
          })
          .catch((error: unknown) =>
            logger.warn("[NotificationPush] FCM delivery failed", {
              userId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
      }
    })
    .catch((error: unknown) =>
      logger.warn("[NotificationPush] Recipient lookup failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
}

// ───────────────────────────────────────────────────────────────────────────
export function initSocketGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: configs.ALLOWED_ORIGINS
        ? (origin, callback) =>
            callback(null, !origin || isAllowedCorsOrigin(origin, configs.ALLOWED_ORIGINS))
        : "*",
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  _io = io;
  if (configs.REDIS_URL) {
    const pubClient = new Redis(configs.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    const subClient = pubClient.duplicate();
    void Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.socket("Socket.IO Redis adapter connected");
      })
      .catch((error: unknown) => {
        logger.error("Socket.IO Redis adapter failed", error);
        pubClient.disconnect();
        subClient.disconnect();
      });
  }

  // ── Authentication middleware ──────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth as Record<string, string>).token ||
        (socket.handshake.headers["authorization"] as string)?.split(" ")[1];

      if (!token) return next(new Error("Authentication token missing"));

      const payload = tokenUtil.verifyAccessToken(token);
      if (!payload.tenantId) return next(new Error("Tenant-bound token required"));
      const tenantId = normalizeTenantId(payload.tenantId);
      const tenant = await TenantModel.findOne({ tenantId }).lean().exec();
      const now = Date.now();
      const billingStatus = tenant?.billingStatus ?? "active";
      const billingAllowed =
        ["active", "free"].includes(billingStatus) ||
        (billingStatus === "trialing" &&
          Boolean(tenant?.trialEndsAt && tenant.trialEndsAt.getTime() >= now)) ||
        (billingStatus === "past_due" &&
          Boolean(tenant?.graceEndsAt && tenant.graceEndsAt.getTime() >= now));
      if (!tenant || tenant.status !== TenantStatus.ACTIVE || !billingAllowed) {
        return next(new Error("Tenant is unavailable"));
      }
      const tenantDb = getTenantConnection(tenantId, tenant.databaseName);
      const user = await tenantLocalStorage.run({ tenantId, tenantDb }, () =>
        userRepository.findById(payload.userId),
      );

      if (!user) return next(new Error("User not found"));
      if (user.status !== "active") return next(new Error("Account not active"));

      // Attach to socket data for later use
      (socket.data as Record<string, unknown>).userId = String(user._id);
      (socket.data as Record<string, unknown>).role = payload.role;
      (socket.data as Record<string, unknown>).userName = user.name;
      (socket.data as Record<string, unknown>).avatar = user.avatar;
      (socket.data as Record<string, unknown>).tenantId = tenantId;
      (socket.data as Record<string, unknown>).tenantDb = tenantDb;

      const baseRoleDoc = await tenantLocalStorage.run({ tenantId, tenantDb }, () =>
        roleRepository.findByName(payload.role),
      );
      const activeRoleDoc = payload.roleId
        ? String(baseRoleDoc?._id) === payload.roleId
          ? baseRoleDoc
          : await tenantLocalStorage.run({ tenantId, tenantDb }, () =>
              roleRepository.findAssignedById(payload.roleId!, user.customRoleIds ?? []),
            )
        : baseRoleDoc;
      const chatActions =
        activeRoleDoc?.permissions
          ?.find((permission) => permission.module === Module.CHAT)
          ?.actions.map(String) ?? [];
      (socket.data as Record<string, unknown>).chatActions = chatActions;

      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as Record<string, string>).userId;
    const tenantId = (socket.data as Record<string, string>).tenantId || "global";
    const tenantDb = (socket.data as Record<string, unknown>).tenantDb as Connection | undefined;
    if (!tenantDb) {
      socket.disconnect(true);
      return;
    }

    // Run every socket packet handler in the authenticated JWT tenant context.
    socket.use((_packet, next) => tenantLocalStorage.run({ tenantId, tenantDb }, next));
    tenantLocalStorage.run({ tenantId, tenantDb }, () => {
      // Join tenant-specific room to receive college wide updates
      void socket.join(`tenant:${tenantId}`);

      // Join personal room for directed pushes
      void socket.join(`user:${tenantId}:${userId}`);
      addOnline(userId, socket.id);

      // Broadcast online status to all connected clients in the same tenant
      io.to(`tenant:${tenantId}`).emit("user_online", { userId });

      logger.socket(`connected  userId=${userId} socketId=${socket.id} tenantId=${tenantId}`);

      socket.on("subscribe_transport", async () => {
        try {
          const role = String((socket.data as Record<string, unknown>).role ?? "");
          const managementRoles = new Set<string>([
            SystemRole.SUPER_ADMIN,
            SystemRole.ADMIN,
            SystemRole.PRINCIPAL,
            SystemRole.TRANSPORTATION,
          ]);
          if (managementRoles.has(role)) {
            await socket.join(`transport:fleet:${tenantId}`);
            socket.emit("transport_subscribed", { scope: "fleet" });
            return;
          }
          if (role === SystemRole.STUDENT) {
            const allocation = await transportRepository.findActiveAllocationRouteId(userId);
            if (allocation) {
              const routeId = allocation.routeId.toString();
              await socket.join(`transport:route:${tenantId}:${routeId}`);
              socket.emit("transport_subscribed", { scope: "route", routeId });
            } else {
              socket.emit("transport_subscribed", { scope: "none" });
            }
            return;
          }
          socket.emit("transport_error", { message: "Transport tracking access denied" });
        } catch {
          socket.emit("transport_error", { message: "Unable to subscribe to live transport" });
        }
      });

      // ── Flush offline notification queue ──────────────────────────────
      // Anything that piled up while the user was offline (chat messages,
      // pushes, etc.) is persisted as Notification rows. On reconnect we
      // ship the unread ones down in one shot so the client can surface
      // them as toasts / badges without waiting for the next live event.
      notificationRepository
        .getUnreadForUser(userId, 20)
        .then((items) => {
          if (!items?.length) return;
          socket.emit("pending_notifications", { notifications: items });
        })
        .catch(() => undefined);

      // ── join_conversation ──────────────────────────────────────────────
      socket.on("join_conversation", async ({ conversationId }: { conversationId: string }) => {
        try {
          if (!conversationId) return;
          await assertConversationParticipant(conversationId, userId);
          await socket.join(`conv:${tenantId}:${conversationId}`);
        } catch {
          socket.emit("error", { message: "Conversation not found or access denied" });
        }
      });

      // ── leave_conversation ─────────────────────────────────────────────
      socket.on("leave_conversation", ({ conversationId }: { conversationId: string }) => {
        if (!conversationId) return;
        void socket.leave(`conv:${tenantId}:${conversationId}`);
      });

      // ── send_message ───────────────────────────────────────────────────
      socket.on(
        "send_message",
        async ({
          conversationId,
          content,
          messageType = "text",
          fileUrl,
          fileName,
          replyTo,
        }: {
          conversationId: string;
          content: string;
          messageType?: "text" | "file" | "image" | "audio" | "video";
          fileUrl?: string;
          fileName?: string;
          replyTo?: string;
        }) => {
          try {
            const chatActions = ((socket.data as Record<string, unknown>).chatActions ??
              []) as string[];
            if (!chatActions.includes(PermissionAction.VIEW)) {
              socket.emit("error", { message: "Your role cannot access chat" });
              return;
            }
            if (!conversationId || !content?.trim()) {
              socket.emit("error", { message: "conversationId and content are required" });
              return;
            }
            if (content.length > 4000) {
              socket.emit("error", { message: "Message exceeds 4000 char limit" });
              return;
            }
            if (!isSendAllowed(userId)) {
              socket.emit("error", { message: "Too many messages — slow down a moment" });
              return;
            }

            // Delegate to chatService so notifications get persisted and every
            // participant (including sender) receives a per-user `new_message`
            // push. Service handles emit + Notification creation.
            await chatService.sendMessage(
              conversationId,
              userId,
              content.trim(),
              messageType,
              fileUrl,
              fileName,
              replyTo,
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to send message";
            socket.emit("error", { message: msg });
          }
        },
      );

      // ── react_message ──────────────────────────────────────────────────
      socket.on(
        "react_message",
        async ({
          conversationId,
          messageId,
          emoji,
        }: {
          conversationId: string;
          messageId: string;
          emoji: string;
        }) => {
          try {
            const chatActions = ((socket.data as Record<string, unknown>).chatActions ??
              []) as string[];
            if (!chatActions.includes(PermissionAction.VIEW)) return;
            if (!conversationId || !messageId || !emoji) return;
            await chatService.addReaction(conversationId, messageId, userId, emoji);
            io.to(`conv:${tenantId}:${conversationId}`).emit("message_reaction", {
              conversationId,
              messageId,
              userId,
              emoji,
            });
          } catch {
            /* ignore */
          }
        },
      );

      // ── typing_start / typing_stop ─────────────────────────────────────
      socket.on("typing_start", async ({ conversationId }: { conversationId: string }) => {
        try {
          if (!conversationId) return;
          await assertConversationParticipant(conversationId, userId);
          socket.to(`conv:${tenantId}:${conversationId}`).emit("typing", {
            conversationId,
            userId,
            userName: (socket.data as Record<string, string>).userName,
            isTyping: true,
          });
        } catch {
          // Do not reveal conversation membership.
        }
      });

      socket.on("typing_stop", async ({ conversationId }: { conversationId: string }) => {
        try {
          if (!conversationId) return;
          await assertConversationParticipant(conversationId, userId);
          socket.to(`conv:${tenantId}:${conversationId}`).emit("typing", {
            conversationId,
            userId,
            userName: (socket.data as Record<string, string>).userName,
            isTyping: false,
          });
        } catch {
          // Do not reveal conversation membership.
        }
      });

      // ── mark_read ──────────────────────────────────────────────────────
      socket.on("mark_read", async ({ conversationId }: { conversationId: string }) => {
        try {
          if (!conversationId) return;
          await chatService.markRead(conversationId, userId);
          io.to(`conv:${tenantId}:${conversationId}`).emit("message_read", {
            conversationId,
            userId,
            readAt: new Date().toISOString(),
          });
        } catch {
          // silently ignore
        }
      });

      // ── Virtual Meeting Room Events ────────────────────────────────────
      // ── Virtual Meeting Room Events ────────────────────────────────────
      const transferMeetingHost = async (meetingId: string) => {
        // Give the current host time to recover from a brief network interruption.
        setTimeout(async () => {
          try {
            const connectedHosts = await io.in(`meet_host:${tenantId}:${meetingId}`).fetchSockets();
            if (connectedHosts.length > 0) return;

            const members = await io.in(`meet:${tenantId}:${meetingId}`).fetchSockets();
            if (members.length === 0) return;

            const meeting = await MeetingModel.findById(meetingId)
              .select("coHostIds status")
              .lean();
            if (!meeting || meeting.status === "completed" || meeting.status === "cancelled")
              return;

            const coHosts = new Set((meeting.coHostIds || []).map(String));
            const successor =
              members.find((member) =>
                coHosts.has(String((member.data as { userId?: string }).userId ?? "")),
              ) ?? members[0];
            const successorId = String((successor.data as { userId?: string }).userId ?? "");
            if (!successorId) return;

            await MeetingModel.updateOne(
              { _id: meetingId },
              { $addToSet: { coHostIds: successorId } },
            );
            successor.join(`meet_host:${tenantId}:${meetingId}`);
            (successor.data as Record<string, unknown>).isMeetingHost = true;
            successor.emit("meet_host_transferred", {
              meetingId,
              userId: successorId,
              message: "You are now the meeting host",
            });
            io.to(`meet:${tenantId}:${meetingId}`).emit("meet_host_changed", {
              meetingId,
              userId: successorId,
              userName: String((successor.data as { userName?: string }).userName ?? "Participant"),
            });
          } catch (error) {
            logger.error(`Failed to transfer host for meeting ${meetingId}:`, error);
          }
        }, 10_000);
      };

      socket.on(
        "meet_join_lobby",
        async ({ meetingId, userName }: { meetingId: string; userName: string }) => {
          if (!meetingId) return;
          try {
            await meetingAccessService.assertJoinWindow(meetingId);
            const meeting = await meetingAccessService.assertParticipant(meetingId, userId);
            const isHost = await meetingAccessService.isHost(meetingId, userId);
            if (isHost) {
              socket.emit("meet_join_accepted", { meetingId });
              return;
            }
            if (meeting.blockedUserIds.map(String).includes(userId))
              return socket.emit("meet_join_rejected", {
                meetingId,
                message: "You were removed from this meeting",
              });
            if (meeting.isLocked && !(await meetingAccessService.isHost(meetingId, userId)))
              return socket.emit("meet_join_rejected", {
                meetingId,
                message: "This meeting is locked",
              });
          } catch (error) {
            return socket.emit("meet_join_rejected", {
              meetingId,
              message: error instanceof Error ? error.message : "Meeting access denied",
            });
          }
          void socket.join(`meet_lobby:${tenantId}:${meetingId}`);

          (socket.data as Record<string, unknown>).lobbyMeetingId = meetingId;
          (socket.data as Record<string, unknown>).lobbyUserName = userName;

          // Notify the host (if connected)
          io.to(`meet_host:${tenantId}:${meetingId}`).emit("meet_join_request", {
            socketId: socket.id,
            userId,
            userName,
          });
        },
      );

      socket.on("meet_register_host", async ({ meetingId }: { meetingId: string }) => {
        if (!meetingId) return;
        try {
          await meetingAccessService.assertJoinWindow(meetingId);
          await meetingAccessService.assertHost(meetingId, userId);
          await meetingEntitlementService.start(meetingId, userId);
          await MeetingModel.updateOne(
            { _id: meetingId, status: "scheduled" },
            { $set: { status: "ongoing" } },
          );
        } catch (error) {
          return socket.emit("meet_error", {
            code: "MEETING_START_FAILED",
            message: error instanceof Error ? error.message : "Meeting could not start",
          });
        }
        void socket.join(`meet_host:${tenantId}:${meetingId}`);
        void socket.join(`meet:${tenantId}:${meetingId}`);
        (socket.data as Record<string, unknown>).activeMeetingId = meetingId;
        (socket.data as Record<string, unknown>).isMeetingHost = true;
        socket.emit("meet_host_ready", { meetingId });

        // Send the current waiting queue in the lobby
        const waiting = await io.in(`meet_lobby:${tenantId}:${meetingId}`).fetchSockets();
        const queue = waiting.map((guest) => ({
          socketId: guest.id,
          userId: String(guest.data.userId ?? ""),
          userName: String(guest.data.lobbyUserName ?? guest.data.userName ?? ""),
        }));
        socket.emit("meet_lobby_list", { queue });
      });

      socket.on(
        "meet_accept_user",
        async ({ meetingId, socketId }: { meetingId: string; socketId: string }) => {
          if (!meetingId || !socketId) return;
          try {
            await meetingAccessService.assertHost(meetingId, userId);
          } catch {
            return socket.emit("meet_error", {
              code: "FORBIDDEN",
              message: "Host permission required",
            });
          }
          const waiting = await io.in(`meet_lobby:${tenantId}:${meetingId}`).fetchSockets();
          if (!waiting.some((guest) => guest.id === socketId)) return;
          await redisUtil.set(`meeting-admission:${meetingId}:${socketId}`, true, 600);
          localMeetingAdmissions.add(`${meetingId}:${socketId}`);
          io.in(socketId).socketsLeave(`meet_lobby:${tenantId}:${meetingId}`);
          io.to(socketId).emit("meet_join_accepted", { meetingId });
        },
      );

      socket.on(
        "meet_reject_user",
        async ({ meetingId, socketId }: { meetingId: string; socketId: string }) => {
          if (!meetingId || !socketId) return;
          try {
            await meetingAccessService.assertHost(meetingId, userId);
          } catch {
            return socket.emit("meet_error", {
              code: "FORBIDDEN",
              message: "Host permission required",
            });
          }
          io.in(socketId).socketsLeave(`meet_lobby:${tenantId}:${meetingId}`);
          io.to(socketId).emit("meet_join_rejected", { meetingId });
        },
      );

      socket.on("meet_join_active", async ({ meetingId }: { meetingId: string }) => {
        if (!meetingId) return;
        try {
          await meetingAccessService.assertJoinWindow(meetingId);
          const meeting = await meetingAccessService.assertParticipant(meetingId, userId);
          const host = await meetingAccessService.isHost(meetingId, userId);
          const admitted =
            Boolean(await redisUtil.get<boolean>(`meeting-admission:${meetingId}:${socket.id}`)) ||
            localMeetingAdmissions.has(`${meetingId}:${socket.id}`);
          if (!host && !admitted) throw new Error("Waiting-room admission is required");
          if (meeting.blockedUserIds.map(String).includes(userId))
            throw new Error("You were removed from this meeting");
          await meetingEntitlementService.join(meetingId, userId);
        } catch (error) {
          return socket.emit("meet_join_rejected", {
            meetingId,
            code: "MEETING_PLAN_LIMIT_REACHED",
            message: error instanceof Error ? error.message : "Meeting capacity reached",
          });
        }
        void socket.join(`meet:${tenantId}:${meetingId}`);
        (socket.data as Record<string, unknown>).activeMeetingId = meetingId;
        socket.emit("meet_join_ready", { meetingId });

        const sockets = await io.in(`meet:${tenantId}:${meetingId}`).fetchSockets();
        const participants = sockets.map((s) => ({
          userId: (s.data as { userId: string }).userId,
          userName: (s.data as { userName: string }).userName,
          avatar: (s.data as { avatar?: string }).avatar,
        }));
        socket.emit("meet_participants_list", { participants });

        // Notify other participants in the main meeting room
        socket.to(`meet:${tenantId}:${meetingId}`).emit("meet_user_joined", {
          userId,
          userName: (socket.data as { userName: string }).userName,
          avatar: (socket.data as { avatar?: string }).avatar,
        });
      });

      socket.on("meet_end_meeting", async ({ meetingId }: { meetingId: string }) => {
        if (!meetingId) return;
        try {
          await meetingAccessService.assertHost(meetingId, userId);
          await MeetingModel.findByIdAndUpdate(meetingId, {
            status: "completed",
            endedAt: new Date(),
          });
          await meetingEntitlementService.end(meetingId);
          io.to(`meet:${tenantId}:${meetingId}`).emit("meet_ended", { meetingId });
          io.to(`tenant:${tenantId}`).emit("meeting_status_changed", {
            meetingId,
            status: "completed",
          });
          logger.socket(`Meeting ${meetingId} ended by host.`);
        } catch (err) {
          logger.error(`Failed to explicitly end meeting ${meetingId}:`, err);
        }
      });

      socket.on("meet_leave", async ({ meetingId }: { meetingId: string }) => {
        if (!meetingId) return;
        const wasHost = Boolean((socket.data as { isMeetingHost?: boolean }).isMeetingHost);
        await socket.leave(`meet:${tenantId}:${meetingId}`);
        await socket.leave(`meet_host:${tenantId}:${meetingId}`);
        delete (socket.data as { activeMeetingId?: string }).activeMeetingId;
        delete (socket.data as { isMeetingHost?: boolean }).isMeetingHost;
        await meetingEntitlementService.leave(meetingId, userId).catch(() => undefined);
        socket.to(`meet:${tenantId}:${meetingId}`).emit("meet_user_left", { userId });
        if (wasHost) await transferMeetingHost(meetingId);
      });

      socket.on(
        "meet_send_chat",
        async ({ meetingId, content }: { meetingId: string; content: string }) => {
          if (!meetingId || !content?.trim()) return;
          if (
            !(socket.data as { activeMeetingId?: string }).activeMeetingId ||
            (socket.data as { activeMeetingId?: string }).activeMeetingId !== meetingId
          )
            return;
          const message = await MeetingMessageModel.create({
            meetingId,
            userId,
            userName: (socket.data as { userName: string }).userName,
            content: content.trim(),
          });
          io.to(`meet:${tenantId}:${meetingId}`).emit("meet_new_chat", {
            _id: message._id,
            userId,
            userName: (socket.data as { userName: string }).userName,
            content: content.trim(),
            timestamp: message.createdAt.getTime(),
          });
        },
      );

      socket.on(
        "meet_raise_hand",
        async ({ meetingId, raised }: { meetingId: string; raised: boolean }) => {
          if ((socket.data as { activeMeetingId?: string }).activeMeetingId !== meetingId) return;
          io.to(`meet:${tenantId}:${meetingId}`).emit("meet_hand_changed", {
            userId,
            userName: (socket.data as { userName: string }).userName,
            raised: Boolean(raised),
          });
        },
      );

      socket.on("meet_reaction", ({ meetingId, emoji }: { meetingId: string; emoji: string }) => {
        if ((socket.data as { activeMeetingId?: string }).activeMeetingId !== meetingId) return;
        if (!["👍", "👏", "❤️", "🎉", "😂"].includes(emoji)) return;
        io.to(`meet:${tenantId}:${meetingId}`).emit("meet_reaction", {
          userId,
          userName: (socket.data as { userName: string }).userName,
          emoji,
          timestamp: Date.now(),
        });
      });

      socket.on(
        "meet_remove_user",
        async ({
          meetingId,
          targetUserId,
          block,
        }: {
          meetingId: string;
          targetUserId: string;
          block?: boolean;
        }) => {
          try {
            await meetingAccessService.assertHost(meetingId, userId);
            if (block)
              await MeetingModel.updateOne(
                { _id: meetingId },
                { $addToSet: { blockedUserIds: targetUserId } },
              );
            const members = await io.in(`meet:${tenantId}:${meetingId}`).fetchSockets();
            for (const member of members) {
              if ((member.data as { userId?: string }).userId !== targetUserId) continue;
              member.emit("meet_removed", { meetingId, blocked: Boolean(block) });
              member.leave(`meet:${tenantId}:${meetingId}`);
              delete (member.data as { activeMeetingId?: string }).activeMeetingId;
            }
          } catch {
            socket.emit("meet_error", { code: "FORBIDDEN", message: "Host permission required" });
          }
        },
      );

      socket.on(
        "meet_host_control",
        async ({
          meetingId,
          targetUserId,
          action,
        }: {
          meetingId: string;
          targetUserId: string;
          action: "mute_audio" | "mute_video";
        }) => {
          if (!meetingId || !targetUserId || !action) return;
          try {
            await meetingAccessService.assertHost(meetingId, userId);
          } catch {
            return socket.emit("meet_error", {
              code: "FORBIDDEN",
              message: "Host permission required",
            });
          }
          // Emit to the target user's personal room
          io.to(`user:${tenantId}:${targetUserId}`).emit("meet_host_action", { meetingId, action });
        },
      );

      // Helper to clear active call state across all sockets for given user IDs
      const clearUserActiveCalls = (uId: string) => {
        const socketIds = onlineUsers.get(uId);
        if (socketIds) {
          for (const sId of socketIds) {
            const s = io.sockets.sockets.get(sId);
            if (s?.data) delete (s.data as Record<string, unknown>).activeCall;
          }
        }
      };

      // ── WebRTC Signaling ───────────────────────────────────────────────
      socket.on(
        "call_user",
        async ({
          targetUserId,
          type,
          conversationId,
          isGroup,
        }: {
          targetUserId: string;
          type: "audio" | "video";
          conversationId: string;
          isGroup?: boolean;
        }) => {
          try {
            await assertConversationParticipant(conversationId, userId);
            const caller = await userRepository.findById(userId);

            if (isGroup) {
              const conv = await chatRepository.findById(conversationId);
              if (conv) {
                const otherParticipants = conv.participants
                  .map((p: unknown) => String((p as { _id?: unknown })?._id ?? p))
                  .filter((pId: string) => pId !== userId);

                for (const pId of otherParticipants) {
                  io.to(`user:${tenantId}:${pId}`).emit("incoming_call", {
                    callerId: userId,
                    callerName: conv.groupName ?? caller?.name ?? "Group",
                    callerAvatar: conv.groupAvatar ?? caller?.avatar ?? "",
                    type,
                    conversationId,
                    isGroup: true,
                  });
                }
              }
              return;
            }

            await assertConversationParticipant(conversationId, targetUserId);

            // Check if target user has an active call
            const socketIds = onlineUsers.get(targetUserId);
            let targetActiveCall = null;
            if (socketIds) {
              for (const socketId of socketIds) {
                const s = io.sockets.sockets.get(socketId);
                if (s?.data?.activeCall) {
                  targetActiveCall = s.data.activeCall;
                  break;
                }
              }
            }

            if (targetActiveCall) {
              socket.emit("call_waiting", { targetUserId });
              io.to(`user:${tenantId}:${targetUserId}`).emit("incoming_call_waiting", {
                callerId: userId,
                callerName: caller?.name ?? "Someone",
                callerAvatar: caller?.avatar ?? "",
                type,
                conversationId,
              });
              return;
            }

            // Stash call context on the socket so end_call / disconnect can log/clean it
            (socket.data as Record<string, unknown>).activeCall = {
              conversationId,
              type,
              callerId: userId,
              targetUserId,
            };
            io.to(`user:${tenantId}:${targetUserId}`).emit("incoming_call", {
              callerId: userId,
              callerName: caller?.name ?? "Someone",
              callerAvatar: caller?.avatar ?? "",
              type,
              conversationId,
            });
          } catch {
            /* ignore */
          }
        },
      );

      socket.on("reject_waiting_call", ({ callerId }: { callerId: string }) => {
        clearUserActiveCalls(userId);
        clearUserActiveCalls(callerId);
        io.to(`user:${tenantId}:${callerId}`).emit("call_waiting_rejected");
      });

      socket.on(
        "merge_call",
        ({ targetUserId, conversationId }: { targetUserId: string; conversationId: string }) => {
          io.to(`user:${tenantId}:${targetUserId}`).emit("join_existing_channel", {
            conversationId,
          });
        },
      );

      socket.on(
        "accept_call",
        ({
          callerId,
          signalData,
          conversationId,
          callType,
        }: {
          callerId: string;
          signalData: unknown;
          conversationId?: string;
          callType?: "audio" | "video";
        }) => {
          // Stash call context on the acceptor (recipient) socket as well
          if (conversationId) {
            (socket.data as Record<string, unknown>).activeCall = {
              conversationId,
              type: callType ?? "audio",
              callerId,
              targetUserId: callerId,
            };
          }

          io.to(`user:${tenantId}:${callerId}`).emit("call_accepted", {
            signalData,
            acceptorId: userId,
          });
        },
      );

      socket.on(
        "reject_call",
        async ({
          callerId,
          conversationId,
          callType,
        }: {
          callerId: string;
          conversationId?: string;
          callType?: "audio" | "video";
        }) => {
          clearUserActiveCalls(userId);
          clearUserActiveCalls(callerId);
          const convId = conversationId;
          const type = callType ?? "audio";
          if (convId) {
            const label = type === "video" ? "📹 Declined Video Call" : "📞 Declined Voice Call";
            try {
              await chatService.sendMessage(convId, userId, label, "call_log");
            } catch {
              /* non-critical */
            }
          }

          // Emit call_rejected AFTER the database write has completed
          io.to(`user:${tenantId}:${callerId}`).emit("call_rejected", {
            rejectorId: userId,
          });
        },
      );

      socket.on(
        "end_call",
        async ({
          targetUserId,
          conversationId,
          callType,
          wasActive,
        }: {
          targetUserId: string;
          conversationId?: string;
          callType?: "audio" | "video";
          wasActive?: boolean;
        }) => {
          clearUserActiveCalls(userId);
          if (targetUserId) clearUserActiveCalls(targetUserId);

          const activeCall = (socket.data as Record<string, unknown>).activeCall as
            | { conversationId: string; type: "audio" | "video" }
            | undefined;
          const convId = conversationId ?? activeCall?.conversationId;
          const type = callType ?? activeCall?.type ?? "audio";

          if (convId) {
            const label = wasActive
              ? type === "video"
                ? "📹 Video Call"
                : "📞 Voice Call"
              : type === "video"
                ? "📹 Missed Video Call"
                : "📞 Missed Voice Call";
            try {
              await chatService.sendMessage(convId, userId, label, "call_log");
            } catch {
              /* non-critical — don’t break the call flow */
            }
            delete (socket.data as Record<string, unknown>).activeCall;
          }

          // Emit call_ended AFTER the database write has completed
          if (targetUserId) {
            io.to(`user:${tenantId}:${targetUserId}`).emit("call_ended");
          }
        },
      );

      socket.on("disconnect", async () => {
        for (const admission of localMeetingAdmissions) {
          if (admission.endsWith(`:${socket.id}`)) localMeetingAdmissions.delete(admission);
        }
        const lobbyMeetingId = (socket.data as { lobbyMeetingId?: string }).lobbyMeetingId;
        if (lobbyMeetingId) {
          io.to(`meet_host:${tenantId}:${lobbyMeetingId}`).emit("meet_lobby_leave", {
            socketId: socket.id,
          });
        }

        const activeMeetingId = (socket.data as { activeMeetingId?: string }).activeMeetingId;
        if (activeMeetingId) {
          const wasHost = Boolean((socket.data as { isMeetingHost?: boolean }).isMeetingHost);
          await meetingEntitlementService.leave(activeMeetingId, userId).catch(() => undefined);
          if (wasHost) await transferMeetingHost(activeMeetingId);
          setTimeout(async () => {
            const room = await io.in(`meet:${tenantId}:${activeMeetingId}`).fetchSockets();
            const size = room.length;
            if (size === 0) {
              try {
                await MeetingModel.findByIdAndUpdate(activeMeetingId, { status: "completed" });
                await meetingEntitlementService.end(activeMeetingId);
                logger.socket(
                  `Meeting ${activeMeetingId} marked completed as all participants left.`,
                );
              } catch (err) {
                logger.error(`Failed to mark meeting ${activeMeetingId} completed:`, err);
              }
            }
          }, 120_000);
        }

        removeOnline(userId, socket.id);
        const remainingSockets = await io.in(`user:${tenantId}:${userId}`).fetchSockets();
        if (remainingSockets.length === 0) {
          const lastSeenAt = new Date();
          // Persist lastSeenAt (fire-and-forget)
          userRepository.updateById(userId, { lastSeenAt }).catch(() => undefined);
          io.to(`tenant:${tenantId}`).emit("user_offline", { userId, lastSeenAt });
        }

        // Check if this socket had an active call and notify the other participant
        const activeCall = (socket.data as Record<string, unknown>).activeCall as
          | { conversationId: string; type: "audio" | "video"; targetUserId: string }
          | undefined;

        if (activeCall && activeCall.targetUserId) {
          // Emit call_ended to the opponent so they stop ringing / exit call overlay
          io.to(`user:${tenantId}:${activeCall.targetUserId}`).emit("call_ended");

          // Also save a missed call log message to the database
          const label =
            activeCall.type === "video" ? "📹 Missed Video Call" : "📞 Missed Voice Call";
          try {
            await chatService.sendMessage(activeCall.conversationId, userId, label, "call_log");
          } catch {
            /* ignore */
          }
        }

        logger.socket(`disconnected userId=${userId} socketId=${socket.id}`);
      });
    });
  });

  return io;
}
