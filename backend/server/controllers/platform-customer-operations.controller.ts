import type { RequestHandler } from "express";
import { platformCustomerOperationsService } from "../services/platform-customer-operations.service";
import { responseUtil } from "../utils/response.util";
export const platformCustomerOperationsController: Record<string, RequestHandler> = {
  async owners(_q, r, n) {
    try {
      responseUtil.success(r, await platformCustomerOperationsService.owners());
    } catch (e) {
      n(e);
    }
  },
  async dashboard(_q, r, n) {
    try {
      responseUtil.success(r, await platformCustomerOperationsService.dashboard());
    } catch (e) {
      n(e);
    }
  },
  async projects(_q, r, n) {
    try {
      responseUtil.success(r, await platformCustomerOperationsService.projects());
    } catch (e) {
      n(e);
    }
  },
  async createProject(q, r, n) {
    try {
      responseUtil.created(
        r,
        await platformCustomerOperationsService.createProject(q.user!._id.toString(), q.body),
        "Implementation project created",
      );
    } catch (e) {
      n(e);
    }
  },
  async milestone(q, r, n) {
    try {
      responseUtil.success(
        r,
        await platformCustomerOperationsService.updateMilestone(
          q.params.id!,
          q.params.milestoneId!,
          q.user!._id.toString(),
          q.body,
        ),
        "Milestone updated",
      );
    } catch (e) {
      n(e);
    }
  },
  async projectStage(q, r, n) {
    try {
      responseUtil.success(
        r,
        await platformCustomerOperationsService.transitionProject(
          q.params.id!,
          q.user!._id.toString(),
          q.body.stage,
        ),
        "Implementation stage updated",
      );
    } catch (e) {
      n(e);
    }
  },
  async addRisk(q, r, n) {
    try {
      responseUtil.created(
        r,
        await platformCustomerOperationsService.addRisk(
          q.params.id!,
          q.user!._id.toString(),
          q.body,
        ),
        "Implementation risk recorded",
      );
    } catch (e) {
      n(e);
    }
  },
  async mitigateRisk(q, r, n) {
    try {
      responseUtil.success(
        r,
        await platformCustomerOperationsService.mitigateRisk(
          q.params.id!,
          q.params.riskId!,
          q.user!._id.toString(),
        ),
        "Implementation risk mitigated",
      );
    } catch (e) {
      n(e);
    }
  },
  async tickets(_q, r, n) {
    try {
      responseUtil.success(r, await platformCustomerOperationsService.tickets());
    } catch (e) {
      n(e);
    }
  },
  async createTicket(q, r, n) {
    try {
      responseUtil.created(
        r,
        await platformCustomerOperationsService.createTicket(q.user!._id.toString(), q.body),
        "Support ticket created",
      );
    } catch (e) {
      n(e);
    }
  },
  async transition(q, r, n) {
    try {
      responseUtil.success(
        r,
        await platformCustomerOperationsService.transitionTicket(
          q.params.id!,
          q.user!._id.toString(),
          q.body,
        ),
        "Support ticket updated",
      );
    } catch (e) {
      n(e);
    }
  },
  async comment(q, r, n) {
    try {
      responseUtil.success(
        r,
        await platformCustomerOperationsService.comment(
          q.params.id!,
          q.user!._id.toString(),
          q.body,
        ),
        "Support comment added",
      );
    } catch (e) {
      n(e);
    }
  },
};
