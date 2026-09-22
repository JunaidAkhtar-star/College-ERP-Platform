import type { RequestHandler } from "express";
import { complianceService } from "../services/compliance.service";
import { getDepartmentScope } from "../utils/ownership.util";

export const complianceController: Record<string, RequestHandler> = {
  /** GET /compliance/export/naac-1 */
  async exportNaacCriteria1(req, res, next) {
    try {
      const csv = await complianceService.exportCriteria1CSV(
        String(req.query.academicYear),
        await getDepartmentScope(req),
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=naac_criteria_1_enrollment.csv");
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  },

  /** GET /compliance/export/naac-5 */
  async exportNaacCriteria5(req, res, next) {
    try {
      const csv = await complianceService.exportCriteria5CSV(
        String(req.query.academicYear),
        await getDepartmentScope(req),
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=naac_criteria_5_placement.csv");
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  },

  /** GET /compliance/export/nba-performance */
  async exportNbaPerformance(req, res, next) {
    try {
      const csv = await complianceService.exportNbaPerformanceCSV(
        String(req.query.academicYear),
        await getDepartmentScope(req),
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=nba_student_performance.csv");
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  },
};
export default complianceController;
