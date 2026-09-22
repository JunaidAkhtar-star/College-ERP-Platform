import type { Types } from "mongoose";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { StudentPlacementProfileModel } from "../models/student-placement-profile.model";
import { formatIndiaDate } from "../utils/date.util";

const csvCell = (value: unknown): string => {
  let text = String(value ?? "—");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const academicYearRange = (academicYear: string) => {
  const startYear = Number(academicYear.slice(0, 4));
  return {
    $gte: new Date(Date.UTC(startYear, 6, 1)),
    $lt: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
};

interface IPopulatedDepartment {
  _id: Types.ObjectId;
  name: string;
}

interface IPopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

export const complianceService = {
  /** Export NAAC Criteria 1 (Student Enrollment details) */
  exportCriteria1CSV: async (academicYear: string, departmentId?: string): Promise<string> => {
    const students = await StudentProfileModel.find({
      status: StudentStatus.ACTIVE,
      academicYear,
      ...(departmentId ? { department: departmentId } : {}),
    })
      .populate<{ department: IPopulatedDepartment }>("department", "name")
      .lean();

    const headers = [
      "Student Name",
      "Roll Number",
      "Program",
      "Department",
      "Current Semester",
      "Academic Year",
      "Admission Date",
    ];

    const rows = students.map((s) => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
      const deptName = s.department ? s.department.name : "—";
      const enrollDate = s.admissionDate ? formatIndiaDate(s.admissionDate) : "—";
      return [
        csvCell(name),
        csvCell(s.rollNumber),
        csvCell(s.program),
        csvCell(deptName),
        csvCell(s.currentSemester ?? 1),
        csvCell(s.academicYear),
        csvCell(enrollDate),
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },

  /** Export NAAC Criteria 5 (Student Placements statistics) */
  exportCriteria5CSV: async (academicYear: string, departmentId?: string): Promise<string> => {
    const scopedStudentIds = departmentId
      ? await StudentProfileModel.find({ department: departmentId }).distinct("_id")
      : undefined;
    const placements = await StudentPlacementProfileModel.find({
      placementOutcomeVerified: true,
      joiningDate: academicYearRange(academicYear),
      ...(scopedStudentIds ? { studentProfileId: { $in: scopedStudentIds } } : {}),
    })
      .populate<{ studentId: IPopulatedUser }>("studentId", "name email")
      .lean();

    const headers = [
      "Student Name",
      "Roll Number",
      "Company Name",
      "Package (LPA)",
      "Offer Date",
      "Designation",
    ];

    const rows = placements.map((p) => {
      const studentName = p.name || p.studentId?.name || "—";
      const offerDateStr = p.joiningDate ? formatIndiaDate(p.joiningDate) : "—";
      return [
        csvCell(studentName),
        csvCell(p.rollNumber),
        csvCell(p.placedCompany),
        csvCell(p.placedPackage || 0),
        csvCell(offerDateStr),
        csvCell(p.placedRole),
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },

  /** Export NBA Student Performance metrics */
  exportNbaPerformanceCSV: async (academicYear: string, departmentId?: string): Promise<string> => {
    const students = await StudentProfileModel.find({
      status: StudentStatus.ACTIVE,
      academicYear,
      ...(departmentId ? { department: departmentId } : {}),
    })
      .populate<{ department: IPopulatedDepartment }>("department", "name")
      .lean();

    const headers = [
      "Student Name",
      "Roll Number",
      "Department",
      "CGPA",
      "Total Backlogs",
      "Lateral Entry Benefit",
    ];

    const rows = students.map((s) => {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
      const deptName = s.department ? s.department.name : "—";
      return [
        csvCell(name),
        csvCell(s.rollNumber),
        csvCell(deptName),
        csvCell(s.currentCgpa || 0),
        csvCell(s.totalBacklogs || 0),
        csvCell(s.activeLateralEntryBenefits ? "Yes" : "No"),
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },
};
