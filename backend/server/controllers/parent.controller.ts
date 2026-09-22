import type { RequestHandler } from "express";
import { parentService } from "../services/parent.service";
import { responseUtil } from "../utils/response.util";
import type { UploadedFile } from "express-fileupload";

export const parentController: Record<string, RequestHandler> = {
  /** GET /parent/ward */
  async getWard(req, res, next) {
    try {
      const profile = await parentService.getWard(req.user?._id.toString() || "");
      responseUtil.success(res, profile);
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/attendance */
  async getAttendance(req, res, next) {
    try {
      const { semester, academicYear } = req.query;
      const data = await parentService.getWardAttendance(
        req.user?._id.toString() || "",
        semester ? Number(semester) : undefined,
        academicYear as string | undefined,
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/results */
  async getResults(req, res, next) {
    try {
      const data = await parentService.getWardResults(req.user?._id.toString() || "");
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/fees */
  async getFees(req, res, next) {
    try {
      const data = await parentService.getWardFees(req.user?._id.toString() || "");
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/notices */
  async getNotices(req, res, next) {
    try {
      const result = await parentService.getNotices(
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** POST /parent/messages */
  async sendMessage(req, res, next) {
    try {
      const { recipientId, content, conversationId } = req.body;
      const message = await parentService.sendMessage(
        req.user?._id.toString() || "",
        recipientId,
        content,
        conversationId,
      );
      responseUtil.success(res, message, "Message sent", 201);
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/messages */
  async getConversations(req, res, next) {
    try {
      const data = await parentService.getConversations(
        req.user?._id.toString() || "",
        Number(req.query.page) || 1,
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  // ── Fee Payment ────────────────────────────────────────────────────────────

  /** POST /parent/fees/pay */
  async initiatePayment(req, res, next) {
    try {
      const screenshot = req.files?.screenshot as UploadedFile | undefined;
      const data = await parentService.initiatePayment(
        req.user?._id.toString() || "",
        req.body,
        screenshot,
      );
      responseUtil.created(res, data, "Payment submitted for Accounts verification");
    } catch (err) {
      next(err);
    }
  },

  /** GET /parent/fees/history */
  async getPaymentHistory(req, res, next) {
    try {
      const data = await parentService.getPaymentHistory(req.user?._id.toString() || "");
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },
};
