/**
 * @file club.routes.ts
 */
import { Router } from "express";
import { param, body } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { clubController } from "../controllers/club.controller";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const auth = authenticate;
const canCreate = requirePermission(Module.CLUBS, PermissionAction.CREATE);
const canEdit = requirePermission(Module.CLUBS, PermissionAction.EDIT);
const canApprove = requirePermission(Module.CLUBS, PermissionAction.APPROVE);
const canDelete = requirePermission(Module.CLUBS, PermissionAction.DELETE);

router.get("/", auth, clubController.list);
router.get("/stats", auth, clubController.stats);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  clubController.get,
);
router.post(
  "/",
  [body("name").isString().trim().notEmpty()],
  validate,
  auth,
  canCreate,
  clubController.create,
);
router.patch("/:id", [param("id").isMongoId()], validate, auth, canEdit, clubController.update);
router.delete("/:id", [param("id").isMongoId()], validate, auth, canDelete, clubController.delete);

router.post(
  "/:id/members",
  [param("id").isMongoId(), body("userId").isMongoId()],
  validate,
  auth,
  canEdit,
  clubController.addMember,
);
router.delete(
  "/:id/members/:userId",
  [param("id").isMongoId(), param("userId").isMongoId()],
  validate,
  auth,
  canEdit,
  clubController.removeMember,
);
router.post(
  "/:id/activities",
  [param("id").isMongoId(), body("title").isString().trim().notEmpty(), body("date").isISO8601()],
  validate,
  auth,
  canEdit,
  clubController.addActivity,
);

router.get("/membership-requests/list", auth, clubController.membershipRequests);
router.post(
  "/:id/join-request",
  [param("id").isMongoId(), body("message").optional().trim().isLength({ max: 1000 })],
  validate,
  auth,
  clubController.requestMembership,
);
router.patch(
  "/membership-requests/:requestId/decision",
  [
    param("requestId").isMongoId(),
    body("decision").isIn(["approved", "rejected"]),
    body("note").trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  auth,
  canApprove,
  clubController.decideMembership,
);

export default router;
