import type { NextFunction, Request, Response } from "express";
import { externalConnectorService } from "../services/external-connector.service";

export const externalConnectorController = {
  twilioReceipt: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = Object.fromEntries(
        Object.entries(req.body as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      );
      res.json({
        success: true,
        data: await externalConnectorService.processTwilioReceipt(
          req.params.connectorId,
          String(req.headers["x-twilio-signature"] ?? ""),
          params,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  metadata: (_req: Request, res: Response) =>
    res.json({ success: true, data: externalConnectorService.metadata() }),
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await externalConnectorService.list() });
    } catch (error) {
      next(error);
    }
  },
  save: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(req.params.id ? 200 : 201).json({
        success: true,
        data: await externalConnectorService.save(req.body, String(req.user?._id), req.params.id),
      });
    } catch (error) {
      next(error);
    }
  },
  test: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await externalConnectorService.test(String(req.params.id), String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  execute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(202).json({
        success: true,
        data: await externalConnectorService.execute(
          String(req.params.id),
          String(req.body.operation),
          req.body.payload as Record<string, unknown>,
          String(req.body.idempotencyKey),
          String(req.user?._id),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  executions: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await externalConnectorService.executions() });
    } catch (error) {
      next(error);
    }
  },
};
