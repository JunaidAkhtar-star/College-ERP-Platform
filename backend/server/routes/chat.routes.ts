import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, validate } from "../middlewares";
import { chatController } from "../controllers";
import { getOnlineUserIds } from "../socket/socket.gateway";
import { chatRepository } from "../repositories";
import { platformIntegrationService } from "../services/platform-integration.service";

const router = Router();

// ── Conversations ──────────────────────────────────────────────────────────
router.get("/", authenticate, chatController.getMyConversations);
router.post(
  "/direct",
  authenticate,
  [body("userId").isMongoId()],
  validate,
  chatController.startDirect,
);
router.post(
  "/group",
  authenticate,
  [
    body("name").isString().trim().isLength({ min: 1, max: 120 }),
    body("participantIds").isArray({ max: 199 }),
    body("participantIds.*").isMongoId(),
  ],
  validate,
  chatController.createGroup,
);

// ── Contacts & Directory ────────────────────────────────────────────────────
router.get("/contacts", authenticate, chatController.getContacts);
router.get("/users/search", authenticate, chatController.searchUsers);

// ── Call Token ──────────────────────────────────────────────────────────────
router.get("/call/readiness", authenticate, async (_req, res, next) => {
  try {
    const agora = await platformIntegrationService.credentials<{ appId: string }>("agora");
    res.json({
      success: true,
      data: {
        ready: Boolean(agora),
        reason: agora ? undefined : "Video and voice calling is not configured by the platform.",
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get(
  "/call/token",
  authenticate,
  [query("channelName").isMongoId()],
  validate,
  chatController.getCallToken,
);

// ── Messages ────────────────────────────────────────────────────────────────
router.get(
  "/:id/messages",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  chatController.getMessages,
);
router.post(
  "/:id/messages",
  authenticate,
  [
    param("id").isMongoId(),
    body("content").optional().isString().isLength({ max: 10000 }),
    body("messageType").optional().isIn(["text", "file", "image", "audio", "video"]),
    body("replyTo").optional().isMongoId(),
  ],
  validate,
  chatController.sendMessage,
);
router.post(
  "/:id/read",
  authenticate,
  [param("id").isMongoId()],
  validate,
  chatController.markRead,
);
router.delete(
  "/:id/messages/:msgId",
  [param("msgId").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,

  chatController.deleteMessage,
); // ?deleteFor=everyone|me
router.post(
  "/:id/messages/:msgId/react",
  authenticate,
  [
    param("id").isMongoId(),
    param("msgId").isMongoId(),
    body("emoji").isString().trim().isLength({ min: 1, max: 16 }),
  ],
  validate,
  chatController.addReaction,
);

// ── Group Management ────────────────────────────────────────────────────────
router.put(
  "/:id/group",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,

  chatController.updateGroup,
); // update name/avatar/description
router.post(
  "/:id/members",
  authenticate,
  [
    param("id").isMongoId(),
    body("userIds").isArray({ min: 1, max: 199 }),
    body("userIds.*").isMongoId(),
  ],
  validate,
  chatController.addMembers,
);
router.delete(
  "/:id/members/:userId",
  [param("userId").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,

  chatController.removeMember,
); // remove member (admin or self)
router.post("/:id/leave", authenticate, chatController.leaveGroup); // leaving is always allowed
router.post(
  "/:id/admins/:userId",
  authenticate,
  [param("id").isMongoId(), param("userId").isMongoId()],
  validate,
  chatController.makeAdmin,
);
router.delete(
  "/:id/admins/:userId",
  [param("userId").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,

  chatController.removeAdmin,
); // demote admin
router.post(
  "/:id/invite-link",
  authenticate,

  chatController.generateInviteLink,
);
router.post("/join/:token", authenticate, chatController.joinByInviteLink);

// ── Presence ────────────────────────────────────────────────────────────────
router.get("/online/users", authenticate, async (_req, res, next) => {
  try {
    res.json({ success: true, onlineUserIds: await getOnlineUserIds() });
  } catch (error) {
    next(error);
  }
});

// ── Mute / Unmute ───────────────────────────────────────────────────────────
router.get("/muted", authenticate, chatController.listMuted);
router.post(
  "/:id/mute",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  chatController.toggleMute,
);

// ── Pin / Unpin ─────────────────────────────────────────────────────────────
router.get("/pinned", authenticate, chatController.listPinned);
router.post(
  "/:id/pin",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  chatController.togglePin,
);

// ── Message Search (M30) ────────────────────────────────────────────────────
router.get("/search", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q) return res.json({ success: true, data: [] });
    const userId = req.user!._id.toString();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await chatRepository.searchMessages(userId, q, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/clear", authenticate, chatController.clearChatHistory);
router.delete("/:id", authenticate, chatController.deleteConversation);

export default router;
