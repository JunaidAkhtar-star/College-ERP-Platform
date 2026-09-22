import { Router } from "express";
import { body, param } from "express-validator";
import { SystemRole } from "../constants/roles";
import { collaborationController } from "../controllers/collaboration.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const publishers = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.FACULTY,
  SystemRole.ADMINISTRATION_OFFICE,
]);
router.use(authenticate);
router.get("/metadata", collaborationController.metadata);
router.get("/posts", collaborationController.posts);
router.post(
  "/posts",
  publishers,
  [
    body("type").isIn(["discussion", "announcement", "poll"]),
    body("title").isLength({ min: 3, max: 200 }),
    body("content").isLength({ min: 1, max: 10000 }),
    body("scope").isIn(["institution", "roles", "departments"]),
    body("targetRoles").optional().isArray({ max: 50 }),
    body("targetRoles.*").optional().isString().trim().isLength({ min: 1, max: 100 }),
    body("targetDepartments").optional().isArray({ max: 50 }),
    body("targetDepartments.*").optional().isMongoId(),
    body("attachments").optional().isArray({ max: 10 }),
    body("attachments.*.name").optional().trim().isLength({ min: 1, max: 255 }),
    body("attachments.*.url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("pollOptions").optional().isArray({ min: 2, max: 20 }),
    body("pollOptions.*").optional().trim().isLength({ min: 1, max: 300 }),
    body("pollEndsAt").optional().isISO8601(),
    body("allowMultipleVotes").optional().isBoolean(),
  ],
  validate,
  collaborationController.createPost,
);
router.get("/posts/:id", [param("id").isMongoId()], validate, collaborationController.post);
router.patch(
  "/posts/:id",
  [
    param("id").isMongoId(),
    body("isPinned").optional().isBoolean(),
    body("isLocked").optional().isBoolean(),
  ],
  validate,
  collaborationController.managePost,
);
router.post(
  "/posts/:id/replies",
  [
    param("id").isMongoId(),
    body("content").isLength({ min: 1, max: 5000 }),
    body("attachments").optional().isArray({ max: 10 }),
    body("attachments.*.name").optional().trim().isLength({ min: 1, max: 255 }),
    body("attachments.*.url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  collaborationController.reply,
);
router.post(
  "/posts/:id/vote",
  [
    param("id").isMongoId(),
    body("optionIds").isArray({ min: 1, max: 20 }),
    body("optionIds.*").isString().trim().isLength({ min: 1, max: 100 }),
  ],
  validate,
  collaborationController.vote,
);
router.get("/albums", collaborationController.albums);
router.post(
  "/albums",
  publishers,
  [
    body("name").isLength({ min: 2, max: 150 }),
    body("scope").isIn(["institution", "roles", "departments"]),
    body("description").optional().trim().isLength({ max: 5000 }),
    body("targetRoles").optional().isArray({ max: 50 }),
    body("targetRoles.*").optional().isString().trim().isLength({ min: 1, max: 100 }),
    body("targetDepartments").optional().isArray({ max: 50 }),
    body("targetDepartments.*").optional().isMongoId(),
  ],
  validate,
  collaborationController.createAlbum,
);
router.get("/albums/:id", [param("id").isMongoId()], validate, collaborationController.album);
router.post(
  "/albums/:id/media",
  publishers,
  [
    param("id").isMongoId(),
    body("title").isLength({ min: 1, max: 200 }),
    body("url").isURL({ protocols: ["https"], require_protocol: true }),
    body("mimeType").isString().notEmpty(),
    body("description").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  collaborationController.addMedia,
);
export default router;
