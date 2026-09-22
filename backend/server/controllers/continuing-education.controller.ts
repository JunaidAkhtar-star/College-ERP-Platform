import type { RequestHandler } from "express";
import { continuingEducationService } from "../services/continuing-education.service";
import { responseUtil } from "../utils/response.util";
export const continuingEducationController: Record<string, RequestHandler> = {
  async dashboard(_q, r, n) {
    try {
      responseUtil.success(r, await continuingEducationService.dashboard());
    } catch (e) {
      n(e);
    }
  },
  async offerings(_q, r, n) {
    try {
      responseUtil.success(r, await continuingEducationService.offerings());
    } catch (e) {
      n(e);
    }
  },
  async createOffering(q, r, n) {
    try {
      responseUtil.created(
        r,
        await continuingEducationService.createOffering(q.user!._id.toString(), q.body),
        "Offering created",
      );
    } catch (e) {
      n(e);
    }
  },
  async cohorts(_q, r, n) {
    try {
      responseUtil.success(r, await continuingEducationService.cohorts());
    } catch (e) {
      n(e);
    }
  },
  async createCohort(q, r, n) {
    try {
      responseUtil.created(
        r,
        await continuingEducationService.createCohort(q.user!._id.toString(), q.body),
        "Cohort created",
      );
    } catch (e) {
      n(e);
    }
  },
  async enrollments(_q, r, n) {
    try {
      responseUtil.success(r, await continuingEducationService.enrollments());
    } catch (e) {
      n(e);
    }
  },
  async enroll(q, r, n) {
    try {
      responseUtil.created(
        r,
        await continuingEducationService.enroll(q.user!._id.toString(), q.body),
        "Learner enrolled",
      );
    } catch (e) {
      n(e);
    }
  },
  async progress(q, r, n) {
    try {
      responseUtil.success(
        r,
        await continuingEducationService.recordProgress(
          q.params.id!,
          q.user!._id.toString(),
          q.body,
        ),
        "Learner progress updated",
      );
    } catch (e) {
      n(e);
    }
  },
  async complete(q, r, n) {
    try {
      responseUtil.success(
        r,
        await continuingEducationService.complete(q.params.id!, q.user!._id.toString(), q.body),
        "Enrollment finalized",
      );
    } catch (e) {
      n(e);
    }
  },
  async verify(q, r, n) {
    try {
      responseUtil.success(r, await continuingEducationService.verifyCredential(q.params.code!));
    } catch (e) {
      n(e);
    }
  },
};
