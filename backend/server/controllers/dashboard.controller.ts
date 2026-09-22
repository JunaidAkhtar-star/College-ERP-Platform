import type { Request, Response, NextFunction } from "express";
import { dashboardService } from "../services/dashboard.service";
import { SystemRole } from "../constants/roles";
import { getDepartmentScope } from "../utils/ownership.util";

export const dashboardController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const role = req.activeRole as SystemRole;
      const userId = (user._id as unknown as { toString(): string }).toString();

      let data: unknown;

      if (role === SystemRole.SUPER_ADMIN) {
        // This controller is mounted inside a resolved tenant database. A
        // tenant Super Admin governs one institution; platform-wide tenant,
        // billing and support analytics belong to the separate admin app.
        data = await dashboardService.getAdminDashboard();
      } else if (role === SystemRole.ADMIN) {
        data = await dashboardService.getAdminDashboard();
      } else if (role === SystemRole.PRINCIPAL) {
        const academicYear =
          typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
        data = await dashboardService.getPrincipalDashboard(academicYear);
      } else if (role === SystemRole.ADMINISTRATION_OFFICE) {
        data = await dashboardService.getAdministrationOfficeDashboard(userId);
      } else if (role === SystemRole.ASSISTANT_ADMINISTRATION_OFFICER) {
        data = await dashboardService.getAssistantAdministrationOfficerDashboard(userId);
      } else if (role === SystemRole.DEAN_ACADEMIC) {
        data = await dashboardService.getDeanAcademicDashboard(userId);
      } else if (role === SystemRole.HOD) {
        const deptId = await getDepartmentScope(req);
        data = await dashboardService.getHodDashboard(deptId, userId);
      } else if (role === SystemRole.FACULTY) {
        data = await dashboardService.getFacultyDashboard(userId);
      } else if (role === SystemRole.STUDENT) {
        data = await dashboardService.getStudentDashboard(userId);
      } else if (role === SystemRole.PLACEMENT_CELL) {
        data = await dashboardService.getPlacementDashboard(userId);
      } else if (role === SystemRole.LIBRARY_STAFF) {
        data = await dashboardService.getLibraryDashboard(userId);
      } else if (role === SystemRole.HOSTEL_WARDEN) {
        data = await dashboardService.getHostelWardenDashboard(userId);
      } else if (role === SystemRole.PARENT) {
        data = await dashboardService.getParentDashboard(userId);
      } else if (role === SystemRole.HR_DEPARTMENT) {
        data = await dashboardService.getHrDashboard(userId);
      } else if (role === SystemRole.ACCOUNTS_DEPARTMENT) {
        data = await dashboardService.getAccountsDashboard(userId);
      } else if (role === SystemRole.EXAMINATION_CELL) {
        data = await dashboardService.getExaminationDashboard(userId);
      } else if (role === SystemRole.IQAC_TEAM || role === SystemRole.IQAC_NAAC) {
        data = await dashboardService.getIqacDashboard(userId);
      } else if (role === SystemRole.SCHOLARSHIP_CELL) {
        data = await dashboardService.getScholarshipDashboard(userId);
      } else if (role === SystemRole.ADMISSION_COUNSELOR) {
        data = await dashboardService.getAdmissionCounselorDashboard(userId);
      } else if (role === SystemRole.ADMISSION_INCHARGE) {
        data = await dashboardService.getAdmissionInchargeDashboard(userId);
      } else if (role === SystemRole.STORE) {
        data = await dashboardService.getStoreDashboard(userId);
      } else if (role === SystemRole.TRANSPORTATION) {
        data = await dashboardService.getTransportationDashboard(userId);
      } else if (role === SystemRole.RESEARCH_DEVELOPMENT) {
        data = await dashboardService.getResearchDevelopmentDashboard(userId);
      } else if (role === SystemRole.CLUB_HEAD) {
        data = await dashboardService.getClubHeadDashboard(userId);
      } else if (role === SystemRole.IIC) {
        data = await dashboardService.getIicDashboard(userId);
      } else {
        // Specialist roles without a dedicated dashboard yet. Serve a neutral common view.
        data = await dashboardService.getCommonDashboard(userId);
      }

      res.json({ success: true, role, data });
    } catch (err) {
      next(err);
    }
  },
};
