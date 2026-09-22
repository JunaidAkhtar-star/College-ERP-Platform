import type { Request, Response, NextFunction } from "express";
import { assessmentGradebookService } from "../services/assessment-gradebook.service";
const run =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: await fn(req) });
    } catch (error) {
      next(error);
    }
  };
export const assessmentGradebookController = {
  activities: run((req) =>
    assessmentGradebookService.listActivities(
      req.query as Record<string, unknown>,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  createActivity: run(
    (req) =>
      assessmentGradebookService.createActivity(
        req.body,
        req.user!._id.toString(),
        req.activeRole,
        req.user!.department?.toString(),
      ),
    201,
  ),
  updateActivity: run((req) =>
    assessmentGradebookService.updateActivity(
      req.params["id"]!,
      req.body,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  ledgers: run((req) =>
    assessmentGradebookService.listLedgers(
      req.query as Record<string, unknown>,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  record: run((req) =>
    assessmentGradebookService.recordScore(
      req.body,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  bulkRecord: run((req) =>
    assessmentGradebookService.bulkRecordScores(
      req.body.scores,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  submit: run((req) =>
    assessmentGradebookService.submit(req.params["id"]!, req.user!._id.toString()),
  ),
  verify: run((req) =>
    assessmentGradebookService.verify(
      req.params["id"]!,
      req.user!._id.toString(),
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  returnForCorrection: run((req) =>
    assessmentGradebookService.returnForCorrection(
      req.params["id"]!,
      req.user!._id.toString(),
      req.body.note,
      req.activeRole,
      req.user!.department?.toString(),
    ),
  ),
  freeze: run((req) =>
    assessmentGradebookService.freeze(req.params["id"]!, req.user!._id.toString()),
  ),
};
