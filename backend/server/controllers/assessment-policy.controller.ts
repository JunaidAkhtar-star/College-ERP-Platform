import type { Request, Response, NextFunction } from "express";
import { assessmentPolicyService } from "../services/assessment-policy.service";
const run =
  (handler: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: await handler(req) });
    } catch (error) {
      next(error);
    }
  };
export const assessmentPolicyController = {
  list: run((req) => assessmentPolicyService.list(req.query as Record<string, unknown>)),
  get: run((req) => assessmentPolicyService.get(req.params["id"]!)),
  create: run((req) => assessmentPolicyService.create(req.body, req.user!._id.toString()), 201),
  update: run((req) => assessmentPolicyService.update(req.params["id"]!, req.body)),
  publish: run((req) =>
    assessmentPolicyService.publish(req.params["id"]!, req.user!._id.toString()),
  ),
  retire: run((req) => assessmentPolicyService.retire(req.params["id"]!, req.user!._id.toString())),
  clone: run(
    (req) => assessmentPolicyService.clone(req.params["id"]!, req.user!._id.toString()),
    201,
  ),
  preview: run((req) => assessmentPolicyService.preview(req.params["id"]!, req.body.scores)),
};
