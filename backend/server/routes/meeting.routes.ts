import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requirePermission, requireRoles, validate } from "../middlewares";
import { meetingController } from "../controllers";
import { meetingValidation } from "../validations";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";
import { tenantLocalStorage } from "../configs/connectionManager";
import { ProductAddonModel } from "../models/platform.model";
import { TenantModel } from "../models/tenant.model";
import { createPlatformOrder } from "../services/platform-billing.service";
import { meetingAccessService } from "../services/meeting-access.service";
import { MeetingModel } from "../models/meeting.model";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { uploadUtil } from "../utils/upload.util";
import type { UploadedFile } from "express-fileupload";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const { SUPER_ADMIN } = SystemRole;
const canView = requirePermission(Module.MEETING, PermissionAction.VIEW);
const canCreate = requirePermission(Module.MEETING, PermissionAction.CREATE);
const canEdit = requirePermission(Module.MEETING, PermissionAction.EDIT);
const canApprove = requirePermission(Module.MEETING, PermissionAction.APPROVE);
const canDelete = requirePermission(Module.MEETING, PermissionAction.DELETE);

const validateId = [param("id").isMongoId().withMessage("Invalid ID"), validate];
router.get("/usage/summary", authenticate, canApprove, meetingController.usage);
router.get("/addons/catalog", authenticate, canApprove, async (_req, res, next) => {
  try {
    const tenantId = tenantLocalStorage.getStore()?.tenantId;
    const tenant = await TenantModel.findOne({ tenantId }).select("enabledAddonSlugs").lean();
    const addons = await ProductAddonModel.find({
      meetingLimitBoost: { $exists: true },
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();
    res.json({
      success: true,
      data: addons.map((addon) => ({
        ...addon,
        enabled: tenant?.enabledAddonSlugs.includes(addon.slug) ?? false,
      })),
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/addons/:slug/order",
  authenticate,
  requireRoles([SUPER_ADMIN]),
  async (req, res, next) => {
    try {
      const tenantKey = tenantLocalStorage.getStore()?.tenantId;
      const tenant = await TenantModel.findOne({ tenantId: tenantKey }).lean();
      if (!tenant?.planId)
        throw createError(409, "An active paid plan is required before purchasing add-ons.");
      const addon = await ProductAddonModel.findOne({
        slug: req.params.slug,
        isActive: true,
        meetingLimitBoost: { $exists: true },
      }).lean();
      if (!addon) throw createError(404, "Meeting add-on not found.");
      const data = await createPlatformOrder({
        tenantId: String(tenant._id),
        planId: String(tenant.planId),
        addonSlugs: [addon.slug],
        addonOnly: true,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/addons/payment-proof",
  authenticate,
  requireRoles([SUPER_ADMIN]),
  async (req, res, next) => {
    try {
      const tenantKey = tenantLocalStorage.getStore()?.tenantId;
      const tenant = await TenantModel.findOne({ tenantId: tenantKey }).select("_id").lean();
      if (!tenant) throw createError(404, "Tenant not found.");
      const reference = String(req.body.transferReference ?? "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{7,49}$/.test(reference))
        throw createError(400, "Enter a valid bank transaction reference.");
      const proof = req.files?.proof;
      if (!proof || Array.isArray(proof)) throw createError(400, "Payment proof is required.");
      const paymentDate = new Date(String(req.body.paymentDate ?? ""));
      if (
        Number.isNaN(paymentDate.getTime()) ||
        paymentDate > new Date() ||
        paymentDate < new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      )
        throw createError(400, "Payment date must be within the last 45 days.");
      const record = await PlatformBillingRecordModel.findOne({
        _id: req.body.billingId,
        tenantId: tenant._id,
        purchaseKind: "addon",
        paymentMethod: "bank_transfer",
        status: { $in: ["created", "rejected"] },
      });
      if (!record) throw createError(404, "Pending add-on invoice was not found.");
      if (
        await PlatformBillingRecordModel.exists({
          transferReference: reference,
          _id: { $ne: record._id },
        })
      )
        throw createError(409, "This transaction reference has already been submitted.");
      const uploaded = await uploadUtil.uploadDocument(
        proof as UploadedFile,
        "platform/subscription-payment-proofs",
        { publicId: `addon-payment-${record._id}-${Date.now()}` },
      );
      record.transferReference = reference;
      record.paymentDate = paymentDate;
      record.paymentProofUrl = uploaded.url;
      record.paymentProofPublicId = uploaded.publicId;
      record.submittedAt = new Date();
      record.status = "submitted";
      await record.save();
      res.status(202).json({
        success: true,
        data: record,
        message: "Payment proof submitted for platform review.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── Read ─────────────────────────────────────────────────────────────────────
router.get(
  "/",
  authenticate,
  canView,
  [
    query("meetingType").optional().isIn(["faculty", "student"]),
    query("status").optional().isIn(["scheduled", "ongoing", "completed", "cancelled"]),
    query("conductedBy").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  meetingController.list,
);

router.get(
  "/my",
  authenticate,
  canView,
  [
    query("status").optional().isIn(["scheduled", "ongoing", "completed", "cancelled"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  meetingController.myMeetings,
);

router.get(
  "/student",
  authenticate,
  canView,
  [
    query("status").optional().isIn(["scheduled", "ongoing", "completed", "cancelled"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  meetingController.studentMeetings,
);

router.get("/upcoming", authenticate, meetingController.upcomingMeeting);

router.get("/:id/messages", ...validateId, authenticate, async (req, res, next) => {
  try {
    await meetingAccessService.assertParticipant(req.params.id, String(req.user!._id));
    const data = await MeetingMessageModel.find({ meetingId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/room-settings", ...validateId, authenticate, async (req, res, next) => {
  try {
    await meetingAccessService.assertHost(req.params.id, String(req.user!._id));
    const update: Record<string, boolean> = {};
    if (typeof req.body.isLocked === "boolean") update.isLocked = req.body.isLocked;
    if (typeof req.body.allowParticipantScreenShare === "boolean")
      update.allowParticipantScreenShare = req.body.allowParticipantScreenShare;
    const data = await MeetingModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: "after" },
    ).lean();
    res.json({ success: true, data, message: "Meeting room settings updated." });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/co-hosts/:userId",
  ...validateId,
  param("userId").isMongoId(),
  validate,
  authenticate,
  async (req, res, next) => {
    try {
      await meetingAccessService.assertHost(req.params.id, String(req.user!._id));
      const data = await MeetingModel.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { coHostIds: req.params.userId } },
        { returnDocument: "after" },
      ).lean();
      res.json({ success: true, data, message: "Co-host assigned." });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:id", ...validateId, authenticate, meetingController.getById);

// ── Create / Update ───────────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  canCreate,
  meetingValidation.create,
  validate,
  meetingController.create,
);

router.put(
  "/:id",
  ...validateId,
  authenticate,
  canEdit,
  meetingValidation.update,
  validate,
  meetingController.update,
);

// ── Status transition ─────────────────────────────────────────────────────────
router.patch(
  "/:id/status",
  ...validateId,
  authenticate,
  canEdit,
  meetingValidation.updateStatus,
  validate,
  meetingController.updateStatus,
);

// ── Concluding remarks (post-meeting) ─────────────────────────────────────────
router.post(
  "/:id/remarks",
  ...validateId,
  authenticate,
  canEdit,
  meetingValidation.remarks,
  validate,
  meetingController.submitConcludingRemarks,
);

router.patch(
  "/:id/minutes/review",
  authenticate,
  canApprove,
  param("id").isMongoId().withMessage("Invalid ID"),
  body("decision").isIn(["approved", "rejected"]),
  body("note").optional().isString().trim().isLength({ max: 2000 }),
  validate,
  meetingController.reviewMinutes,
);

router.post(
  "/:id/recording-consent",
  ...validateId,
  authenticate,
  meetingController.recordingConsent,
);

// ── Attendance ────────────────────────────────────────────────────────────────
router.post("/:id/attendance", ...validateId, authenticate, meetingController.markAttendance);

// ── Delete ────────────────────────────────────────────────────────────────────
router.get(
  "/:id/deletion-impact",
  ...validateId,
  authenticate,
  canDelete,
  meetingController.deletionImpact,
);
router.delete("/:id", ...validateId, authenticate, canDelete, meetingController.delete);

export default router;
