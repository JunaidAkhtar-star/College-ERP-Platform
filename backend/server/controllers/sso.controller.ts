import type { NextFunction, Request, Response } from "express";
import { ssoService } from "../services/sso.service";

export const ssoController = {
  providers: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ssoService.providers() });
    } catch (error) {
      next(error);
    }
  },
  configurations: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ssoService.configurations() });
    } catch (error) {
      next(error);
    }
  },
  saveConfiguration: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ssoService.saveConfiguration(
        String(req.params["provider"]),
        req.body,
        String(req.user?._id),
        req.headers["x-platform-context"] === "true",
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  testConfiguration: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ssoService.testConfiguration(String(req.params["provider"]));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  start: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ssoService.start(
        req.body.provider,
        req.body.returnUrl,
        req.headers.origin,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  complete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ssoService.complete(req.body.code, req.body.state, req);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
