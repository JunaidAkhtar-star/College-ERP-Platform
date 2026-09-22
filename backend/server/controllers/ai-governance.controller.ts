import type { RequestHandler } from "express";
import { aiGovernanceService } from "../services/ai-governance.service";
import { responseUtil } from "../utils/response.util";
export const aiGovernanceController: Record<string, RequestHandler> = {
  async dashboard(_q, r, n) {
    try {
      responseUtil.success(r, await aiGovernanceService.dashboard());
    } catch (e) {
      n(e);
    }
  },
  async useCases(_q, r, n) {
    try {
      responseUtil.success(r, await aiGovernanceService.useCases());
    } catch (e) {
      n(e);
    }
  },
  async useCaseDetail(q, r, n) {
    try {
      responseUtil.success(r, await aiGovernanceService.useCaseDetail(q.params.id!));
    } catch (e) {
      n(e);
    }
  },
  async createUseCase(q, r, n) {
    try {
      responseUtil.created(
        r,
        await aiGovernanceService.createUseCase(q.user!._id.toString(), q.body),
        "AI use case registered",
      );
    } catch (e) {
      n(e);
    }
  },
  async assessments(_q, r, n) {
    try {
      responseUtil.success(r, await aiGovernanceService.assessments());
    } catch (e) {
      n(e);
    }
  },
  async assess(q, r, n) {
    try {
      responseUtil.created(
        r,
        await aiGovernanceService.assess(q.user!._id.toString(), q.body),
        "AI risk assessment recorded",
      );
    } catch (e) {
      n(e);
    }
  },
  async approve(q, r, n) {
    try {
      responseUtil.success(
        r,
        await aiGovernanceService.approve(q.params.id!, q.user!._id.toString(), q.body),
        "AI governance decision recorded",
      );
    } catch (e) {
      n(e);
    }
  },
  async incidents(_q, r, n) {
    try {
      responseUtil.success(r, await aiGovernanceService.incidents());
    } catch (e) {
      n(e);
    }
  },
  async report(q, r, n) {
    try {
      responseUtil.created(
        r,
        await aiGovernanceService.reportIncident(q.user!._id.toString(), q.body),
        "AI incident reported",
      );
    } catch (e) {
      n(e);
    }
  },
  async transition(q, r, n) {
    try {
      responseUtil.success(
        r,
        await aiGovernanceService.transitionIncident(q.params.id!, q.user!._id.toString(), q.body),
        "AI incident updated",
      );
    } catch (e) {
      n(e);
    }
  },
};
