import type { NextFunction, Request, Response } from "express";
import { formWorkflowService } from "../services/form-workflow.service";

const identity = (req: Request) => ({
  id: String(req.user?._id),
  name: req.user?.name || "User",
  roles: req.activeRole ? [String(req.activeRole)] : [],
});

export const formWorkflowController = {
  metadata: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await formWorkflowService.metadata() });
    } catch (error) {
      next(error);
    }
  },
  definitions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.listDefinitions(false, identity(req).roles[0]),
      });
    } catch (error) {
      next(error);
    }
  },
  manageDefinitions: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await formWorkflowService.listDefinitions(true) });
    } catch (error) {
      next(error);
    }
  },
  definition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.getDefinition(String(req.params["id"]), false),
      });
    } catch (error) {
      next(error);
    }
  },
  manageDefinition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.getDefinition(String(req.params["id"]), true),
      });
    } catch (error) {
      next(error);
    }
  },
  saveDefinition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await formWorkflowService.saveDefinition(
        req.body,
        String(req.user?._id),
        req.params["id"],
      );
      res.status(req.params["id"] ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.publish(String(req.params["id"]), String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  submitForReview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.submitForReview(
          String(req.params["id"]),
          String(req.user?._id),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await formWorkflowService.submit(
          String(req.params["id"]),
          req.body.data ?? {},
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  mine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.mySubmissions(String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  inbox: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = identity(req);
      res.json({ success: true, data: await formWorkflowService.inbox(user.id, user.roles) });
    } catch (error) {
      next(error);
    }
  },
  allSubmissions: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await formWorkflowService.allSubmissions() });
    } catch (error) {
      next(error);
    }
  },
  decide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.decide(
          String(req.params["id"]),
          req.body.decision,
          req.body.note,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  withdraw: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.withdraw(String(req.params["id"]), String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  remind: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.remind(String(req.params["id"]), identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  delegations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.myDelegations(String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  createDelegation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await formWorkflowService.createDelegation(identity(req), req.body),
      });
    } catch (error) {
      next(error);
    }
  },
  revokeDelegation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await formWorkflowService.revokeDelegation(
          String(req.params["id"]),
          String(req.user?._id),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
};
