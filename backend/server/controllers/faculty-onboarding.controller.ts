import type { RequestHandler } from "express";
import { facultyOnboardingService } from "../services/faculty-onboarding.service";
import { responseUtil } from "../utils/response.util";
import type { IUser } from "../models/user.model";
import { FacultyOnboardingDraftModel } from "../models/faculty-onboarding-draft.model";

export const facultyOnboardingController: Record<string, RequestHandler> = {
  /** POST /faculty-onboarding — admin creates a new faculty account. */
  async create(req, res, next) {
    try {
      const result = await facultyOnboardingService.createFaculty(req.body, req.user as IUser, req);
      // Clear draft on successful onboarding
      await FacultyOnboardingDraftModel.deleteOne({ createdBy: (req.user as IUser)._id });
      responseUtil.success(res, result, "Faculty onboarded — invite email sent");
    } catch (err) {
      next(err);
    }
  },

  /** GET /faculty-onboarding/invite/:token — resolve invite for set-password page. */
  async resolveInvite(req, res, next) {
    try {
      const data = await facultyOnboardingService.resolveInviteToken(req.params["token"] ?? "");
      responseUtil.success(res, data, "Invite resolved");
    } catch (err) {
      next(err);
    }
  },

  /** POST /faculty-onboarding/invite/complete — verify email + set initial password. */
  async completeInvite(req, res, next) {
    try {
      const { token, password } = req.body;
      await facultyOnboardingService.completeInvite(token, password);
      responseUtil.success(res, undefined, "Account activated. You can now log in.");
    } catch (err) {
      next(err);
    }
  },

  /** GET /faculty-onboarding/draft — retrieve active draft */
  async getDraft(req, res, next) {
    try {
      const draft = await FacultyOnboardingDraftModel.findOne({
        createdBy: (req.user as IUser)._id,
      });
      responseUtil.success(res, draft, "Draft retrieved");
    } catch (err) {
      next(err);
    }
  },

  /** POST /faculty-onboarding/draft — save or update draft */
  async saveDraft(req, res, next) {
    try {
      const { step, draftData } = req.body;
      const draft = await FacultyOnboardingDraftModel.findOneAndUpdate(
        { createdBy: (req.user as IUser)._id },
        { step, draftData },
        { upsert: true, returnDocument: "after" },
      );
      responseUtil.success(res, draft, "Draft saved");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /faculty-onboarding/draft — delete draft */
  async deleteDraft(req, res, next) {
    try {
      await FacultyOnboardingDraftModel.deleteOne({ createdBy: (req.user as IUser)._id });
      responseUtil.success(res, undefined, "Draft deleted");
    } catch (err) {
      next(err);
    }
  },
};
