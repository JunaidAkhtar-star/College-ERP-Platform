import type { Request, Response, NextFunction } from "express";
import { chatService } from "../services";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { assertConversationParticipant } from "../services/chat.service";
import { MeetingModel } from "../models/meeting.model";
import { meetingAccessService } from "../services/meeting-access.service";
import { platformIntegrationService } from "../services/platform-integration.service";
import { SystemRole } from "../constants/roles";

export const chatController = {
  getMyConversations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.getUserConversations(
        req.user!._id as unknown as string,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  startDirect: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      const data = await chatService.getOrCreateDirect(
        req.user!._id as unknown as string,
        userId,
        req.user!,
        req.activeRole as SystemRole,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createGroup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, participantIds, description } = req.body;
      const data = await chatService.createGroup(
        name,
        participantIds ?? [],
        req.user!._id as unknown as string,
        description,
        req.user!,
        req.activeRole as SystemRole,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  sendMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, messageType, fileUrl, fileName, replyTo } = req.body;
      const data = await chatService.sendMessage(
        req.params.id,
        req.user!._id as unknown as string,
        content,
        messageType,
        fileUrl,
        fileName,
        replyTo,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getMessages: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.getMessages(
        req.params.id,
        req.user?._id.toString() || "",
        Number(req.query.page) || 1,
        Number(req.query.limit) || 50,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await chatService.markRead(req.params.id, req.user!._id as unknown as string);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // ── Group Management ────────────────────────────────────────────────────────

  updateGroup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupName, groupAvatar, groupDescription } = req.body;
      const data = await chatService.updateGroupInfo(
        req.params.id,
        req.user!._id as unknown as string,
        { groupName, groupAvatar, groupDescription },
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  addMembers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds } = req.body;
      const data = await chatService.addMembers(
        req.params.id,
        req.user!._id as unknown as string,
        userIds,
        req.user!,
        req.activeRole as SystemRole,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  removeMember: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.removeMember(
        req.params.id,
        req.user!._id as unknown as string,
        req.params.userId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  leaveGroup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.leaveGroup(req.params.id, req.user!._id as unknown as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  makeAdmin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.makeAdmin(
        req.params.id,
        req.user!._id as unknown as string,
        req.params.userId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  removeAdmin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.removeAdmin(
        req.params.id,
        req.user!._id as unknown as string,
        req.params.userId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  generateInviteLink: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.generateInviteLink(
        req.params.id,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  joinByInviteLink: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.joinByInviteLink(
        req.params.token,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Message Actions ────────────────────────────────────────────────────────

  deleteMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deleteFor } = req.query; // "everyone" | "me"
      if (deleteFor === "everyone") {
        await chatService.deleteForEveryone(
          req.params.id,
          req.params.msgId,
          req.user!._id as unknown as string,
        );
      } else {
        await chatService.deleteForMe(
          req.params.id,
          req.params.msgId,
          req.user!._id as unknown as string,
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  addReaction: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { emoji } = req.body;
      const data = await chatService.addReaction(
        req.params.id,
        req.params.msgId,
        req.user!._id as unknown as string,
        emoji,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Contacts & Directory ───────────────────────────────────────────────────

  getContacts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contactType = ["faculty", "students"].includes(String(req.query.contactType))
        ? (String(req.query.contactType) as "faculty" | "students")
        : "default";
      const data = await chatService.getContacts(req.user!, req.activeRole as SystemRole, {
        contactType,
        departmentId:
          typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
        program: typeof req.query.program === "string" ? req.query.program : undefined,
        academicYear:
          typeof req.query.academicYear === "string" ? req.query.academicYear : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  searchUsers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = ((req.query.q as string) ?? "").trim();
      const limit = Number(req.query.limit) || 20;
      const data = await chatService.searchUsers(q, req.user!, limit, req.activeRole as SystemRole);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Mute / Unmute ──────────────────────────────────────────────────────────

  toggleMute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.toggleMute(req.user!._id as unknown as string, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listMuted: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.getMutedConversations(req.user!._id as unknown as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Pin / Unpin ────────────────────────────────────────────────────────────

  togglePin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.togglePin(req.user!._id as unknown as string, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listPinned: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await chatService.getPinnedConversations(req.user!._id as unknown as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Call Token ─────────────────────────────────────────────────────────────

  getCallToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelName = req.query.channelName as string;
      if (!channelName) {
        res
          .status(400)
          .json({ success: false, message: "channelName query parameter is required" });
        return;
      }
      const account = req.user?._id.toString() || "";
      const isMeeting = await MeetingModel.exists({ _id: channelName });
      if (isMeeting) await meetingAccessService.assertParticipant(channelName, account);
      else await assertConversationParticipant(channelName, account);

      const agora = await platformIntegrationService.credentials<{ appId: string }>("agora");

      if (!agora) {
        res
          .status(503)
          .json({ success: false, message: "Video and voice calling is not currently available." });
        return;
      }

      const expirationTimeInSeconds = 7200;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtcTokenBuilder.buildTokenWithUserAccount(
        agora.config.appId,
        agora.secret,
        channelName,
        account,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs,
      );

      res.json({ success: true, token });
    } catch (err) {
      next(err);
    }
  },

  clearChatHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!._id.toString();
      await chatService.clearChatHistory(userId, req.params.id);
      res.json({ success: true, message: "Chat history cleared" });
    } catch (err) {
      next(err);
    }
  },

  deleteConversation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!._id.toString();
      await chatService.deleteConversation(userId, req.params.id);
      res.json({ success: true, message: "Conversation deleted" });
    } catch (err) {
      next(err);
    }
  },
};
