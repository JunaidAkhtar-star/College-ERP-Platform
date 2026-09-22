/**
 * Dashboard Service
 * Provides role-based aggregate statistics for the ERP dashboard.
 * Each method returns data relevant to a specific actor.
 */
import createError from "http-errors";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import { FeeRecordModel, FeePaymentStatus } from "../models/fee.model";
import { StudentAttendanceSummaryModel, AttendanceRecordModel } from "../models/attendance.model";
import {
  ExamScheduleModel,
  ExamStatus,
  RecheckRequestModel,
  SemesterResultModel,
  StudentMarksModel,
} from "../models/examination.model";
import { LeaveRequestModel } from "../models/leave.model";
import { LeaveBalanceModel } from "../models/leave.model";
import { PlacementDriveModel } from "../models/placement.model";
import {
  PlacementApplicationModel,
  PlacementApplicationStatus,
} from "../models/placement-application.model";
import { StudentPlacementProfileModel } from "../models/student-placement-profile.model";
import { BookModel, BookIssueModel } from "../models/library.model";
import { EventModel } from "../models/event.model";
import { NoticeModel } from "../models/notice.model";
import { NotificationAudience, NotificationModel } from "../models/notification.model";
import { PayslipModel } from "../models/payroll.model";
import { EmploymentStatus, HrEmployeeModel } from "../models/hr.model";
import { ScholarshipModel, ScholarshipSchemeModel } from "../models/scholarship.model";
import { COPOAttainmentModel, IQACAuditModel, IQACFeedbackModel } from "../models/iqac.model";
import { NaacEvidenceModel, NbaReportModel } from "../models/naac-nba.model";
import { MeetingModel } from "../models/meeting.model";
import { ApplicationStatus } from "../models/admission-application.model";
import { TimetableModel } from "../models/timetable.model";
import { CourseProgressModel } from "../models/course-progress.model";
import { FacultyWorkloadModel } from "../models/faculty-workload.model";
import { AuditLogModel } from "../models/audit-log.model";
import { SubjectModel } from "../models/subject.model";
import { AcademicCalendarModel } from "../models/academic-calendar.model";
import { AccountsTransactionModel } from "../models/accounts.model";
import { BankStatementLineModel, FinanceBudgetModel } from "../models/finance-control.model";
import { FacultyAttendanceModel } from "../models/faculty-attendance.model";
import { LessonPlanModel } from "../models/lesson-plan.model";
import { AssignmentModel } from "../models/assignment.model";
import { ClassOperationModel } from "../models/class-operation.model";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { SystemRole } from "../constants/roles";
import {
  HostelAllocationModel,
  HostelComplaintModel,
  HostelFeeModel,
  HostelRoomModel,
  HostelVisitorModel,
} from "../models/hostel.model";

// Specialist Dashboard Models
import { StoreItemModel, StoreRequestModel, StoreStockMovementModel } from "../models/store.model";
import {
  ProcurementGoodsReceiptModel,
  ProcurementPurchaseOrderModel,
} from "../models/procure-to-pay.model";
import {
  BusRouteModel,
  TransportAllocationModel,
  DriverModel,
  TransportFeeModel,
  TransportTrackingSessionModel,
} from "../models/transport.model";
import { ResearchProjectModel, RndPublicationModel } from "../models/research-development.model";
import { ClubModel } from "../models/club.model";
import { IicActivityModel, InnovationProjectModel } from "../models/iic.model";
import { RecruitmentActivityModel, RecruitmentLeadModel } from "../models/recruitment-crm.model";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { SupportTicketModel } from "../models/platform-customer-operations.model";
import { DisciplineIncidentModel } from "../models/discipline.model";
import { CurriculumModel } from "../models/curriculum.model";
import { SectionModel } from "../models/section.model";
import { buildCommonStaffSections } from "./dashboard/common-staff-sections.service";

const now = () => new Date();

export const dashboardService = {
  /**
   * Super Admin / Principal — institution-wide overview (rich payload powering
   * the new admin dashboard template: top stats, schedules, attendance, fees,
   * earnings/expenses trends, leave requests, notices, performance, todo).
   */
  getAdminDashboard: async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      totalUsers,
      totalStudents,
      activeStudents,
      totalFaculty,
      activeFaculty,
      totalStaff,
      activeStaff,
      totalSubjects,
      activeSubjects,
      activeAdmissions,
      pendingAdmissions,
      totalRevenueAgg,
      dueRevenueAgg,
      activeEvents,
      activeNotices,
      upcomingMeetings,
    ] = await Promise.all([
      UserModel.countDocuments({ status: "active" }),
      StudentProfileModel.countDocuments({}),
      StudentProfileModel.countDocuments({ status: "active" } as unknown as Parameters<
        typeof StudentProfileModel.countDocuments
      >[0]),
      FacultyProfileModel.countDocuments({}),
      FacultyProfileModel.countDocuments({ status: "active" } as unknown as Parameters<
        typeof FacultyProfileModel.countDocuments
      >[0]),
      HrEmployeeModel.countDocuments({}),
      HrEmployeeModel.countDocuments({ employmentStatus: "active" } as unknown as Parameters<
        typeof HrEmployeeModel.countDocuments
      >[0]),
      SubjectModel.countDocuments({}),
      SubjectModel.countDocuments({ isActive: true }),
      AdmissionApplicationModel.countDocuments({
        status: { $in: ["submitted", "under_review", "shortlisted"] },
      } as unknown as Parameters<typeof AdmissionApplicationModel.countDocuments>[0]),
      AdmissionApplicationModel.countDocuments({ status: "submitted" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      FeeRecordModel.aggregate([
        // Collections are ledger amounts, not invoice states. A partially paid
        // invoice still contributes real cash received.
        { $match: { totalPaid: { $gt: 0 }, status: { $ne: FeePaymentStatus.REFUNDED } } },
        { $group: { _id: null, total: { $sum: "$totalPaid" } } },
      ]),
      FeeRecordModel.aggregate([
        { $match: { status: { $in: ["Pending", "Partial", "Overdue"] } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$balanceDue" },
            studentsCount: { $addToSet: "$studentId" },
          },
        },
      ]),
      EventModel.countDocuments({ isPublished: true, endDate: { $gte: now() } }),
      NoticeModel.countDocuments({
        isPublished: true,
        $or: [{ expiryDate: { $gte: now() } }, { expiryDate: null }],
      }),
      MeetingModel.countDocuments({
        status: { $in: ["scheduled", "ongoing"] },
        scheduledAt: { $gte: now() },
      }),
    ]);

    // ── Schedules: current academic calendar events (this & next month) ──────
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 2, 0, 23, 59, 59);
    const quartersBack = 8;
    const fcStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - quartersBack * 3, 1);
    const trendStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 6, 1);

    const [
      userBreakdown,
      currentCalendar,
      upcomingEvents,
      studentAttToday,
      facultyAttToday,
      perfBuckets,
      leaveRequests,
      notices,
      feesByQuarter,
      accountsTrend,
      topSubjects,
      studentActivity,
      bestPerformerAgg,
      starStudentAgg,
      fineCollectedAgg,
      pendingLeaveCount,
      pendingAdmissionCount,
      pendingMeetingCount,
      pendingNoticeCount,
      recentAdmissions,
    ] = await Promise.all([
      UserModel.aggregate([
        { $match: { status: "active" } },
        { $unwind: "$roles" },
        { $group: { _id: "$roles", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AcademicCalendarModel.findOne({ isPublished: true }).sort({ semesterStartDate: -1 }).lean(),
      EventModel.find({
        isPublished: true,
        endDate: { $gte: now() },
      } as unknown as Parameters<typeof EventModel.find>[0])
        .sort({ startDate: 1 })
        .limit(5)
        .select("title startDate endDate venue")
        .lean(),
      AttendanceRecordModel.aggregate([
        { $match: { date: { $gte: todayStart, $lt: todayEnd } } },
        { $unwind: "$entries" },
        { $group: { _id: "$entries.status", count: { $sum: 1 } } },
      ]),
      FacultyAttendanceModel.aggregate([
        { $match: { date: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: null,
            top: { $sum: { $cond: [{ $gte: ["$cgpa", 8.5] }, 1, 0] } },
            average: {
              $sum: {
                $cond: [{ $and: [{ $gte: ["$cgpa", 6] }, { $lt: ["$cgpa", 8.5] }] }, 1, 0],
              },
            },
            belowAverage: { $sum: { $cond: [{ $lt: ["$cgpa", 6] }, 1, 0] } },
          },
        },
      ]),
      LeaveRequestModel.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({ path: "employeeId", select: "name avatar roles" })
        .select("employeeId leaveType fromDate toDate createdAt reason")
        .lean(),
      NoticeModel.find({
        isPublished: true,
        $or: [{ expiryDate: { $gte: now() } }, { expiryDate: null }],
      } as unknown as Parameters<typeof NoticeModel.find>[0])
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(6)
        .select("title noticeType priority publishedAt createdAt")
        .lean(),
      FeeRecordModel.aggregate([
        { $match: { updatedAt: { $gte: fcStart } } },
        {
          $group: {
            _id: {
              year: { $year: "$updatedAt" },
              quarter: { $ceil: { $divide: [{ $month: "$updatedAt" }, 3] } },
            },
            collected: { $sum: "$totalPaid" },
            total: { $sum: "$totalAmount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.quarter": 1 } },
      ]),
      AccountsTransactionModel.aggregate([
        { $match: { date: { $gte: trendStart } } },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              type: "$transactionType",
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      CourseProgressModel.aggregate([
        {
          $group: {
            _id: "$subjectId",
            avgCompletion: { $avg: "$completionPercentage" },
          },
        },
        { $sort: { avgCompletion: -1 } },
        { $limit: 7 },
        {
          $lookup: {
            from: "subjects",
            localField: "_id",
            foreignField: "_id",
            as: "subject",
          },
        },
        { $unwind: { path: "$subject", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ["$subject.name", "Subject"] },
            shortName: "$subject.shortName",
            completion: { $round: ["$avgCompletion", 0] },
          },
        },
      ]),
      EventModel.find({ status: "approved" } as unknown as Parameters<typeof EventModel.find>[0])
        .sort({ startDate: -1 })
        .limit(5)
        .select("title startDate venue eventType")
        .lean(),
      FacultyWorkloadModel.aggregate([
        { $sort: { totalWeeklyTeachingHours: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "facultyId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ["$user.name", "Faculty"] },
            designation: { $literal: "Faculty" },
            avatar: "$user.avatar",
            weeklyHours: "$totalWeeklyTeachingHours",
          },
        },
      ]),
      StudentAttendanceSummaryModel.aggregate([
        { $sort: { percentage: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "studentprofiles",
            localField: "studentId",
            foreignField: "userId",
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "studentId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ["$user.name", "Student"] },
            avatar: "$user.avatar",
            semester: "$profile.currentSemester",
            rollNumber: "$rollNumber",
            percentage: 1,
          },
        },
      ]),
      FeeRecordModel.aggregate([{ $group: { _id: null, total: { $sum: "$lateFee" } } }]),
      LeaveRequestModel.countDocuments({ status: "pending" }),
      AdmissionApplicationModel.countDocuments({ status: "submitted" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      MeetingModel.countDocuments({
        status: "scheduled",
        scheduledAt: { $gte: todayStart, $lt: todayEnd },
      }),
      NoticeModel.countDocuments({ isPublished: false }),
      AdmissionApplicationModel.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("applicantName program status createdAt applicationNumber")
        .lean(),
    ]);
    const schedules =
      (currentCalendar?.events ?? [])
        .filter((e) => new Date(e.startDate) >= monthStart && new Date(e.startDate) <= monthEnd)
        .map((e) => ({
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          category: e.category,
        }))
        .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
        .slice(0, 10) ?? [];

    const studentAtt = { present: 0, absent: 0, late: 0, emergency: 0 };
    for (const r of studentAttToday) {
      if (r._id === "P" || r._id === "OD") studentAtt.present += r.count;
      else if (r._id === "A") studentAtt.absent += r.count;
      else if (r._id === "L") studentAtt.late += r.count;
      else if (r._id === "M") studentAtt.emergency += r.count;
    }
    const studentAttTotal =
      studentAtt.present + studentAtt.absent + studentAtt.late + studentAtt.emergency;
    const studentAttPct = studentAttTotal
      ? Math.round((studentAtt.present / studentAttTotal) * 1000) / 10
      : 0;

    const teacherAtt = { present: 0, absent: 0, late: 0, emergency: 0 };
    for (const r of facultyAttToday) {
      if (r._id === "present") teacherAtt.present += r.count;
      else if (r._id === "absent") teacherAtt.absent += r.count;
      else if (r._id === "late") teacherAtt.late += r.count;
      else if (r._id === "on_leave" || r._id === "half_day") teacherAtt.emergency += r.count;
    }
    const teacherAttTotal =
      teacherAtt.present + teacherAtt.absent + teacherAtt.late + teacherAtt.emergency;
    const teacherAttPct = teacherAttTotal
      ? Math.round((teacherAtt.present / teacherAttTotal) * 1000) / 10
      : 0;

    const attendance = {
      students: { ...studentAtt, total: studentAttTotal, percentage: studentAttPct },
      teachers: { ...teacherAtt, total: teacherAttTotal, percentage: teacherAttPct },
    };

    const performance = perfBuckets[0] ?? { top: 0, average: 0, belowAverage: 0 };

    const feesCollection = feesByQuarter.map((q) => ({
      label: `Q${q._id.quarter}:${q._id.year}`,
      collected: q.collected ?? 0,
      total: q.total ?? 0,
    }));

    const monthLabel = (y: number, m: number) =>
      `${new Date(y, m - 1).toLocaleString("en-US", { month: "short" })} ${String(y).slice(2)}`;
    const earningsTrend: { label: string; value: number }[] = [];
    const expensesTrend: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getFullYear(), todayStart.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const lbl = monthLabel(y, m);
      const inc =
        accountsTrend.find((t) => t._id.year === y && t._id.month === m && t._id.type === "income")
          ?.total ?? 0;
      const exp =
        accountsTrend.find((t) => t._id.year === y && t._id.month === m && t._id.type === "expense")
          ?.total ?? 0;
      earningsTrend.push({ label: lbl, value: inc });
      expensesTrend.push({ label: lbl, value: exp });
    }
    const totalEarnings = earningsTrend.reduce((s, p) => s + p.value, 0);
    const totalExpenses = expensesTrend.reduce((s, p) => s + p.value, 0);

    const totalFeesCollected = totalRevenueAgg[0]?.total ?? 0;
    const totalOutstanding = dueRevenueAgg[0]?.total ?? 0;
    const studentsNotPaidCount = dueRevenueAgg[0]?.studentsCount?.length ?? 0;
    const fineCollected = fineCollectedAgg[0]?.total ?? 0;

    const todo = [
      {
        label: "Approve pending leave requests",
        count: pendingLeaveCount,
        status: pendingLeaveCount > 0 ? "yet_to_start" : "completed",
        link: "leave",
      },
      {
        label: "Review new admission applications",
        count: pendingAdmissionCount,
        status: pendingAdmissionCount > 0 ? "in_progress" : "completed",
        link: "admission",
      },
      {
        label: "Attend today's meetings",
        count: pendingMeetingCount,
        status: pendingMeetingCount > 0 ? "yet_to_start" : "completed",
        link: "meeting",
      },
      {
        label: "Publish draft notices",
        count: pendingNoticeCount,
        status: pendingNoticeCount > 0 ? "yet_to_start" : "completed",
        link: "notice",
      },
    ];

    return {
      // top stats
      totalUsers,
      totalStudents,
      activeStudents,
      inactiveStudents: Math.max(totalStudents - activeStudents, 0),
      totalFaculty,
      activeFaculty,
      inactiveFaculty: Math.max(totalFaculty - activeFaculty, 0),
      totalStaff,
      activeStaff,
      inactiveStaff: Math.max(totalStaff - activeStaff, 0),
      totalSubjects,
      activeSubjects,
      inactiveSubjects: Math.max(totalSubjects - activeSubjects, 0),
      activeAdmissions,
      pendingAdmissions,
      totalRevenue: totalFeesCollected,
      dueRevenue: totalOutstanding,
      activeEvents,
      activeNotices,
      upcomingMeetings,
      userBreakdown,
      recentAdmissions,
      // template-specific sections
      schedules,
      upcomingEvents,
      attendance,
      performance,
      leaveRequests,
      notices,
      feesCollection,
      earningsTrend,
      expensesTrend,
      totalEarnings,
      totalExpenses,
      totalFeesCollected,
      fineCollected,
      studentsNotPaidCount,
      totalOutstanding,
      topSubjects,
      studentActivity,
      bestPerformer: bestPerformerAgg[0] ?? null,
      starStudent: starStudentAgg[0] ?? null,
      todo,
    };
  },

  /** Principal — institution leadership metrics used by the supplied reference dashboard. */
  getPrincipalDashboard: async (requestedAcademicYear?: string) => {
    const base = await dashboardService.getAdminDashboard();
    const [resultYears, feeYears, examYears, marksYears] = await Promise.all([
      SemesterResultModel.distinct("academicYear", { isPublished: true }),
      FeeRecordModel.distinct("academicYear"),
      ExamScheduleModel.distinct("academicYear"),
      StudentMarksModel.distinct("academicYear"),
    ]);
    const attendanceStart = new Date();
    attendanceStart.setHours(0, 0, 0, 0);
    attendanceStart.setDate(attendanceStart.getDate() - 29);
    const academicYearStartMonth = 3;
    const currentAcademicYearStart = new Date(
      attendanceStart.getMonth() >= academicYearStartMonth
        ? attendanceStart.getFullYear()
        : attendanceStart.getFullYear() - 1,
      academicYearStartMonth,
      1,
    );
    const fallbackAcademicYear = `${currentAcademicYearStart.getFullYear()}-${String(currentAcademicYearStart.getFullYear() + 1).slice(-2)}`;
    const availableAcademicYears = [
      ...new Set([fallbackAcademicYear, ...resultYears, ...feeYears, ...examYears, ...marksYears]),
    ]
      .filter(
        (year): year is string => typeof year === "string" && /^\d{4}-(?:\d{2}|\d{4})$/.test(year),
      )
      .sort((left, right) => right.localeCompare(left));
    const selectedAcademicYear =
      requestedAcademicYear && availableAcademicYears.includes(requestedAcademicYear)
        ? requestedAcademicYear
        : fallbackAcademicYear;
    const selectedStartYear = Number(selectedAcademicYear.slice(0, 4));
    const selectedSessionStart = new Date(selectedStartYear, academicYearStartMonth, 1);
    const selectedSessionEnd = new Date(selectedStartYear + 1, academicYearStartMonth, 1);
    const [
      departmentEnrollment,
      examinationSummary,
      disciplineSummary,
      attendanceTrend,
      academicPerformance,
      departmentAttendance,
      departmentResults,
      enrollmentByMonth,
      topPerformingStudents,
      subjectPerformance,
      departmentFaculty,
      departmentFees,
      attendanceByMonth,
      departmentAttendanceByMonth,
      totalClasses,
    ] = await Promise.all([
      StudentProfileModel.aggregate([
        { $match: { status: StudentStatus.ACTIVE } },
        {
          $group: {
            _id: "$department",
            students: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "department",
          },
        },
        { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            departmentId: "$_id",
            name: { $ifNull: ["$department.name", "Unassigned"] },
            code: "$department.code",
            students: 1,
          },
        },
        { $sort: { students: -1 } },
        { $limit: 6 },
      ]),
      Promise.all([
        ExamScheduleModel.countDocuments({
          status: ExamStatus.COMPLETED,
          academicYear: selectedAcademicYear,
        } as unknown as Parameters<typeof ExamScheduleModel.countDocuments>[0]),
        SemesterResultModel.countDocuments({
          isPublished: true,
          academicYear: selectedAcademicYear,
        }),
        StudentMarksModel.countDocuments({
          verifiedBy: null,
          academicYear: selectedAcademicYear,
        }),
      ]),
      DisciplineIncidentModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AttendanceRecordModel.aggregate([
        { $match: { date: { $gte: attendanceStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            present: { $sum: "$totalPresent" },
            total: { $sum: "$totalStrength" },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] },
                null,
              ],
            },
          },
        },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true, academicYear: selectedAcademicYear } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  averageCgpa: { $avg: "$cgpa" },
                  passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
                  failed: { $sum: { $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0] } },
                  withheld: { $sum: { $cond: [{ $eq: ["$result", "WITHHELD"] }, 1, 0] } },
                },
              },
            ],
            grades: [
              { $unwind: "$subjectResults" },
              { $group: { _id: "$subjectResults.gradeLetter", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),
      AttendanceRecordModel.aggregate([
        { $match: { date: { $gte: selectedSessionStart, $lt: selectedSessionEnd } } },
        {
          $group: {
            _id: "$departmentId",
            present: { $sum: "$totalPresent" },
            total: { $sum: "$totalStrength" },
          },
        },
        {
          $project: {
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] },
                null,
              ],
            },
          },
        },
      ]),
      SemesterResultModel.aggregate([
        {
          $match: {
            isPublished: true,
            academicYear: selectedAcademicYear,
            departmentId: { $ne: null },
          },
        },
        {
          $group: {
            _id: { departmentId: "$departmentId", academicYear: "$academicYear" },
            averageCgpa: { $avg: "$cgpa" },
            passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            averageCgpa: { $round: ["$averageCgpa", 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ["$passed", "$total"] }, 100] }, 1],
            },
          },
        },
      ]),
      StudentProfileModel.aggregate([
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            value: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true, academicYear: selectedAcademicYear } },
        { $sort: { cgpa: -1, sgpa: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "studentId",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            studentId: 1,
            name: { $ifNull: ["$student.name", "Student"] },
            avatar: "$student.avatar",
            rollNumber: 1,
            program: 1,
            semester: 1,
            cgpa: 1,
            academicYear: 1,
            subjectScores: {
              $map: {
                input: "$subjectResults",
                as: "subject",
                in: "$$subject.totalMarks",
              },
            },
          },
        },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true, academicYear: selectedAcademicYear } },
        { $unwind: "$subjectResults" },
        {
          $group: {
            _id: {
              academicYear: "$academicYear",
              name: "$subjectResults.subjectName",
            },
            averageScore: { $avg: "$subjectResults.totalMarks" },
          },
        },
        { $sort: { averageScore: -1 } },
        { $limit: 6 },
        {
          $project: {
            _id: 0,
            academicYear: "$_id.academicYear",
            name: "$_id.name",
            value: { $round: ["$averageScore", 1] },
          },
        },
      ]),
      FacultyProfileModel.aggregate([{ $group: { _id: "$department", teachers: { $sum: 1 } } }]),
      FeeRecordModel.aggregate([
        { $match: { academicYear: selectedAcademicYear } },
        {
          $group: {
            _id: { departmentId: "$departmentId", academicYear: "$academicYear" },
            collected: { $sum: "$totalPaid" },
            pending: { $sum: "$balanceDue" },
          },
        },
      ]),
      AttendanceRecordModel.aggregate([
        { $match: { date: { $gte: selectedSessionStart, $lt: selectedSessionEnd } } },
        {
          $group: {
            _id: { year: { $year: "$date" }, month: { $month: "$date" } },
            present: { $sum: "$totalPresent" },
            absent: { $sum: "$totalAbsent" },
            total: { $sum: "$totalStrength" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      AttendanceRecordModel.aggregate([
        {
          $match: {
            departmentId: { $ne: null },
            date: { $gte: selectedSessionStart, $lt: selectedSessionEnd },
          },
        },
        {
          $group: {
            _id: {
              departmentId: "$departmentId",
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            present: { $sum: "$totalPresent" },
            total: { $sum: "$totalStrength" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            departmentId: "$_id.departmentId",
            year: "$_id.year",
            month: "$_id.month",
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] },
                null,
              ],
            },
          },
        },
      ]),
      SectionModel.countDocuments({}),
    ]);
    const resultFacet = academicPerformance[0];
    const resultSummary = resultFacet?.summary?.[0] ?? null;
    const departmentPerformance = departmentEnrollment.map((department) => {
      const attendance = departmentAttendance.find(
        (item) => String(item._id) === String(department.departmentId),
      );
      const results = departmentResults.find(
        (item) =>
          String(item._id.departmentId) === String(department.departmentId) &&
          item._id.academicYear === selectedAcademicYear,
      );
      return {
        ...department,
        teachers:
          departmentFaculty.find((item) => String(item._id) === String(department.departmentId))
            ?.teachers ?? 0,
        feeCollected:
          departmentFees.find(
            (item) =>
              String(item._id.departmentId) === String(department.departmentId) &&
              item._id.academicYear === selectedAcademicYear,
          )?.collected ?? 0,
        pendingFees:
          departmentFees.find(
            (item) =>
              String(item._id.departmentId) === String(department.departmentId) &&
              item._id.academicYear === selectedAcademicYear,
          )?.pending ?? 0,
        attendancePercentage: attendance?.percentage ?? null,
        averageCgpa: results?.averageCgpa ?? null,
        passPercentage: results?.passPercentage ?? null,
      };
    });
    return {
      ...base,
      departmentPerformance,
      enrollmentTrend: enrollmentByMonth.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        value: item.value,
      })),
      currentAcademicYearStart: selectedSessionStart.toISOString(),
      selectedAcademicYear,
      availableAcademicYears: availableAcademicYears.length
        ? availableAcademicYears
        : [fallbackAcademicYear],
      totalClasses,
      attendanceSessionSummary: attendanceByMonth.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        present: item.present,
        absent: item.absent,
        total: item.total,
      })),
      departmentAttendanceTrend: departmentAttendanceByMonth,
      topPerformingStudents,
      subjectPerformance,
      departmentSessionResults: departmentResults.map((item) => ({
        departmentId: item._id.departmentId,
        academicYear: item._id.academicYear,
        averageCgpa: item.averageCgpa,
        passPercentage: item.passPercentage,
      })),
      departmentSessionFees: departmentFees.map((item) => ({
        departmentId: item._id.departmentId,
        academicYear: item._id.academicYear,
        collected: item.collected,
        pending: item.pending,
      })),
      attendanceTrend,
      academicPerformance: resultSummary
        ? {
            averageCgpa:
              typeof resultSummary.averageCgpa !== "number"
                ? null
                : Math.round(resultSummary.averageCgpa * 100) / 100,
            passed: resultSummary.passed,
            failed: resultSummary.failed,
            withheld: resultSummary.withheld,
            gradeDistribution: (resultFacet?.grades ?? []).map(
              (grade: { _id: string | null; count: number }) => ({
                name: grade._id || "Ungraded",
                value: grade.count,
              }),
            ),
          }
        : null,
      examinationSummary: {
        examsConducted: examinationSummary[0],
        resultsDeclared: examinationSummary[1],
        pendingEvaluations: examinationSummary[2],
      },
      disciplineSummary: disciplineSummary.map((item) => ({
        name: item._id,
        value: item.count,
      })),
    };
  },

  /**
   * HOD — department-specific stats.
   */
  getHodDashboard: async (departmentId: string | undefined, userId: string) => {
    if (!departmentId) throw createError(403, "Department ownership is required for HOD dashboard");
    const departmentObjectId = new mongoose.Types.ObjectId(departmentId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const dayName = todayStart.toLocaleDateString("en-US", { weekday: "long" });
    const common = await buildCommonStaffSections(userId);
    const [
      department,
      facultyCount,
      studentCount,
      pendingLeaves,
      upcomingEvents,
      scheduledMeetings,
    ] = await Promise.all([
      DepartmentModel.findById(departmentObjectId).select("name code").lean(),
      FacultyProfileModel.countDocuments({ department: departmentObjectId }),
      StudentProfileModel.countDocuments({
        department: departmentObjectId,
        status: StudentStatus.ACTIVE,
      }),
      LeaveRequestModel.countDocuments({ departmentId: departmentObjectId, status: "pending" }),
      EventModel.find({
        departmentId: departmentObjectId,
        status: "approved",
        startDate: { $gte: now() },
      })
        .sort({ startDate: 1 })
        .limit(5)
        .select("title startDate endDate venue")
        .lean(),
      MeetingModel.find({
        department: departmentObjectId,
        status: { $in: ["scheduled", "ongoing"] },
        scheduledAt: { $gte: now() },
      })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .select("title meetingType agenda scheduledAt mode venue meetingLink")
        .lean(),
    ]);

    const attendanceTrend = await AttendanceRecordModel.aggregate([
      {
        $match: {
          departmentId: departmentObjectId,
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          totalStrength: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          avgPresent: {
            $avg: { $divide: ["$totalPresent", "$totalStrength"] },
          },
        },
      },
      { $project: { avgPresent: { $round: [{ $multiply: ["$avgPresent", 100] }, 1] } } },
      { $sort: { _id: 1 } },
    ]);

    const [sectionStrength, academicPerformance] = await Promise.all([
      StudentProfileModel.aggregate([
        { $match: { department: departmentObjectId, status: StudentStatus.ACTIVE } },
        {
          $group: {
            _id: {
              program: "$program",
              semester: "$currentSemester",
              section: "$section",
            },
            studentCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.program": 1, "_id.semester": 1, "_id.section": 1 } },
      ]),
      SemesterResultModel.aggregate([
        { $match: { departmentId: departmentObjectId, isPublished: true } },
        {
          $group: {
            _id: { semester: "$semester", academicYear: "$academicYear" },
            averageSgpa: { $avg: "$sgpa" },
            passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            averageSgpa: { $round: ["$averageSgpa", 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ["$passed", "$total"] }, 100] }, 1],
            },
          },
        },
        { $sort: { "_id.academicYear": 1, "_id.semester": 1 } },
        { $limit: 8 },
      ]),
    ]);

    // Course completion per subject in this department
    const courseCompletion = await CourseProgressModel.aggregate([
      { $match: { departmentId: departmentObjectId } },
      {
        $group: {
          _id: null,
          avgCompletion: { $avg: "$completionPercentage" },
          totalSubjects: { $sum: 1 },
          completedSubjects: { $sum: { $cond: ["$isComplete", 1, 0] } },
          behindSchedule: { $sum: { $cond: [{ $lt: ["$completionPercentage", 50] }, 1, 0] } },
        },
      },
    ]);

    // Faculty workload in this department
    const workloadStats = await FacultyWorkloadModel.aggregate([
      { $match: { departmentId: departmentObjectId } },
      {
        $group: {
          _id: null,
          avgWeeklyHours: { $avg: "$totalWeeklyTeachingHours" },
          maxWeeklyHours: { $max: "$totalWeeklyTeachingHours" },
          overloadedFaculty: {
            $sum: { $cond: [{ $gt: ["$totalWeeklyTeachingHours", 20] }, 1, 0] },
          },
        },
      },
    ]);

    const activeTimetables = await TimetableModel.find({
      isActive: true,
      isApproved: true,
      $or: [{ departmentId: departmentObjectId }, { branchDepartmentIds: departmentObjectId }],
      $and: [
        {
          $or: [
            { effectiveFrom: { $exists: false } },
            { effectiveFrom: null },
            { effectiveFrom: { $lte: todayEnd } },
          ],
        },
        {
          $or: [
            { effectiveTo: { $exists: false } },
            { effectiveTo: null },
            { effectiveTo: { $gte: todayStart } },
          ],
        },
      ],
    })
      .select(
        "academicYear semesterType program semester section branches branchDepartmentIds slots substituteLog",
      )
      .lean();

    const todayClasses = activeTimetables
      .flatMap((timetable) =>
        timetable.slots
          .filter((slot) => slot.day === dayName && (slot.slotKind ?? "teaching") === "teaching")
          .filter((slot) => {
            const scopedIds = [slot.branchDepartmentId, ...(slot.branchDepartmentIds ?? [])]
              .filter(Boolean)
              .map(String);
            return !scopedIds.length || scopedIds.includes(departmentId);
          })
          .map((slot) => ({
            timetableId: String(timetable._id),
            slotId: slot._id ? String(slot._id) : undefined,
            subjectId: slot.subjectId ? String(slot.subjectId) : undefined,
            periodNumber: slot.periodNo,
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            facultyName: slot.facultyName,
            roomNo: slot.roomNo,
            startTime: slot.startTime,
            endTime: slot.endTime,
            program: timetable.program,
            semester: timetable.semester,
            section: timetable.section,
            classType: slot.classType,
            isCombined: Boolean(slot.isCombined),
          })),
      )
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    const [
      attendanceRecordsToday,
      facultyAttendanceToday,
      extraClassesToday,
      lessonPlanStatus,
      studentRisk,
      sectionAttendance,
      subjectProgress,
      upcomingExams,
    ] = await Promise.all([
      AttendanceRecordModel.find({
        departmentId: departmentObjectId,
        date: { $gte: todayStart, $lte: todayEnd },
      })
        .select("timetableId timetableSlotId subjectId periodNumber totalPresent totalStrength")
        .lean(),
      FacultyAttendanceModel.aggregate([
        {
          $match: { departmentId: departmentObjectId, date: { $gte: todayStart, $lte: todayEnd } },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ClassOperationModel.find({
        branchDepartmentIds: departmentObjectId,
        date: { $gte: todayStart, $lte: todayEnd },
        status: "scheduled",
      })
        .select("subjectCode subjectName facultyName roomNo startTime endTime reason")
        .sort({ startTime: 1 })
        .lean(),
      LessonPlanModel.aggregate([
        { $match: { departmentId: departmentObjectId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      AttendanceRecordModel.aggregate([
        { $match: { departmentId: departmentObjectId, date: { $gte: thirtyDaysAgo } } },
        { $unwind: "$entries" },
        {
          $group: {
            _id: "$entries.studentId",
            rollNumber: { $last: "$entries.rollNumber" },
            attended: {
              $sum: { $cond: [{ $in: ["$entries.status", ["P", "L", "OD"]] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
        {
          $addFields: {
            attendancePercentage: { $multiply: [{ $divide: ["$attended", "$total"] }, 100] },
          },
        },
        { $match: { attendancePercentage: { $lt: 75 } } },
        { $sort: { attendancePercentage: 1 } },
        { $limit: 8 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "studentprofiles",
            localField: "_id",
            foreignField: "userId",
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            studentId: { $toString: { $ifNull: ["$profile._id", "$_id"] } },
            name: { $ifNull: ["$user.name", "$rollNumber"] },
            rollNumber: 1,
            attendancePercentage: { $round: ["$attendancePercentage", 1] },
            missedClasses: { $subtract: ["$total", "$attended"] },
          },
        },
      ]),
      AttendanceRecordModel.aggregate([
        {
          $match: {
            departmentId: departmentObjectId,
            date: { $gte: thirtyDaysAgo },
            totalStrength: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: { branch: "$branch", semester: "$semester", section: "$section" },
            present: { $sum: "$totalPresent" },
            strength: { $sum: "$totalStrength" },
          },
        },
        {
          $addFields: {
            percentage: {
              $round: [{ $multiply: [{ $divide: ["$present", "$strength"] }, 100] }, 1],
            },
          },
        },
        { $sort: { percentage: 1 } },
        { $limit: 8 },
      ]),
      CourseProgressModel.find({ departmentId: departmentObjectId })
        .select(
          "subjectCode subjectName program semester section completionPercentage totalPlanedClasses totalConductedClasses",
        )
        .sort({ completionPercentage: 1 })
        .limit(8)
        .lean(),
      ExamScheduleModel.aggregate([
        {
          $match: {
            departmentId: departmentObjectId,
            status: { $in: [ExamStatus.SCHEDULED, ExamStatus.ONGOING] },
          },
        },
        { $unwind: "$subjects" },
        { $match: { "subjects.examDate": { $gte: todayStart } } },
        { $sort: { "subjects.examDate": 1 } },
        { $limit: 6 },
        {
          $project: {
            _id: 0,
            title: 1,
            examType: 1,
            program: 1,
            semester: 1,
            subjectCode: "$subjects.subjectCode",
            subjectName: "$subjects.subjectName",
            examDate: "$subjects.examDate",
            startTime: "$subjects.startTime",
            venue: "$subjects.venue",
          },
        },
      ]),
    ]);

    const facultyAttendance = Object.fromEntries(
      facultyAttendanceToday.map((row) => [String(row._id), Number(row.count)]),
    );
    const lessonPlans = Object.fromEntries(
      lessonPlanStatus.map((row) => [String(row._id), Number(row.count)]),
    );
    const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
    const endedClasses = todayClasses.filter(({ endTime }) => {
      const [hours = 0, minutes = 0] = endTime.split(":").map(Number);
      return hours * 60 + minutes < currentMinute;
    });
    const attendanceRecordedToday = endedClasses.filter((classItem) =>
      attendanceRecordsToday.some(
        (record) =>
          (classItem.slotId && String(record.timetableSlotId ?? "") === classItem.slotId) ||
          (String(record.timetableId ?? "") === classItem.timetableId &&
            String(record.subjectId ?? "") === String(classItem.subjectId ?? "") &&
            Number(record.periodNumber) === Number(classItem.periodNumber)),
      ),
    ).length;
    const todayAttendanceTotal = attendanceRecordsToday.reduce(
      (total, record) => total + Number(record.totalStrength ?? 0),
      0,
    );
    const studentAttendanceToday = todayAttendanceTotal
      ? Math.round(
          (attendanceRecordsToday.reduce(
            (total, record) => total + Number(record.totalPresent ?? 0),
            0,
          ) /
            todayAttendanceTotal) *
            1000,
        ) / 10
      : null;
    const substitutionsToday = activeTimetables.reduce(
      (count, timetable) =>
        count +
        (timetable.substituteLog ?? []).filter(
          (entry) =>
            (entry.status ?? "active") === "active" &&
            new Date(entry.date) >= todayStart &&
            new Date(entry.date) <= todayEnd,
        ).length,
      0,
    );
    const behindSchedule = subjectProgress.filter(
      (progress) => Number(progress.completionPercentage ?? 0) < 50,
    ).length;

    return {
      ...common,
      department: department ? { name: department.name, code: department.code } : null,
      generatedAt: new Date(),
      academicContext: activeTimetables[0]
        ? {
            academicYear: activeTimetables[0].academicYear,
            semesterType: activeTimetables[0].semesterType,
          }
        : null,
      facultyCount,
      studentCount,
      pendingLeaves,
      upcomingEvents,
      scheduledMeetings,
      attendanceTrend,
      courseCompletion: courseCompletion[0] ?? null,
      workloadStats: workloadStats[0] ?? null,
      operations: {
        scheduledClassesToday: todayClasses.length,
        attendanceRecordedToday,
        attendancePendingToday: Math.max(0, endedClasses.length - attendanceRecordedToday),
        substitutionsToday,
        extraClassesToday: extraClassesToday.length,
        facultyAbsentToday:
          Number(facultyAttendance["absent"] ?? 0) + Number(facultyAttendance["on_leave"] ?? 0),
        studentAttendanceToday,
      },
      todayClasses,
      extraClassesToday,
      lessonPlans: {
        draft: Number(lessonPlans["draft"] ?? 0),
        submitted: Number(lessonPlans["submitted"] ?? 0),
        approved: Number(lessonPlans["approved"] ?? 0),
        rejected: Number(lessonPlans["rejected"] ?? 0),
      },
      studentRisk,
      sectionAttendance,
      sectionStrength,
      academicPerformance,
      subjectProgress,
      upcomingExams,
      attentionSummary: {
        attendanceShortage: studentRisk.length,
        subjectsBehind: behindSchedule,
        pendingLessonPlans: Number(lessonPlans["submitted"] ?? 0),
        pendingLeaves,
        uncoveredAttendance: Math.max(0, endedClasses.length - attendanceRecordedToday),
        facultyAbsent:
          Number(facultyAttendance["absent"] ?? 0) + Number(facultyAttendance["on_leave"] ?? 0),
      },
    };
  },

  /**
   * Faculty — personal teaching dashboard.
   */
  getFacultyDashboard: async (facultyUserId: string) => {
    const common = await buildCommonStaffSections(facultyUserId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [facultyProfile, myPendingLeaves, upcomingExams, myMeetings] = await Promise.all([
      FacultyProfileModel.findOne({ userId: facultyUserId })
        .select("designation departmentId qualifications dateOfJoining gender")
        .lean(),
      LeaveRequestModel.countDocuments({ employeeId: facultyUserId, status: "pending" }),
      ExamScheduleModel.find({ examDate: { $gte: now() } })
        .sort({ examDate: 1 })
        .limit(5)
        .select("examTitle examType examDate venue")
        .lean(),
      MeetingModel.find({
        invitees: facultyUserId,
        status: { $in: ["scheduled", "ongoing"] },
        scheduledAt: { $gte: now() },
      })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .select("title agenda scheduledAt mode venue meetingLink conductedBy")
        .populate("conductedBy", "name")
        .lean(),
    ]);

    // ── Today's class (from active timetable, filtered to faculty) ───────────
    const todayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][new Date().getDay()] as string;
    const facultyTimetables = await TimetableModel.find({
      isActive: true,
      isApproved: true,
      "slots.facultyId": facultyUserId,
    })
      .select("program semester section departmentId branchDepartmentIds slots")
      .lean();
    const facultySlots = facultyTimetables.flatMap((timetable) =>
      timetable.slots
        .filter(
          (slot) =>
            String(slot.facultyId ?? "") === String(facultyUserId) &&
            Boolean(slot.subjectId) &&
            slot.slotKind !== "break" &&
            slot.slotKind !== "activity",
        )
        .map((slot) => ({
          ...slot,
          timetableId: timetable._id,
          program: timetable.program,
          semester: timetable.semester,
          section: timetable.section,
        })),
    );
    const todaySlots = facultySlots
      .filter((slot) => slot.day === todayName)
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const parseHM = (t?: string) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
      return h * 60 + m;
    };
    const todaysClass = todaySlots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.subjectCode,
      section: (s as unknown as Record<string, string>).section ?? "",
      isPast: parseHM(s.endTime) < nowMin,
    }));
    const assignedSubjects = Array.from(
      new Map(
        facultySlots.map((slot) => [
          String(slot.subjectId),
          {
            subjectId: String(slot.subjectId),
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            program: slot.program,
            semester: slot.semester,
            section: slot.section,
          },
        ]),
      ).values(),
    );
    const weeklyTeachingMinutes = facultySlots.reduce(
      (total, slot) => total + Math.max(0, parseHM(slot.endTime) - parseHM(slot.startTime)),
      0,
    );
    const teachingLoadByDay = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ].map((day) => {
      const daySlots = facultySlots.filter((slot) => slot.day === day);
      return {
        day: day.slice(0, 3),
        classes: daySlots.length,
        hours: Number(
          (
            daySlots.reduce(
              (total, slot) => total + Math.max(0, parseHM(slot.endTime) - parseHM(slot.startTime)),
              0,
            ) / 60
          ).toFixed(1),
        ),
      };
    });
    const attendanceToday = await AttendanceRecordModel.find({
      facultyId: facultyUserId,
      date: { $gte: todayStart, $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
    })
      .select("timetableSlotId subjectId periodNumber totalPresent totalStrength")
      .lean();

    // ── Course completion summary (syllabus donut) ───────────────────────────
    const courseProgress = await CourseProgressModel.find({ facultyId: facultyUserId })
      .sort({ completionPercentage: 1 })
      .limit(20)
      .select(
        "subjectId subjectCode subjectName completionPercentage isComplete semester section sectionId program academicYear",
      )
      .lean();
    const avgCompletion =
      courseProgress.length > 0
        ? Math.round(
            courseProgress.reduce((s, c) => s + (c.completionPercentage ?? 0), 0) /
              courseProgress.length,
          )
        : 0;
    const syllabusProgress = {
      completed: avgCompletion,
      pending: Math.max(100 - avgCompletion, 0),
    };

    // ── Last 7 days attendance (faculty's own check-in) ──────────────────────
    const myAttendance = await FacultyAttendanceModel.find({
      facultyId: facultyUserId,
      date: { $gte: sevenDaysAgo, $lte: todayStart },
    })
      .select("date status")
      .lean();
    const last7DaysAttendance: { day: string; date: string; status: string }[] = [];
    let present = 0;
    let absent = 0;
    let halfday = 0;
    let late = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const rec = myAttendance.find((m) => {
        const md = new Date(m.date);
        return (
          md.getDate() === d.getDate() &&
          md.getMonth() === d.getMonth() &&
          md.getFullYear() === d.getFullYear()
        );
      });
      const status = rec?.status ?? "none";
      last7DaysAttendance.push({
        day: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()],
        date: d.toISOString(),
        status,
      });
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "half_day") halfday++;
      else if (status === "late") late++;
    }
    const attendanceSummary = {
      workingDays: present + absent + halfday + late,
      present,
      absent,
      halfday,
      late,
      donut: { present, late, halfDay: halfday, absent },
    };

    // ── Best performing sections (top course-completion entries) ─────────────
    const bestPerformers = courseProgress
      .slice()
      .sort((a, b) => (b.completionPercentage ?? 0) - (a.completionPercentage ?? 0))
      .slice(0, 3)
      .map((c) => ({
        label: `${c.subjectCode ?? c.subjectName}${c.section ? `, ${c.section}` : ""}`,
        percent: Math.round(c.completionPercentage ?? 0),
      }));

    // ── Student support: lowest attendance across the faculty's sections ────
    const sections = courseProgress.map((c) => c.section).filter(Boolean);
    const semesters = courseProgress.map((c) => c.semester).filter(Boolean);
    const studentProgressRaw = await StudentAttendanceSummaryModel.aggregate([
      ...(sections.length > 0
        ? [{ $match: { section: { $in: sections }, semester: { $in: semesters } } }]
        : []),
      { $sort: { percentage: 1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$user.name", "Student"] },
          avatar: "$user.avatar",
          section: 1,
          semester: 1,
          percentage: 1,
        },
      },
    ]);
    const studentProgress = studentProgressRaw.map((s) => ({
      name: s.name,
      avatar: s.avatar,
      subLabel: `${s.semester ?? ""}, ${s.section ?? ""}`.replace(/^,\s*|,\s*$/g, ""),
      percent: Math.round(s.percentage ?? 0),
    }));

    // ── Lesson plans ─────────────────────────────────────────────────────────
    const lessonPlansRaw = await LessonPlanModel.find({ facultyId: facultyUserId })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("subjectName section unitPlans totalPlannedClasses")
      .lean();
    const lessonPlans = lessonPlansRaw.map((lp) => {
      const completed = (lp.unitPlans ?? []).reduce((sum, u) => sum + (u.isComplete ? 1 : 0), 0);
      const total = (lp.unitPlans ?? []).length || 1;
      const currentUnit =
        (lp.unitPlans ?? []).find((u) => !u.isComplete) ?? (lp.unitPlans ?? [])[0];
      return {
        section: lp.section ? `Class ${lp.section}` : lp.subjectName,
        title: currentUnit?.unitTitle ?? lp.subjectName,
        percent: Math.round((completed / total) * 100),
      };
    });

    // ── Recent published marks, restricted to this faculty's assignments ────
    const assignedSectionIds = Array.from(
      new Set(courseProgress.map((course) => String(course.sectionId)).filter(Boolean)),
    );
    const assignedSubjectCodes = new Set(
      courseProgress.map((course) => course.subjectCode).filter(Boolean),
    );
    const sectionLabels = new Map(
      courseProgress.map((course) => [String(course.sectionId), course.section]),
    );
    const publishedResults =
      assignedSectionIds.length > 0 && assignedSubjectCodes.size > 0
        ? await SemesterResultModel.find({
            isPublished: true,
            sectionId: { $in: assignedSectionIds },
            "subjectResults.subjectCode": { $in: Array.from(assignedSubjectCodes) },
          })
            .sort({ publishedAt: -1, updatedAt: -1 })
            .limit(20)
            .populate("studentId", "name avatar")
            .select("studentId rollNumber semester sectionId subjectResults cgpa publishedAt")
            .lean()
        : [];
    const studentMarks = publishedResults
      .flatMap((result) => {
        const student = result.studentId as unknown as { name?: string; avatar?: string };
        return result.subjectResults
          .filter((subject) => assignedSubjectCodes.has(subject.subjectCode))
          .map((subject) => ({
            rollNumber: result.rollNumber,
            name: student?.name,
            avatar: student?.avatar ?? null,
            class: `Semester ${result.semester}`,
            section: result.sectionId
              ? (sectionLabels.get(String(result.sectionId)) ?? null)
              : null,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            marks: subject.totalMarks,
            cgpa: result.cgpa,
            status: subject.isPassed ? ("Pass" as const) : ("Fail" as const),
          }));
      })
      .slice(0, 8);

    // ── Assignment grading workload and recent submissions ──────────────────
    const facultyAssignments = await AssignmentModel.find({
      facultyId: facultyUserId,
      isActive: true,
    } as unknown as Parameters<typeof AssignmentModel.find>[0])
      .sort({ dueDate: 1, updatedAt: -1 })
      .limit(20)
      .populate("submissions.studentId", "name avatar studentId")
      .select(
        "title subjectCode program semester section dueDate maxMarks status submissions totalSubmissions",
      )
      .lean();
    const assignmentSummary = facultyAssignments.reduce(
      (summary, assignment) => {
        summary.totalAssigned += assignment.submissions.length;
        assignment.submissions.forEach((submission) => {
          if (submission.marks === undefined || submission.marks === null) summary.pending += 1;
          else summary.graded += 1;
        });
        return summary;
      },
      { totalAssigned: 0, graded: 0, pending: 0 },
    );
    const recentSubmissions = facultyAssignments
      .flatMap((assignment) =>
        assignment.submissions.map((submission) => {
          const student = submission.studentId as unknown as {
            name?: string;
            avatar?: string;
            studentId?: string;
          };
          return {
            assignmentId: assignment._id,
            assignmentTitle: assignment.title,
            subjectCode: assignment.subjectCode,
            classLabel: `${assignment.program} · Sem ${assignment.semester} · ${assignment.section}`,
            studentName: student?.name,
            studentAvatar: student?.avatar ?? null,
            rollNumber: student?.studentId ?? null,
            submittedAt: submission.submittedAt,
            isLate: submission.isLate,
            isGraded: submission.marks !== undefined && submission.marks !== null,
            marks: submission.marks ?? null,
            maxMarks: assignment.maxMarks,
          };
        }),
      )
      .sort(
        (left, right) =>
          new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
      )
      .slice(0, 8);
    // A faculty member's roster comes from the approved timetable, not from
    // whether that class happens to have an assignment. This keeps the KPI
    // accurate for newly assigned classes and subjects without homework.
    const assignedClassFilters = Array.from(
      new Map(
        facultySlots.map((slot) => [
          `${slot.program}-${slot.semester}-${slot.section}`,
          {
            program: slot.program,
            currentSemester: slot.semester,
            section: slot.section,
            status: StudentStatus.ACTIVE,
          },
        ]),
      ).values(),
    );
    const assignedStudentCount = assignedClassFilters.length
      ? await StudentProfileModel.countDocuments({ $or: assignedClassFilters })
      : 0;

    return {
      ...common,
      profileSummary: {
        ...common.profileSummary,
        designation: facultyProfile?.designation,
        gender: facultyProfile?.gender,
        subtitle: courseProgress
          .slice(0, 3)
          .map((c) => `${c.semester ?? ""}-${c.section ?? ""}`.replace(/^-|-$/g, ""))
          .filter(Boolean)
          .join(", "),
        subjectLabel: courseProgress[0]?.subjectName ?? null,
      },
      myPendingLeaves,
      upcomingExams,
      activeNotices: common.notices.length,
      myMeetings,
      todaysClass,
      todaySlots,
      assignedSubjects,
      weeklyTeachingSlots: facultySlots.length,
      weeklyTeachingMinutes,
      teachingLoadByDay,
      attendanceToday,
      myCourseCompletion: courseProgress,
      syllabusProgress,
      last7DaysAttendance,
      attendanceSummary,
      bestPerformers,
      studentProgress,
      lessonPlans,
      studentMarks,
      assignmentSummary,
      recentSubmissions,
      assignedStudentCount,
    };
  },

  /**
   * Student — personal academic dashboard.
   */
  getStudentDashboard: async (studentUserId: string) => {
    const profile = await StudentProfileModel.findOne({ userId: studentUserId }).lean();
    if (!profile) return { profile: null };

    const user = await UserModel.findById(studentUserId).select("name avatar email").lean();

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(startOfToday);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [
      feePending,
      feeRecordsWithPayments,
      upcomingExams,
      activeNotices,
      upcomingMeetings,
      attendanceSummaryRaw,
      recentAttendance,
      weekAttendance,
      todayTimetable,
      schedules,
      workload,
      assignmentsRaw,
      leaveRequests,
      courseProgress,
      publishedResults,
      attendanceHistory,
      libraryBooks,
      unreadNotifications,
    ] = await Promise.all([
      FeeRecordModel.find({
        studentId: studentUserId,
        status: {
          $in: [FeePaymentStatus.PENDING, FeePaymentStatus.PARTIAL, FeePaymentStatus.OVERDUE],
        },
      } as unknown as Parameters<typeof FeeRecordModel.find>[0])
        .select("netDue totalPaid balanceDue dueDate status feeItems")
        .lean(),
      FeeRecordModel.find({
        studentId: studentUserId,
        "transactions.0": { $exists: true },
      } as unknown as Parameters<typeof FeeRecordModel.find>[0])
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("invoiceNumber semester academicYear transactions")
        .lean(),
      ExamScheduleModel.find({
        examDate: { $gte: now() },
        program: profile.program,
        semester: profile.currentSemester,
      } as unknown as Parameters<typeof ExamScheduleModel.find>[0])
        .sort({ examDate: 1 })
        .limit(6)
        .select("examTitle examType examDate venue subject")
        .lean(),
      NoticeModel.find({
        isPublished: true,
        $or: [{ expiresAt: { $gte: now() } }, { expiresAt: null }],
        targetAudience: { $in: ["all", "students"] },
      })
        .sort({ publishedAt: -1 })
        .limit(6)
        .select("title noticeType priority publishedAt")
        .lean(),
      MeetingModel.find({
        meetingType: "student",
        status: { $in: ["scheduled", "ongoing"] },
        scheduledAt: { $gte: now() },
        $or: [{ targetDepartments: profile.department }, { targetDepartments: { $size: 0 } }],
      })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .select("title agenda scheduledAt mode venue meetingLink")
        .lean(),
      StudentAttendanceSummaryModel.find({
        studentId: profile.userId,
        semester: profile.currentSemester,
        academicYear: profile.academicYear,
      })
        .select("subjectId subjectCode percentage totalClasses attended isShortage")
        .lean(),
      AttendanceRecordModel.find({
        "entries.studentId": studentUserId,
        date: { $gte: sevenDaysAgo },
      } as unknown as Parameters<typeof AttendanceRecordModel.find>[0])
        .select("date entries")
        .lean(),
      AttendanceRecordModel.find({
        "entries.studentId": studentUserId,
        date: { $gte: weekStart },
      } as unknown as Parameters<typeof AttendanceRecordModel.find>[0])
        .select("entries")
        .lean(),
      TimetableModel.findOne({
        departmentId: profile.department,
        program: profile.program,
        semester: profile.currentSemester,
        isActive: true,
      }).lean(),
      AcademicCalendarModel.find({
        $or: [
          { semesterStartDate: { $gte: startOfToday } },
          { semesterEndDate: { $gte: startOfToday } },
        ],
      })
        .sort({ semesterStartDate: 1 })
        .limit(10)
        .lean(),
      FacultyWorkloadModel.find({
        "teachingAssignments.program": profile.program,
        "teachingAssignments.semester": profile.currentSemester,
        "teachingAssignments.section": profile.section,
      } as unknown as Parameters<typeof FacultyWorkloadModel.find>[0])
        .populate("facultyId", "name avatar email")
        .select("facultyId teachingAssignments")
        .lean(),
      AssignmentModel.find({
        program: profile.program,
        semester: profile.currentSemester,
        section: profile.section,
        isActive: true,
      } as unknown as Parameters<typeof AssignmentModel.find>[0])
        .populate("facultyId", "name avatar")
        .sort({ dueDate: 1 })
        .limit(12)
        .select("title subjectCode dueDate facultyId submissions maxMarks")
        .lean(),
      LeaveRequestModel.find({ employeeId: studentUserId })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("leaveType fromDate toDate status createdAt")
        .lean(),
      CourseProgressModel.find({
        program: profile.program,
        semester: profile.currentSemester,
        departmentId: profile.department,
      } as unknown as Parameters<typeof CourseProgressModel.find>[0])
        .select("subjectCode subjectName completionPercentage")
        .lean(),
      SemesterResultModel.find({ studentId: studentUserId, isPublished: true })
        .sort({ semester: 1, publishedAt: 1 })
        .select("semester academicYear subjectResults sgpa cgpa result publishedAt")
        .lean(),
      StudentAttendanceSummaryModel.find({ studentId: studentUserId })
        .select("semester academicYear percentage")
        .lean(),
      BookIssueModel.countDocuments({
        memberId: studentUserId,
        status: { $in: ["issued", "overdue"] },
      }),
      NotificationModel.countDocuments({
        isActive: true,
        isSent: true,
        $and: [
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: now() } },
            ],
          },
          {
            $or: [
              { audience: NotificationAudience.ALL },
              { audience: NotificationAudience.STUDENTS },
              { targetUserIds: studentUserId },
            ],
          },
          { readBy: { $not: { $elemMatch: { userId: studentUserId } } } },
        ],
      }),
    ]);

    // ── Profile summary ──
    const latestResult = publishedResults.at(-1);
    const resultStatus =
      latestResult?.result === "PASS"
        ? "Pass"
        : latestResult?.result === "FAIL"
          ? "Fail"
          : latestResult?.result === "WITHHELD"
            ? "Withheld"
            : "Pending";
    const examLabel = latestResult ? `Sem ${latestResult.semester} Result` : "Awaiting Result";

    const profileSummary = {
      name: user?.name,
      avatar: user?.avatar ?? null,
      email: user?.email ?? null,
      rollNumber: profile.rollNumber,
      program: profile.program,
      currentSemester: profile.currentSemester,
      academicYear: profile.academicYear,
      classLabel: `Sem ${profile.currentSemester}${profile.section ? `, ${profile.section}` : ""}`,
      examLabel,
      resultStatus,
    };

    // ── Last 7 days attendance ──
    const dayMap = new Map<string, string>();
    recentAttendance.forEach((r) => {
      const entry = r.entries.find(
        (e) => String((e as { studentId: unknown }).studentId) === studentUserId,
      );
      if (!entry) return;
      const key = new Date(r.date).toISOString().slice(0, 10);
      const cur = dayMap.get(key);
      // Priority: P > L > M > A > OD > H
      const priority: Record<string, number> = { P: 5, L: 4, M: 3, A: 2, OD: 1, H: 0 };
      if (!cur || (priority[entry.status] ?? 0) > (priority[cur] ?? 0)) {
        dayMap.set(key, entry.status);
      }
    });
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
    const last7DaysAttendance: Array<{
      dayLabel: string;
      date: number;
      status: "P" | "A" | "H" | "L" | "O";
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const s = dayMap.get(key);
      const mapped: "P" | "A" | "H" | "L" | "O" =
        s === "P" ? "P" : s === "A" ? "A" : s === "L" ? "L" : s === "M" ? "H" : "O";
      last7DaysAttendance.push({
        dayLabel: dayLabels[d.getDay()],
        date: d.getDate(),
        status: mapped,
      });
    }

    // ── Weekly attendance counts ──
    let wPresent = 0;
    let wAbsent = 0;
    let wLate = 0;
    let wHalf = 0;
    weekAttendance.forEach((r) => {
      const entry = r.entries.find(
        (e) => String((e as { studentId: unknown }).studentId) === studentUserId,
      );
      if (!entry) return;
      if (entry.status === "P") wPresent++;
      else if (entry.status === "A") wAbsent++;
      else if (entry.status === "L") wLate++;
      else if (entry.status === "M") wHalf++;
    });
    const workingDays = wPresent + wAbsent + wLate + wHalf;
    const attendanceSummary = {
      workingDays,
      present: wPresent,
      absent: wAbsent,
      halfday: wHalf,
      late: wLate,
      subjectWise: attendanceSummaryRaw,
      donut: {
        present: wPresent,
        absent: wAbsent,
        late: wLate,
        emergency: wHalf,
        total: workingDays,
        percentage: workingDays > 0 ? Math.round((wPresent / workingDays) * 100) : 0,
      },
    };

    // ── Today's classes ──
    const todayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][new Date().getDay()] as string;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const todayClasses = todayTimetable
      ? todayTimetable.slots
          .filter((s) => s.day === todayName)
          .map((s) => {
            const [eh, em] = (s.endTime ?? "00:00").split(":").map(Number);
            const [sh, sm] = (s.startTime ?? "00:00").split(":").map(Number);
            const endMin = eh * 60 + em;
            const startMin = sh * 60 + sm;
            const status: "Completed" | "Inprogress" | "Upcoming" =
              endMin < nowMin ? "Completed" : startMin <= nowMin ? "Inprogress" : "Upcoming";
            return {
              subjectName: s.subjectName,
              subjectCode: s.subjectCode,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.roomNo,
              facultyName: s.facultyName,
              facultyId: s.facultyId,
              status,
              isPast: endMin < nowMin,
            };
          })
      : [];

    // ── Class faculties (from faculty workload) ──
    type PopulatedFaculty = {
      _id: unknown;
      name?: string;
      avatar?: string;
      email?: string;
    };
    const facultyMap = new Map<
      string,
      { _id: unknown; name: string; avatar: string | null; email: string | null; subject: string }
    >();
    workload.forEach((w) => {
      const f = w.facultyId as unknown as PopulatedFaculty;
      if (!f?._id || !f.name) return;
      const subj = (w.teachingAssignments ?? []).find(
        (t) =>
          t.program === profile.program &&
          t.semester === profile.currentSemester &&
          t.section === profile.section,
      );
      if (!subj) return;
      const key = String(f._id);
      if (!facultyMap.has(key)) {
        facultyMap.set(key, {
          _id: f._id,
          name: f.name,
          avatar: f.avatar ?? null,
          email: f.email ?? null,
          subject: subj.subjectName,
        });
      }
    });
    const classFaculties = Array.from(facultyMap.values()).slice(0, 12);

    // ── Homeworks ──
    const upcomingAssignments = assignmentsRaw.filter(
      (a) => new Date(a.dueDate).getTime() >= startOfToday.getTime(),
    );
    const homeworks = upcomingAssignments.slice(0, 8).map((a) => {
      const sub = a.submissions?.find(
        (s) => String((s as { studentId: unknown }).studentId) === studentUserId,
      );
      const f = a.facultyId as unknown as PopulatedFaculty;
      const progress = sub ? (sub.marks !== null && sub.marks !== undefined ? 100 : 60) : 0;
      const status: "submitted" | "graded" | "pending" = sub
        ? sub.marks !== null && sub.marks !== undefined
          ? "graded"
          : "submitted"
        : "pending";
      return {
        _id: a._id,
        subjectCode: a.subjectCode,
        title: a.title,
        dueDate: a.dueDate,
        facultyName: f?.name ?? "",
        facultyAvatar: f?.avatar ?? null,
        progress,
        status,
      };
    });

    // ── Leave status counts ──
    const leaveStatus = {
      pending: leaveRequests.filter((l) => l.status === "pending").length,
      approved: leaveRequests.filter((l) => l.status === "approved").length,
      declined: leaveRequests.filter((l) => l.status === "rejected").length,
    };

    // ── Exam result bars from the student's latest published result ──
    const latestPublishedResult = publishedResults.at(-1);
    const examResultBars = (latestPublishedResult?.subjectResults ?? [])
      .slice(0, 8)
      .map((subject) => ({
        subject: subject.subjectCode || subject.subjectName,
        percentage: Math.round(subject.totalMarks ?? 0),
        grade: subject.gradeLetter,
        isPassed: subject.isPassed,
      }));

    // ── Syllabus progress ──
    const syllabusProgress = courseProgress.map((c) => ({
      subject: c.subjectName ?? c.subjectCode,
      percentage: Math.round(c.completionPercentage ?? 0),
    }));

    // ── Todos (derived from upcoming assignments) ──
    const todos = upcomingAssignments.slice(0, 6).map((a) => {
      const sub = a.submissions?.find(
        (s) => String((s as { studentId: unknown }).studentId) === studentUserId,
      );
      return {
        label: a.title,
        status: sub ? "completed" : "in_progress",
        dueDate: a.dueDate,
      };
    });

    // ── Performance from published results + matching semester attendance ──
    const performance = publishedResults.slice(-4).map((result) => {
      const semesterAttendance = attendanceHistory.filter(
        (summary) =>
          summary.semester === result.semester && summary.academicYear === result.academicYear,
      );
      const attendance = semesterAttendance.length
        ? Math.round(
            semesterAttendance.reduce((sum, summary) => sum + (summary.percentage ?? 0), 0) /
              semesterAttendance.length,
          )
        : null;
      return {
        label: `Sem ${result.semester}`,
        examScore: Math.round((result.sgpa ?? 0) * 10),
        attendance,
      };
    });

    // ── Fees reminder ──
    const feesReminder = feePending.map((f) => ({
      feeType: f.feeItems?.[0]?.type,
      balanceDue: f.balanceDue ?? 0,
      dueDate: f.dueDate,
      status: f.status,
    }));
    const recentFeePayments = feeRecordsWithPayments
      .flatMap((record) =>
        (record.transactions ?? []).map((transaction) => ({
          invoiceNumber: record.invoiceNumber,
          semester: record.semester,
          academicYear: record.academicYear,
          amountPaid: transaction.amountPaid,
          paymentMode: transaction.paymentMode,
          paymentDate: transaction.paymentDate,
          receiptNumber: transaction.receiptNumber,
          transactionId: transaction.transactionId,
          receiptUrl: transaction.receiptUrl,
        })),
      )
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 5);

    return {
      profileSummary,
      academicSummary: latestPublishedResult
        ? {
            semester: latestPublishedResult.semester,
            academicYear: latestPublishedResult.academicYear,
            sgpa: latestPublishedResult.sgpa,
            cgpa: latestPublishedResult.cgpa,
            result: latestPublishedResult.result,
          }
        : null,
      todayClasses,
      schedules,
      attendanceSummary,
      last7DaysAttendance,
      upcomingExams,
      upcomingMeetings,
      classFaculties,
      homeworks,
      leaveStatus,
      leaveRequests,
      examResultBars,
      feesReminder,
      recentFeePayments,
      notices: activeNotices,
      syllabusProgress,
      todos,
      performance,
      libraryBooks,
      unreadNotifications,
      recentResults: publishedResults.slice(-2),
    };
  },

  /**
   * Placement cell — placement drive statistics.
   */
  getPlacementDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      activeDrives,
      driveSummary,
      profileSummary,
      placementStatus,
      offersSummary,
      placementTrend,
      departmentPlacement,
      packageDistribution,
      topCompanies,
    ] = await Promise.all([
      PlacementDriveModel.countDocuments({
        status: { $in: ["upcoming", "ongoing"] },
      } as unknown as Parameters<typeof PlacementDriveModel.countDocuments>[0]),
      PlacementDriveModel.aggregate([
        {
          $group: {
            _id: null,
            totalDrives: { $sum: 1 },
            completedDrives: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            companies: { $addToSet: "$companyName" },
          },
        },
        {
          $project: {
            _id: 0,
            totalDrives: 1,
            completedDrives: 1,
            companiesVisited: { $size: "$companies" },
          },
        },
      ]),
      StudentPlacementProfileModel.aggregate([
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            eligibleStudents: { $sum: { $cond: ["$isEligibleForPlacement", 1, 0] } },
            placedStudents: {
              $sum: { $cond: [{ $eq: ["$eligibilityStatus", "placed"] }, 1, 0] },
            },
            highestPackage: { $max: "$placedPackage" },
            averagePackage: {
              $avg: { $cond: [{ $gt: ["$placedPackage", 0] }, "$placedPackage", null] },
            },
          },
        },
      ]),
      StudentPlacementProfileModel.aggregate([
        { $group: { _id: "$eligibilityStatus", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      PlacementApplicationModel.aggregate([
        {
          $group: {
            _id: null,
            offersMade: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["offered", "accepted", "declined", "superseded"]] },
                  1,
                  0,
                ],
              },
            },
            acceptedOffers: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
            awaitingOffers: { $sum: { $cond: [{ $eq: ["$status", "selected"] }, 1, 0] } },
          },
        },
      ]),
      PlacementApplicationModel.aggregate([
        {
          $match: {
            status: { $in: ["offered", "accepted", "declined", "superseded"] },
            offerIssuedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$offerIssuedAt" }, month: { $month: "$offerIssuedAt" } },
            offers: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
      StudentPlacementProfileModel.aggregate([
        { $match: { eligibilityStatus: "placed" } },
        {
          $group: {
            _id: "$branch",
            placed: { $sum: 1 },
            averagePackage: { $avg: "$placedPackage" },
          },
        },
        { $sort: { placed: -1 } },
      ]),
      StudentPlacementProfileModel.aggregate([
        { $match: { placedPackage: { $gt: 0 } } },
        {
          $bucket: {
            groupBy: "$placedPackage",
            boundaries: [0, 4, 6, 10, 15, 1000],
            default: "other",
            output: { students: { $sum: 1 } },
          },
        },
      ]),
      StudentPlacementProfileModel.aggregate([
        { $match: { placedCompany: { $nin: [null, ""] } } },
        {
          $group: {
            _id: "$placedCompany",
            studentsPlaced: { $sum: 1 },
            highestPackage: { $max: "$placedPackage" },
          },
        },
        { $sort: { studentsPlaced: -1, highestPackage: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const [recentDrives, upcomingDrives, awaitingOffers, recentApplications] = await Promise.all([
      PlacementDriveModel.find()
        .sort({ driveDate: -1 })
        .limit(6)
        .select("companyName jobRole package packageMax status driveDate venue academicYear")
        .lean(),
      PlacementDriveModel.find({ status: { $in: ["upcoming", "ongoing"] } })
        .sort({ driveDate: 1 })
        .limit(6)
        .select("companyName jobRole package packageMax status driveDate venue registrationEnd")
        .lean(),
      PlacementApplicationModel.find({
        status: {
          $in: [
            PlacementApplicationStatus.SHORTLISTED,
            PlacementApplicationStatus.ROUND_ONGOING,
            PlacementApplicationStatus.SELECTED,
          ],
        },
      })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate("driveId", "companyName jobRole driveDate")
        .select("studentName rollNumber branch status currentRound driveId updatedAt")
        .lean(),
      PlacementApplicationModel.find()
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate("driveId", "companyName jobRole driveDate")
        .select("studentName rollNumber branch status driveId offeredPackage updatedAt")
        .lean(),
    ]);

    const profiles = profileSummary[0] ?? {
      totalStudents: 0,
      eligibleStudents: 0,
      placedStudents: 0,
      highestPackage: 0,
      averagePackage: 0,
    };
    const drives = driveSummary[0] ?? {
      totalDrives: 0,
      completedDrives: 0,
      companiesVisited: 0,
    };
    const offers = offersSummary[0] ?? { offersMade: 0, acceptedOffers: 0, awaitingOffers: 0 };

    return {
      ...common,
      activeDrives,
      ...profiles,
      ...drives,
      ...offers,
      totalPlaced: profiles.placedStudents,
      placementStatus: placementStatus.map((status) => ({ name: status._id, value: status.count })),
      placementTrend: placementTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        offers: point.offers,
        accepted: point.accepted,
      })),
      departmentPlacement: departmentPlacement.map((department) => ({
        name: department._id,
        placed: department.placed,
        averagePackage: department.averagePackage,
      })),
      packageDistribution: packageDistribution.map((bucket) => ({
        range: String(bucket._id),
        students: bucket.students,
      })),
      topCompanies: topCompanies.map((company) => ({
        name: company._id,
        studentsPlaced: company.studentsPlaced,
        highestPackage: company.highestPackage,
      })),
      recentDrives,
      upcomingDrives,
      awaitingOffers,
      recentApplications,
    };
  },

  /**
   * Library staff — library summary.
   */
  getLibraryDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const [
      collectionSummary,
      booksIssued,
      overdueBooks,
      activeMembers,
      overdueFineSummary,
      todaysCirculation,
      categoryStats,
      circulationTrend,
      topIssuedBooks,
    ] = await Promise.all([
      BookModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            titles: { $sum: 1 },
            totalCopies: { $sum: "$totalCopies" },
            availableCopies: { $sum: "$availableCopies" },
            digitalTitles: { $sum: { $cond: ["$isDigital", 1, 0] } },
          },
        },
      ]),
      BookIssueModel.countDocuments({ status: { $in: ["issued", "overdue"] } }),
      BookIssueModel.countDocuments({
        status: { $in: ["issued", "overdue"] },
        dueDate: { $lt: now() },
      }),
      BookIssueModel.distinct("memberId", {
        issueDate: { $gte: new Date(todayStart.getFullYear(), todayStart.getMonth() - 5, 1) },
      }),
      BookIssueModel.aggregate([
        { $match: { status: "overdue" } },
        {
          $group: {
            _id: null,
            assessed: { $sum: "$fineAmount" },
            paid: { $sum: "$finePaid" },
          },
        },
      ]),
      BookIssueModel.aggregate([
        { $match: { updatedAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            issued: { $sum: { $cond: [{ $gte: ["$issueDate", todayStart] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $gte: ["$returnDate", todayStart] }, 1, 0] } },
          },
        },
      ]),
      BookModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$category",
            titles: { $sum: 1 },
            totalCopies: { $sum: "$totalCopies" },
            availableCopies: { $sum: "$availableCopies" },
          },
        },
        { $sort: { totalCopies: -1 } },
      ]),
      BookIssueModel.aggregate([
        { $match: { issueDate: { $gte: monthStart } } },
        {
          $group: {
            _id: { day: { $dayOfMonth: "$issueDate" } },
            issued: { $sum: 1 },
            returned: { $sum: { $cond: [{ $ne: ["$returnDate", null] }, 1, 0] } },
          },
        },
        { $sort: { "_id.day": 1 } },
      ]),
      BookIssueModel.aggregate([
        { $group: { _id: "$bookId", issueCount: { $sum: 1 } } },
        { $sort: { issueCount: -1 } },
        { $limit: 5 },
        { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book" } },
        { $unwind: "$book" },
        {
          $project: {
            _id: "$book._id",
            title: "$book.title",
            authors: "$book.authors",
            coverImageUrl: "$book.coverImageUrl",
            category: "$book.category",
            issueCount: 1,
          },
        },
      ]),
    ]);

    const [recentIssues, overdueRows, newArrivals] = await Promise.all([
      BookIssueModel.find({ status: { $in: ["issued", "overdue"] } })
        .sort({ issueDate: -1 })
        .limit(10)
        .select("bookId memberId issueDate dueDate status fineAmount finePaid")
        .populate("bookId", "title isbn authors shelfLocation coverImageUrl")
        .populate("memberId", "name email studentId facultyId")
        .lean(),
      BookIssueModel.find({
        status: { $in: ["issued", "overdue"] },
        dueDate: { $lt: now() },
      })
        .sort({ dueDate: 1 })
        .limit(6)
        .select("bookId memberId issueDate dueDate status fineAmount finePaid")
        .populate("bookId", "title isbn authors")
        .populate("memberId", "name email")
        .lean(),
      BookModel.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .select("title authors isbn category coverImageUrl totalCopies availableCopies createdAt")
        .lean(),
    ]);

    const collection = collectionSummary[0] ?? {
      titles: 0,
      totalCopies: 0,
      availableCopies: 0,
      digitalTitles: 0,
    };
    const fine = overdueFineSummary[0] ?? { assessed: 0, paid: 0 };

    return {
      ...common,
      totalBooks: collection.totalCopies,
      totalTitles: collection.titles,
      availableCopies: collection.availableCopies,
      digitalTitles: collection.digitalTitles,
      booksIssued,
      overdueBooks,
      activeMembers: activeMembers.length,
      overdueFineAmount: Math.max(fine.assessed - fine.paid, 0),
      todaysIssued: todaysCirculation[0]?.issued ?? 0,
      todaysReturned: todaysCirculation[0]?.returned ?? 0,
      categoryStats: categoryStats.map((category) => ({
        name: category._id,
        titles: category.titles,
        totalCopies: category.totalCopies,
        availableCopies: category.availableCopies,
      })),
      circulationTrend: circulationTrend.map((point) => ({
        label: String(point._id.day),
        issued: point.issued,
        returned: point.returned,
      })),
      topIssuedBooks,
      recentIssues,
      overdueRows,
      newArrivals,
    };
  },

  /** Hostel warden — occupancy, resident service, visitor, and collection queues. */
  getHostelWardenDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const [
      roomCapacity,
      roomTypeStats,
      hostelStats,
      activeResidents,
      newCheckIns,
      checkOuts,
      openComplaints,
      complaintStats,
      visitorsInside,
      visitorsToday,
      outstandingFees,
      feeSummary,
    ] = await Promise.all([
      HostelRoomModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            rooms: { $sum: 1 },
            capacity: { $sum: "$capacity" },
            occupied: { $sum: "$occupancy" },
          },
        },
      ]),
      HostelRoomModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$roomType",
            rooms: { $sum: 1 },
            capacity: { $sum: "$capacity" },
            occupied: { $sum: "$occupancy" },
          },
        },
        { $sort: { capacity: -1 } },
      ]),
      HostelRoomModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$hostelName",
            rooms: { $sum: 1 },
            capacity: { $sum: "$capacity" },
            occupied: { $sum: "$occupancy" },
          },
        },
        { $sort: { occupied: -1 } },
      ]),
      HostelAllocationModel.countDocuments({ status: "active" }),
      HostelAllocationModel.countDocuments({
        status: "active",
        allocationDate: { $gte: todayStart },
      }),
      HostelAllocationModel.countDocuments({
        status: { $in: ["vacated", "transferred"] },
        updatedAt: { $gte: todayStart },
      }),
      HostelComplaintModel.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      HostelComplaintModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      HostelVisitorModel.countDocuments({ checkOut: { $exists: false } }),
      HostelVisitorModel.countDocuments({ checkIn: { $gte: todayStart } }),
      HostelFeeModel.aggregate([
        { $match: { status: { $in: ["unpaid", "partial", "overdue"] } } },
        {
          $group: {
            _id: null,
            amount: { $sum: { $subtract: ["$totalDue", "$paidAmount"] } },
            records: { $sum: 1 },
          },
        },
      ]),
      HostelFeeModel.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$totalDue" },
            paidAmount: { $sum: "$paidAmount" },
            messCharges: { $sum: "$messFee" },
            otherCharges: { $sum: "$otherCharges" },
            studentsPaid: {
              $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
            },
            records: { $sum: 1 },
          },
        },
      ]),
    ]);

    const [recentComplaints, currentVisitors, recentAllocations] = await Promise.all([
      HostelComplaintModel.find({ status: { $in: ["open", "in_progress"] } })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("studentId", "name avatar")
        .select("studentId hostelName roomNo category description status createdAt")
        .lean(),
      HostelVisitorModel.find({ checkOut: { $exists: false } })
        .sort({ checkIn: -1 })
        .limit(6)
        .select("hostelName studentName roomNo visitorName relation checkIn")
        .lean(),
      HostelAllocationModel.find({ status: "active" })
        .sort({ allocationDate: -1 })
        .limit(6)
        .populate("studentId", "name avatar email")
        .populate("roomId", "hostelName blockName roomNumber roomType")
        .select("studentId roomId academicYear allocationDate monthlyFee messFee status")
        .lean(),
    ]);

    const capacity = roomCapacity[0] ?? { rooms: 0, capacity: 0, occupied: 0 };
    return {
      ...common,
      roomCount: capacity.rooms,
      totalCapacity: capacity.capacity,
      occupiedBeds: capacity.occupied,
      availableBeds: Math.max(capacity.capacity - capacity.occupied, 0),
      occupancyPercentage:
        capacity.capacity > 0 ? Math.round((capacity.occupied / capacity.capacity) * 100) : 0,
      roomTypeStats: roomTypeStats.map((type) => ({
        name: type._id,
        rooms: type.rooms,
        capacity: type.capacity,
        occupied: type.occupied,
        vacant: Math.max(type.capacity - type.occupied, 0),
      })),
      hostelStats: hostelStats.map((hostel) => ({
        name: hostel._id,
        rooms: hostel.rooms,
        capacity: hostel.capacity,
        occupied: hostel.occupied,
        vacant: Math.max(hostel.capacity - hostel.occupied, 0),
      })),
      activeResidents,
      newCheckIns,
      checkOuts,
      openComplaints,
      complaintStats: complaintStats.map((status) => ({
        name: status._id,
        value: status.count,
      })),
      visitorsInside,
      visitorsToday,
      outstandingFeeAmount: outstandingFees[0]?.amount ?? 0,
      outstandingFeeRecords: outstandingFees[0]?.records ?? 0,
      feeSummary: feeSummary[0] ?? {
        totalDue: 0,
        paidAmount: 0,
        messCharges: 0,
        otherCharges: 0,
        studentsPaid: 0,
        records: 0,
      },
      recentComplaints,
      currentVisitors,
      recentAllocations,
    };
  },

  /**
   * Parent — ward's attendance, fees, upcoming exams, recent notices.
   */
  getParentDashboard: async (parentUserId: string) => {
    const parentUser = await UserModel.findById(parentUserId)
      .select("name avatar email createdAt")
      .lean();
    if (!parentUser) return { message: "Parent account not found" };

    // Resolve linked ward(s) via guardian/parent email match on student profile
    const wardProfile = await StudentProfileModel.findOne({
      $or: [
        { "parentInfo.guardianEmail": parentUser.email },
        { "parentInfo.fatherEmail": parentUser.email },
        { "parentInfo.motherEmail": parentUser.email },
      ],
    } as unknown as Parameters<typeof StudentProfileModel.findOne>[0]).lean();

    if (!wardProfile) {
      return {
        parentSummary: {
          name: parentUser.name,
          avatar: parentUser.avatar ?? null,
          email: parentUser.email,
          parentId: `P${String(parentUser._id).slice(-6).toUpperCase()}`,
          addedOn: parentUser.createdAt,
          childName: null,
        },
        message: "No linked ward found for this parent account",
      };
    }

    const studentUserId = wardProfile.userId;
    const wardUser = await UserModel.findById(studentUserId).select("name avatar email").lean();
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const [
      feePending,
      upcomingExams,
      activeNotices,
      attendanceSummary,
      leaveBalance,
      leaveRequests,
      events,
      monthlyAttendance,
      assignmentsRaw,
    ] = await Promise.all([
      FeeRecordModel.find({
        studentId: studentUserId,
        status: {
          $in: [FeePaymentStatus.PENDING, FeePaymentStatus.PARTIAL, FeePaymentStatus.OVERDUE],
        },
      } as unknown as Parameters<typeof FeeRecordModel.find>[0])
        .select("dueDate status feeItems balanceDue")
        .lean(),
      ExamScheduleModel.find({
        examDate: { $gte: now() },
        program: wardProfile.program,
        semester: wardProfile.currentSemester,
      } as unknown as Parameters<typeof ExamScheduleModel.find>[0])
        .sort({ examDate: 1 })
        .limit(6)
        .select("examTitle examType examDate venue subject")
        .lean(),
      NoticeModel.find({
        isPublished: true,
        $or: [{ expiresAt: { $gte: now() } }, { expiresAt: null }],
        targetAudience: { $in: ["all", "parents", "students"] },
      })
        .sort({ publishedAt: -1 })
        .limit(6)
        .select("title noticeType priority publishedAt createdAt")
        .lean(),
      StudentAttendanceSummaryModel.find({
        studentId: studentUserId,
        semester: wardProfile.currentSemester,
        academicYear: wardProfile.academicYear,
      })
        .select("subjectCode percentage totalClasses attended")
        .lean(),
      LeaveBalanceModel.findOne({
        employeeId: studentUserId,
        academicYear: wardProfile.academicYear,
      } as unknown as Parameters<typeof LeaveBalanceModel.findOne>[0]).lean(),
      LeaveRequestModel.find({ employeeId: studentUserId })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("leaveType fromDate toDate status reason createdAt")
        .lean(),
      EventModel.find({
        status: "approved",
        startDate: { $gte: now() },
      } as unknown as Parameters<typeof EventModel.find>[0])
        .sort({ startDate: 1 })
        .limit(6)
        .select("title startDate endDate venue eventType bannerUrl")
        .lean(),
      AttendanceRecordModel.find({
        "entries.studentId": studentUserId,
        date: { $gte: yearStart },
      } as unknown as Parameters<typeof AttendanceRecordModel.find>[0])
        .select("date entries")
        .lean(),
      AssignmentModel.find({
        program: wardProfile.program,
        semester: wardProfile.currentSemester,
        section: wardProfile.section,
        isActive: true,
        dueDate: { $gte: now() },
      } as unknown as Parameters<typeof AssignmentModel.find>[0])
        .populate("facultyId", "name avatar")
        .sort({ dueDate: 1 })
        .limit(8)
        .select("title subjectCode dueDate facultyId submissions")
        .lean(),
    ]);

    // Monthly statistics: avg attendance (computed) + avg exam score from semester results
    type PopulatedFacultyMini = { _id: unknown; name?: string; avatar?: string };
    const monthBuckets: Record<number, { total: number; present: number }> = {};
    monthlyAttendance.forEach((r) => {
      const entry = r.entries.find(
        (e) => String((e as { studentId: unknown }).studentId) === String(studentUserId),
      );
      if (!entry) return;
      const m = new Date(r.date).getMonth();
      if (!monthBuckets[m]) monthBuckets[m] = { total: 0, present: 0 };
      monthBuckets[m].total += 1;
      if (entry.status === "P" || entry.status === "L") monthBuckets[m].present += 1;
    });
    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const semScoreByMonth = new Map<number, number>();
    (wardProfile.semesterResults ?? []).forEach((r) => {
      const month = (r.semesterNo - 1) % 12;
      semScoreByMonth.set(month, (r.sgpa ?? 0) * 10);
    });
    const statistics = monthLabels.map((label, i) => ({
      label,
      attendance:
        monthBuckets[i] && monthBuckets[i].total > 0
          ? Math.round((monthBuckets[i].present / monthBuckets[i].total) * 100)
          : 0,
      examScore: semScoreByMonth.get(i) ?? 0,
    }));

    // Exam results table — last 2 semester results
    const examResults = (wardProfile.semesterResults ?? []).slice(-6).map((r) => ({
      rollNumber: wardProfile.rollNumber,
      name: wardUser?.name,
      avatar: wardUser?.avatar ?? null,
      class: String(r.semesterNo),
      section: wardProfile.section,
      marks: r.sgpa !== null && r.sgpa !== undefined ? `${Math.round(r.sgpa * 10)}%` : "—",
      exam: r.academicYear,
      status: r.result === "pass" ? "Pass" : r.result === "fail" ? "Fail" : "—",
    }));

    // Homeworks
    const homeworks = assignmentsRaw.map((a) => {
      const f = a.facultyId as unknown as PopulatedFacultyMini;
      return {
        _id: a._id,
        subjectCode: a.subjectCode,
        title: a.title,
        dueDate: a.dueDate,
        facultyName: f?.name ?? "",
        facultyAvatar: f?.avatar ?? null,
      };
    });

    // Fees reminder
    const feesReminder = feePending.map((f) => ({
      feeType: f.feeItems?.[0]?.type,
      balanceDue: f.balanceDue ?? 0,
      dueDate: f.dueDate,
      status: f.status,
    }));

    const parentSummary = {
      name: parentUser.name,
      avatar: parentUser.avatar ?? null,
      email: parentUser.email,
      parentId: `P${String(parentUser._id).slice(-6).toUpperCase()}`,
      addedOn: parentUser.createdAt,
      childName: wardUser?.name ?? wardProfile.rollNumber,
    };

    const child = {
      name: wardUser?.name,
      avatar: wardUser?.avatar ?? null,
      rollNumber: wardProfile.rollNumber,
      program: wardProfile.program,
      currentSemester: wardProfile.currentSemester,
      academicYear: wardProfile.academicYear,
      section: wardProfile.section ?? null,
    };

    const leaveBalanceCard = {
      configured: Boolean(leaveBalance),
      medical: {
        used: leaveBalance?.sickUsed ?? 0,
        available: Math.max((leaveBalance?.sick ?? 0) - (leaveBalance?.sickUsed ?? 0), 0),
        total: leaveBalance?.sick ?? 0,
      },
      casual: {
        used: leaveBalance?.casualUsed ?? 0,
        available: Math.max((leaveBalance?.casual ?? 0) - (leaveBalance?.casualUsed ?? 0), 0),
        total: leaveBalance?.casual ?? 0,
      },
    };

    const [studentDashboard, transportAllocation] = await Promise.all([
      dashboardService.getStudentDashboard(String(studentUserId)),
      TransportAllocationModel.findOne({ studentId: studentUserId, status: "active" })
        .populate(
          "routeId",
          "routeNo routeName stops driverName driverPhone vehicleNo vehicleType gps",
        )
        .select("routeId stopName academicYear monthlyFee status")
        .lean(),
    ]);

    return {
      parentSummary,
      child,
      leaveBalance: leaveBalanceCard,
      events,
      statistics,
      leaveStatus: {
        pending: leaveRequests.filter((l) => l.status === "pending").length,
        approved: leaveRequests.filter((l) => l.status === "approved").length,
        declined: leaveRequests.filter((l) => l.status === "rejected").length,
      },
      leaveRequests,
      homeworks,
      feesReminder,
      examResults,
      attendanceSummary,
      upcomingExams,
      notices: activeNotices,
      todayClasses: studentDashboard.todayClasses,
      schedules: studentDashboard.schedules,
      performance: studentDashboard.performance,
      examResultBars: studentDashboard.examResultBars,
      academicSummary: studentDashboard.academicSummary,
      recentFeePayments: studentDashboard.recentFeePayments,
      transportAllocation,
    };
  },

  /**
   * HR Department — employee counts, pending leaves, payroll summary.
   */
  getHrDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const currentMonth = todayStart.getMonth() + 1;
    const currentYear = todayStart.getFullYear();

    const [
      totalEmployees,
      activeEmployees,
      onLeave,
      pendingLeaves,
      pendingPayslips,
      presentToday,
      newJoiners,
      recentJoiners,
      departmentStrength,
      attendanceTrend,
      leaveStatus,
      payrollSummary,
      employmentTypes,
    ] = await Promise.all([
      HrEmployeeModel.countDocuments({
        employmentStatus: { $ne: EmploymentStatus.TERMINATED },
      }),
      HrEmployeeModel.countDocuments({ employmentStatus: EmploymentStatus.ACTIVE }),
      LeaveRequestModel.countDocuments({
        status: "approved",
        fromDate: { $lt: todayEnd },
        toDate: { $gte: todayStart },
      }),
      LeaveRequestModel.countDocuments({ status: "pending" }),
      PayslipModel.countDocuments({ status: { $in: ["draft", "reviewed", "approved"] } }),
      FacultyAttendanceModel.countDocuments({
        date: { $gte: todayStart, $lt: todayEnd },
        status: { $in: ["present", "late", "half_day"] },
      }),
      HrEmployeeModel.countDocuments({
        employmentStatus: EmploymentStatus.ACTIVE,
        dateOfJoining: { $gte: monthStart, $lt: todayEnd },
      }),
      HrEmployeeModel.aggregate([
        { $match: { employmentStatus: "active" } },
        { $sort: { dateOfJoining: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "_id",
            as: "departmentRecord",
          },
        },
        {
          $project: {
            _id: 1,
            employeeId: 1,
            name: 1,
            designation: 1,
            dateOfJoining: 1,
            department: { $ifNull: [{ $first: "$departmentRecord.name" }, "Unassigned"] },
          },
        },
      ]),
      HrEmployeeModel.aggregate([
        { $match: { employmentStatus: "active" } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "departmentRecord",
          },
        },
        {
          $project: {
            _id: 0,
            name: { $ifNull: [{ $first: "$departmentRecord.name" }, "Unassigned"] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      FacultyAttendanceModel.aggregate([
        { $match: { date: { $gte: weekStart, $lt: todayEnd } } },
        {
          $group: {
            _id: { date: "$date", status: "$status" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            statuses: { $push: { status: "$_id.status", count: "$count" } },
            total: { $sum: "$count" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", statuses: 1, total: 1 } },
      ]),
      LeaveRequestModel.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: "$status", count: { $sum: 1 }, days: { $sum: "$totalDays" } } },
        { $project: { _id: 0, name: "$_id", count: 1, days: 1 } },
      ]),
      PayslipModel.aggregate([
        { $match: { month: currentMonth, year: currentYear } },
        {
          $group: {
            _id: null,
            grossPay: { $sum: "$grossPay" },
            deductions: { $sum: "$totalDeductions" },
            netPay: { $sum: "$netPay" },
            paid: { $sum: { $cond: ["$isPaid", 1, 0] } },
            total: { $sum: 1 },
          },
        },
        { $project: { _id: 0, grossPay: 1, deductions: 1, netPay: 1, paid: 1, total: 1 } },
      ]),
      HrEmployeeModel.aggregate([
        { $match: { employmentStatus: "active" } },
        { $group: { _id: "$employmentType", count: { $sum: 1 } } },
        { $project: { _id: 0, name: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const attendanceOverview = attendanceTrend.map((day) => {
      const statusCount = (status: string) =>
        day.statuses.find((item: { status: string; count: number }) => item.status === status)
          ?.count ?? 0;
      const present = statusCount("present") + statusCount("late") + statusCount("half_day");
      return {
        date: day.date,
        present,
        absent: statusCount("absent"),
        onLeave: statusCount("on_leave"),
        attendancePercentage: day.total ? Math.round((present / day.total) * 1000) / 10 : 0,
      };
    });

    return {
      ...common,
      totalEmployees,
      activeEmployees,
      presentToday,
      onLeave,
      pendingLeaves,
      pendingPayslips,
      newJoiners,
      recentJoiners,
      departmentStrength,
      attendanceOverview,
      leaveStatus,
      payrollSummary: payrollSummary[0] ?? {
        grossPay: 0,
        deductions: 0,
        netPay: 0,
        paid: 0,
        total: 0,
      },
      employmentTypes,
    };
  },

  /**
   * Accounts Department — fee collection summary, pending dues, recent transactions.
   */
  getAccountsDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const today = now();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const financialYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const financialYear = `${financialYearStart}-${String(financialYearStart + 1).slice(-2)}`;
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 1);

    const [
      totalPaid,
      totalPending,
      overdueFees,
      recentPayments,
      transactionTotals,
      monthlyCashFlow,
      categorySummary,
      recentTransactions,
      budgetSummary,
      budgetHeads,
      bankSummary,
      reconciliationStatus,
    ] = await Promise.all([
      FeeRecordModel.aggregate([
        { $match: { status: "Paid" } },
        { $group: { _id: null, total: { $sum: "$totalPaid" } } },
      ]),
      FeeRecordModel.aggregate([
        {
          $match: {
            status: {
              $in: [FeePaymentStatus.PENDING, FeePaymentStatus.PARTIAL, FeePaymentStatus.OVERDUE],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$balanceDue" } } },
      ]),
      FeeRecordModel.countDocuments({ status: FeePaymentStatus.OVERDUE } as unknown as Parameters<
        typeof FeeRecordModel.countDocuments
      >[0]),
      FeeRecordModel.find({ status: FeePaymentStatus.PAID } as unknown as Parameters<
        typeof FeeRecordModel.find
      >[0])
        .sort({ updatedAt: -1 })
        .limit(10)
        .select("studentId studentName rollNumber netDue totalPaid dueDate status")
        .lean(),
      AccountsTransactionModel.aggregate([
        { $match: { financialYear, reversedAt: { $exists: false } } },
        { $group: { _id: "$transactionType", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $project: { _id: 0, name: "$_id", total: 1, count: 1 } },
      ]),
      AccountsTransactionModel.aggregate([
        { $match: { financialYear, reversedAt: { $exists: false } } },
        {
          $group: {
            _id: { year: { $year: "$date" }, month: { $month: "$date" } },
            income: {
              $sum: { $cond: [{ $eq: ["$transactionType", "income"] }, "$amount", 0] },
            },
            expense: {
              $sum: { $cond: [{ $eq: ["$transactionType", "expense"] }, "$amount", 0] },
            },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            income: 1,
            expense: 1,
            net: { $subtract: ["$income", "$expense"] },
          },
        },
      ]),
      AccountsTransactionModel.aggregate([
        { $match: { financialYear, reversedAt: { $exists: false } } },
        {
          $group: {
            _id: { category: "$category", type: "$transactionType" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            category: "$_id.category",
            transactionType: "$_id.type",
            total: 1,
            count: 1,
          },
        },
      ]),
      AccountsTransactionModel.find({ financialYear, reversedAt: { $exists: false } })
        .sort({ date: -1, createdAt: -1 })
        .limit(8)
        .select(
          "transactionType category subCategory amount paymentMode referenceNo description date budgetHead",
        )
        .lean(),
      FinanceBudgetModel.aggregate([
        { $match: { financialYear, status: { $in: ["approved", "closed"] } } },
        {
          $group: {
            _id: null,
            approvedAmount: { $sum: "$approvedAmount" },
            encumberedAmount: { $sum: "$encumberedAmount" },
            consumedAmount: { $sum: "$consumedAmount" },
          },
        },
        { $project: { _id: 0, approvedAmount: 1, encumberedAmount: 1, consumedAmount: 1 } },
      ]),
      FinanceBudgetModel.find({ financialYear, status: { $in: ["approved", "closed"] } })
        .sort({ consumedAmount: -1 })
        .limit(8)
        .select("budgetHead approvedAmount encumberedAmount consumedAmount status")
        .lean(),
      BankStatementLineModel.aggregate([
        { $match: { transactionDate: { $gte: monthStart, $lt: monthEnd } } },
        {
          $group: {
            _id: "$bankAccountCode",
            credits: { $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", 0] } },
            debits: { $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amount", 0] } },
            lines: { $sum: 1 },
            matched: { $sum: { $cond: [{ $eq: ["$status", "matched"] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            accountCode: "$_id",
            credits: 1,
            debits: 1,
            balance: { $subtract: ["$credits", "$debits"] },
            lines: 1,
            matched: 1,
          },
        },
        { $sort: { balance: -1 } },
      ]),
      BankStatementLineModel.aggregate([
        { $match: { transactionDate: { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, name: "$_id", count: 1, amount: 1 } },
      ]),
    ]);

    const totalIncome =
      transactionTotals.find((row) => row.name === "income")?.total ?? totalPaid[0]?.total ?? 0;
    const totalExpense = transactionTotals.find((row) => row.name === "expense")?.total ?? 0;
    const budget = budgetSummary[0] ?? {
      approvedAmount: 0,
      encumberedAmount: 0,
      consumedAmount: 0,
    };

    return {
      ...common,
      financialYear,
      totalCollected: totalPaid[0]?.total ?? 0,
      totalPending: totalPending[0]?.total ?? 0,
      overdueCount: overdueFees,
      totalIncome,
      totalExpense,
      closingBalance: totalIncome - totalExpense,
      thisMonthCollection: monthlyCashFlow.at(-1)?.income ?? 0,
      recentPayments,
      transactionTotals,
      monthlyCashFlow,
      categorySummary,
      recentTransactions,
      budgetSummary: budget,
      budgetHeads,
      bankSummary,
      reconciliationStatus,
    };
  },

  /**
   * Examination Cell — upcoming exams, pending results, recheck stats.
   */
  getExaminationDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      scheduled,
      ongoing,
      completed,
      scheduleOverview,
      marksSummary,
      resultSummary,
      programResults,
      topSubjects,
      revaluationSummary,
    ] = await Promise.all([
      ExamScheduleModel.countDocuments({ status: ExamStatus.SCHEDULED } as unknown as Parameters<
        typeof ExamScheduleModel.countDocuments
      >[0]),
      ExamScheduleModel.countDocuments({ status: ExamStatus.ONGOING } as unknown as Parameters<
        typeof ExamScheduleModel.countDocuments
      >[0]),
      ExamScheduleModel.countDocuments({ status: ExamStatus.COMPLETED } as unknown as Parameters<
        typeof ExamScheduleModel.countDocuments
      >[0]),
      ExamScheduleModel.aggregate([
        { $unwind: "$subjects" },
        {
          $group: {
            _id: "$status",
            schedules: { $addToSet: "$_id" },
            subjectExams: { $sum: 1 },
          },
        },
        { $project: { _id: 1, schedules: { $size: "$schedules" }, subjectExams: 1 } },
      ]),
      StudentMarksModel.aggregate([
        {
          $group: {
            _id: null,
            totalScripts: { $sum: 1 },
            studentsAppeared: { $addToSet: "$studentId" },
            evaluated: { $sum: { $cond: [{ $ne: ["$verifiedBy", null] }, 1, 0] } },
            published: { $sum: { $cond: ["$isPublished", 1, 0] } },
            absent: { $sum: { $cond: ["$isAbsent", 1, 0] } },
            passed: { $sum: { $cond: ["$isPassed", 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalScripts: 1,
            studentsAppeared: { $size: "$studentsAppeared" },
            evaluated: 1,
            published: 1,
            absent: 1,
            passed: 1,
          },
        },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: null,
            resultsDeclared: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0] } },
            withheld: { $sum: { $cond: [{ $eq: ["$result", "WITHHELD"] }, 1, 0] } },
          },
        },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: { program: "$program", branch: "$branch" },
            students: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0] } },
          },
        },
        { $sort: { students: -1 } },
        { $limit: 8 },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true } },
        { $unwind: "$subjectResults" },
        {
          $group: {
            _id: { code: "$subjectResults.subjectCode", name: "$subjectResults.subjectName" },
            studentsAppeared: { $sum: 1 },
            passed: { $sum: { $cond: ["$subjectResults.isPassed", 1, 0] } },
            averageMarks: { $avg: "$subjectResults.totalMarks" },
          },
        },
        { $sort: { passed: -1, averageMarks: -1 } },
        { $limit: 8 },
      ]),
      RecheckRequestModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const [upcomingSchedules, recentResults, recentRevaluations] = await Promise.all([
      ExamScheduleModel.find({ status: ExamStatus.SCHEDULED } as unknown as Parameters<
        typeof ExamScheduleModel.find
      >[0])
        .sort({ "subjects.0.examDate": 1 })
        .limit(6)
        .select("title examType program branch semester section academicYear subjects status")
        .lean(),
      SemesterResultModel.find({ isPublished: true })
        .sort({ publishedAt: -1 })
        .limit(6)
        .select("program branch semester academicYear result sgpa cgpa publishedAt rollNumber")
        .lean(),
      RecheckRequestModel.find({ status: { $in: ["pending", "under_review"] } })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("studentId", "name email")
        .select(
          "studentId rollNumber subjectCode subjectName requestType status currentMarks createdAt",
        )
        .lean(),
    ]);

    const upcomingExams = upcomingSchedules
      .flatMap((schedule) =>
        schedule.subjects.map((subject) => ({
          scheduleId: schedule._id,
          title: schedule.title,
          examType: schedule.examType,
          program: schedule.program,
          branch: schedule.branch,
          semester: schedule.semester,
          section: schedule.section,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          examDate: subject.examDate,
          startTime: subject.startTime,
          endTime: subject.endTime,
          venue: subject.venue,
          maxMarks: subject.maxMarks,
        })),
      )
      .sort((a, b) => +new Date(a.examDate) - +new Date(b.examDate))
      .slice(0, 8);
    const marks = marksSummary[0] ?? {
      totalScripts: 0,
      studentsAppeared: 0,
      evaluated: 0,
      published: 0,
      absent: 0,
      passed: 0,
    };
    const results = resultSummary[0] ?? {
      resultsDeclared: 0,
      passed: 0,
      failed: 0,
      withheld: 0,
    };

    return {
      ...common,
      scheduled,
      ongoing,
      completed,
      upcomingExamCount: upcomingExams.length,
      ...marks,
      ...results,
      pendingEvaluation: Math.max(marks.totalScripts - marks.evaluated, 0),
      pendingPublication: Math.max(marks.totalScripts - marks.published, 0),
      passPercentage: results.resultsDeclared
        ? Math.round((results.passed / results.resultsDeclared) * 10000) / 100
        : 0,
      scheduleOverview: scheduleOverview.map((status) => ({
        name: status._id,
        schedules: status.schedules,
        subjectExams: status.subjectExams,
      })),
      programResults: programResults.map((program) => ({
        name: `${program._id.program} ${program._id.branch}`.trim(),
        students: program.students,
        passed: program.passed,
        failed: program.failed,
      })),
      topSubjects: topSubjects.map((subject) => ({
        code: subject._id.code,
        name: subject._id.name,
        studentsAppeared: subject.studentsAppeared,
        passed: subject.passed,
        averageMarks: subject.averageMarks,
      })),
      revaluationSummary: revaluationSummary.map((status) => ({
        name: status._id,
        value: status.count,
      })),
      upcomingExams,
      recentResults,
      recentRevaluations,
    };
  },

  /**
   * IQAC Team — feedback summary, audit status, CO-PO attainment overview.
   */
  getIqacDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      evidenceSummary,
      criteriaProgress,
      feedbackSummary,
      auditSummary,
      attainmentSummary,
      nbaSummary,
      recentEvidence,
      recentAudits,
      recentFeedback,
    ] = await Promise.all([
      NaacEvidenceModel.aggregate([
        {
          $group: {
            _id: null,
            totalMetrics: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
            revisionRequested: {
              $sum: { $cond: [{ $eq: ["$status", "revision_requested"] }, 1, 0] },
            },
            files: { $sum: { $size: { $ifNull: ["$evidenceFiles", []] } } },
            averageScore: { $avg: "$score" },
          },
        },
        {
          $project: {
            _id: 0,
            totalMetrics: 1,
            approved: 1,
            submitted: 1,
            revisionRequested: 1,
            files: 1,
            averageScore: 1,
          },
        },
      ]),
      NaacEvidenceModel.aggregate([
        {
          $group: {
            _id: "$criterion",
            metrics: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
            files: { $sum: { $size: { $ifNull: ["$evidenceFiles", []] } } },
            averageScore: { $avg: "$score" },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            criterion: "$_id",
            metrics: 1,
            approved: 1,
            submitted: 1,
            files: 1,
            averageScore: 1,
          },
        },
      ]),
      IQACFeedbackModel.aggregate([
        {
          $group: {
            _id: "$feedbackType",
            count: { $sum: 1 },
            averageScore: { $avg: "$averageScore" },
          },
        },
        { $sort: { count: -1 } },
        { $project: { _id: 0, name: "$_id", count: 1, averageScore: 1 } },
      ]),
      IQACAuditModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            averageCompliance: { $avg: "$overallCompliance" },
            findings: { $sum: { $size: { $ifNull: ["$findings", []] } } },
          },
        },
        { $project: { _id: 0, name: "$_id", count: 1, averageCompliance: 1, findings: 1 } },
      ]),
      COPOAttainmentModel.aggregate([
        { $unwind: "$coAttainments" },
        {
          $group: {
            _id: "$status",
            records: { $sum: 1 },
            averageAttainment: { $avg: "$coAttainments.finalAttainment" },
            gaps: {
              $sum: {
                $cond: [
                  { $gt: ["$coAttainments.targetLevel", "$coAttainments.finalAttainment"] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ["$_id", "draft"] },
            records: 1,
            averageAttainment: 1,
            gaps: 1,
          },
        },
      ]),
      NbaReportModel.aggregate([
        {
          $group: {
            _id: "$status",
            reports: { $sum: 1 },
            thresholdsMet: { $sum: { $cond: ["$thresholdMet", 1, 0] } },
          },
        },
        { $project: { _id: 0, name: "$_id", reports: 1, thresholdsMet: 1 } },
      ]),
      NaacEvidenceModel.find()
        .sort({ updatedAt: -1 })
        .limit(7)
        .select("criterion metricNo title academicYear status score evidenceFiles updatedAt")
        .lean(),
      IQACAuditModel.find()
        .sort({ auditDate: -1 })
        .limit(7)
        .populate("departmentId", "name code")
        .select("academicYear auditType departmentId auditDate overallCompliance status findings")
        .lean(),
      IQACFeedbackModel.find()
        .sort({ createdAt: -1 })
        .limit(7)
        .select("academicYear semesterType feedbackType averageScore isAnonymous createdAt")
        .lean(),
    ]);
    const evidence = evidenceSummary[0] ?? {
      totalMetrics: 0,
      approved: 0,
      submitted: 0,
      revisionRequested: 0,
      files: 0,
      averageScore: 0,
    };
    const pendingAudits = auditSummary
      .filter((row) => ["scheduled", "ongoing"].includes(row.name))
      .reduce((sum, row) => sum + row.count, 0);
    const totalFeedback = feedbackSummary.reduce((sum, row) => sum + row.count, 0);

    return {
      ...common,
      ...evidence,
      totalFeedback,
      pendingAudits,
      criteriaProgress,
      feedbackSummary,
      auditSummary,
      attainmentSummary,
      nbaSummary,
      recentEvidence,
      recentAudits,
      recentFeedback,
    };
  },

  /** Admission Counselor — personally assigned enquiry and follow-up pipeline. */
  getAdmissionCounselorDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const ownerId = new mongoose.Types.ObjectId(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const stages = await RecruitmentLeadModel.aggregate([
      { $match: { ownerId } },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);
    const [sourceSummary, enquiryTrend, recentLeads, upcomingFollowUps, recentActivities] =
      await Promise.all([
        RecruitmentLeadModel.aggregate([
          { $match: { ownerId } },
          { $group: { _id: "$source", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, name: "$_id", count: 1 } },
        ]),
        RecruitmentLeadModel.aggregate([
          { $match: { ownerId } },
          {
            $group: {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              enquiries: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ["$stage", "enrolled"] }, 1, 0] } },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          { $limit: 12 },
          {
            $project: { _id: 0, year: "$_id.year", month: "$_id.month", enquiries: 1, enrolled: 1 },
          },
        ]),
        RecruitmentLeadModel.find({ ownerId })
          .sort({ updatedAt: -1 })
          .limit(7)
          .populate("programInterest", "name code")
          .select("firstName lastName phone source stage score programInterest updatedAt")
          .lean(),
        RecruitmentLeadModel.find({
          ownerId,
          nextFollowUpAt: { $gte: todayStart },
          stage: { $nin: ["enrolled", "lost"] },
        })
          .sort({ nextFollowUpAt: 1 })
          .limit(7)
          .populate("programInterest", "name code")
          .select("firstName lastName phone stage nextFollowUpAt programInterest")
          .lean(),
        RecruitmentActivityModel.find({ ownerId })
          .sort({ createdAt: -1 })
          .limit(7)
          .populate("leadId", "firstName lastName stage")
          .select("leadId type subject status dueAt completedAt createdAt")
          .lean(),
      ]);
    const stageCount = (name: string) => stages.find((stage) => stage.name === name)?.count ?? 0;
    const totalEnquiries = stages.reduce((sum, stage) => sum + stage.count, 0);
    const enrolled = stageCount("enrolled");

    return {
      ...common,
      totalEnquiries,
      activeFollowUps: upcomingFollowUps.length,
      qualified: stageCount("qualified"),
      applications: stageCount("application_started") + stageCount("applied"),
      enrolled,
      lost: stageCount("lost"),
      conversionRate: totalEnquiries ? Math.round((enrolled / totalEnquiries) * 1000) / 10 : 0,
      stages,
      sourceSummary,
      enquiryTrend,
      recentLeads,
      upcomingFollowUps,
      recentActivities,
    };
  },

  /** Admission In-charge — institution-wide application and enrollment pipeline. */
  getAdmissionInchargeDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const pipelineStages = await AdmissionApplicationModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    const programWise = await AdmissionApplicationModel.aggregate([
      {
        $match: {
          status: {
            $nin: [
              ApplicationStatus.DRAFT,
              ApplicationStatus.REJECTED,
              ApplicationStatus.WITHDRAWN,
            ],
          },
        },
      },
      { $unwind: { path: "$programPreferences", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ["$programPreferences", "Unspecified"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    const [
      recentApplications,
      totalApplications,
      totalSubmitted,
      underReview,
      approved,
      enrolled,
      rejected,
      applicationTrend,
      documentStatus,
    ] = await Promise.all([
      AdmissionApplicationModel.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("candidateName programPreferences admissionType status applicationNumber createdAt")
        .lean(),
      AdmissionApplicationModel.countDocuments(),
      AdmissionApplicationModel.countDocuments({ status: ApplicationStatus.SUBMITTED }),
      AdmissionApplicationModel.countDocuments({
        status: ApplicationStatus.UNDER_REVIEW,
      }),
      AdmissionApplicationModel.countDocuments({ status: ApplicationStatus.APPROVED }),
      AdmissionApplicationModel.countDocuments({ status: ApplicationStatus.ENROLLED }),
      AdmissionApplicationModel.countDocuments({ status: ApplicationStatus.REJECTED }),
      AdmissionApplicationModel.aggregate([
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            applications: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ["$status", ApplicationStatus.APPROVED] }, 1, 0] } },
            enrolled: { $sum: { $cond: [{ $eq: ["$status", ApplicationStatus.ENROLLED] }, 1, 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            applications: 1,
            approved: 1,
            enrolled: 1,
          },
        },
      ]),
      AdmissionApplicationModel.aggregate([
        { $unwind: "$documentChecklist" },
        { $group: { _id: "$documentChecklist.status", count: { $sum: 1 } } },
        { $project: { _id: 0, name: { $ifNull: ["$_id", "pending"] }, count: 1 } },
      ]),
    ]);

    return {
      ...common,
      pipeline: {
        totalApplications,
        totalSubmitted,
        underReview,
        approved,
        enrolled,
        rejected,
        conversionRate: totalApplications
          ? Math.round((enrolled / totalApplications) * 1000) / 10
          : 0,
      },
      pipelineStages,
      programWise,
      recentApplications,
      applicationTrend,
      documentStatus,
    };
  },

  /**
   * Super Admin — ERP health monitoring, audit log summary, user analytics.
   */
  getSuperAdminDashboard: async () => {
    const institution = await dashboardService.getAdminDashboard();

    // Audit log summary — last 24 h activity by module
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditSummary = await AuditLogModel.aggregate([
      { $match: { createdAt: { $gte: since24h } } },
      { $group: { _id: "$module", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const recentAuditLogs = await AuditLogModel.find({ createdAt: { $gte: since24h } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("action module userName userRole description createdAt")
      .lean();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const expiryThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [tenantStatus, recentTenants, revenue, ticketStatus, expiringSoon, platformTrend] =
      await Promise.all([
        TenantModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        TenantModel.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name tenantId status billingStatus createdAt")
          .lean(),
        PlatformBillingRecordModel.aggregate([
          { $match: { status: "paid", paidAt: { $gte: monthStart } } },
          { $group: { _id: null, amountInPaise: { $sum: "$amountInPaise" } } },
        ]),
        SupportTicketModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        TenantModel.countDocuments({
          subscriptionExpiresAt: { $gte: now(), $lte: expiryThreshold },
        }),
        TenantModel.aggregate([
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              organizations: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
      ]);
    const tenantCount = tenantStatus.reduce((sum, item) => sum + item.count, 0);
    const tenantCountByStatus = (status: string) =>
      tenantStatus.find((item) => item._id === status)?.count ?? 0;
    const ticketCountByStatus = (status: string) =>
      ticketStatus.find((item) => item._id === status)?.count ?? 0;
    const activeTenants = tenantCountByStatus(TenantStatus.ACTIVE);
    const expiredTenants = tenantCountByStatus(TenantStatus.EXPIRED);

    return {
      ...institution,
      totalOrganizations: tenantCount,
      totalInstitutes: tenantCount,
      activeInstitutes: activeTenants,
      inactiveInstitutes: Math.max(tenantCount - activeTenants, 0),
      totalSubscriptions: tenantCount,
      activeSubscriptions: activeTenants,
      expiredSubscriptions: expiredTenants,
      expiringSoon,
      totalRevenue: (revenue[0]?.amountInPaise ?? 0) / 100,
      platformTrend: platformTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        organizations: point.organizations,
      })),
      recentAdmissions: recentTenants.map((tenant) => ({
        _id: tenant._id,
        applicantName: tenant.name,
        applicationNumber: tenant.tenantId,
        program: tenant.billingStatus,
        status: tenant.status,
        createdAt: tenant.createdAt,
      })),
      openTickets: ticketCountByStatus("open") + ticketCountByStatus("triaged"),
      inProgressTickets:
        ticketCountByStatus("in_progress") + ticketCountByStatus("waiting_customer"),
      resolvedTickets: ticketCountByStatus("resolved"),
      closedTickets: ticketCountByStatus("closed"),
      auditSummary,
      recentAuditLogs,
    };
  },

  /**
   * Dean Academic — college-wide academic health: course completion, attendance averages, department comparison.
   */
  getDeanAcademicDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      totalStudents,
      totalFaculty,
      upcomingExams,
      activeNotices,
      upcomingMeetings,
      totalPrograms,
      totalCourses,
      totalSections,
      researchProjects,
      publications,
    ] = await Promise.all([
      StudentProfileModel.countDocuments(),
      FacultyProfileModel.countDocuments(),
      ExamScheduleModel.countDocuments({ examDate: { $gte: now() } }),
      NoticeModel.countDocuments({
        isPublished: true,
        $or: [{ expiryDate: { $gte: now() } }, { expiryDate: null }],
      }),
      MeetingModel.countDocuments({
        status: { $in: ["scheduled", "ongoing"] },
        scheduledAt: { $gte: now() },
      }),
      CurriculumModel.countDocuments({ isActive: true }),
      SubjectModel.countDocuments({ isActive: true }),
      SectionModel.countDocuments({ isActive: true }),
      ResearchProjectModel.countDocuments({
        status: { $nin: ["completed", "closed", "rejected"] },
      }),
      RndPublicationModel.countDocuments(),
    ]);

    // Course completion % college-wide
    const courseCompletionStats = await CourseProgressModel.aggregate([
      {
        $group: {
          _id: "$departmentId",
          avgCompletion: { $avg: "$completionPercentage" },
          totalSubjects: { $sum: 1 },
          completedSubjects: { $sum: { $cond: ["$isComplete", 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      { $addFields: { name: { $ifNull: ["$department.name", "Unassigned"] } } },
      { $sort: { avgCompletion: 1 } },
    ]);

    const overallAvgCompletion =
      courseCompletionStats.reduce((sum, d) => sum + (d.avgCompletion ?? 0), 0) /
      Math.max(courseCompletionStats.length, 1);

    // Attendance average per department (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deptAttendance = await StudentAttendanceSummaryModel.aggregate([
      { $match: { updatedAt: { $gte: thirtyDaysAgo } } },
      {
        $lookup: {
          from: "studentprofiles",
          localField: "studentId",
          foreignField: "userId",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$profile.department",
          avgAttendance: { $avg: "$percentage" },
          shortageCount: { $sum: { $cond: ["$isShortage", 1, 0] } },
          totalStudents: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      { $addFields: { name: { $ifNull: ["$department.name", "Unassigned"] } } },
      { $sort: { avgAttendance: 1 } },
    ]);

    // Faculty workload summary
    const workloadSummary = await FacultyWorkloadModel.aggregate([
      {
        $group: {
          _id: "$departmentId",
          avgWeeklyHours: { $avg: "$totalWeeklyTeachingHours" },
          maxWeeklyHours: { $max: "$totalWeeklyTeachingHours" },
          facultyCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      { $addFields: { name: { $ifNull: ["$department.name", "Unassigned"] } } },
    ]);

    const academicPerformanceAgg = await SemesterResultModel.aggregate([
      { $match: { isPublished: true } },
      {
        $group: {
          _id: null,
          averageCgpa: { $avg: "$cgpa" },
          passed: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          averageCgpa: { $round: ["$averageCgpa", 2] },
          passPercentage: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$passed", "$total"] }, 100] }, 1] },
              null,
            ],
          },
          publishedResults: "$total",
        },
      },
    ]);

    const analyticsStart = new Date();
    analyticsStart.setHours(0, 0, 0, 0);
    analyticsStart.setDate(analyticsStart.getDate() - 29);
    const [
      totalDepartments,
      timetableSummary,
      latestTimetable,
      programEnrollment,
      attendanceTrend,
      cgpaDistribution,
      pendingApprovalCounts,
      facultyWorkloadDetail,
    ] = await Promise.all([
      DepartmentModel.countDocuments({ status: DepartmentStatus.ACTIVE }),
      TimetableModel.aggregate([
        { $match: { isActive: true, isApproved: true } },
        { $unwind: "$slots" },
        { $match: { "slots.slotKind": { $in: ["teaching", null] } } },
        { $group: { _id: "$slots.day", classes: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      TimetableModel.findOne({ isActive: true })
        .sort({ updatedAt: -1 })
        .select("academicYear semesterType semester")
        .lean(),
      StudentProfileModel.aggregate([
        { $match: { status: StudentStatus.ACTIVE } },
        { $group: { _id: "$program", students: { $sum: 1 } } },
        { $project: { _id: 0, name: { $ifNull: ["$_id", "Unassigned"] }, students: 1 } },
        { $sort: { students: -1 } },
        { $limit: 6 },
      ]),
      AttendanceRecordModel.aggregate([
        { $match: { date: { $gte: analyticsStart }, totalStrength: { $gt: 0 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            present: { $sum: "$totalPresent" },
            total: { $sum: "$totalStrength" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            percentage: {
              $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1],
            },
          },
        },
        { $sort: { date: 1 } },
      ]),
      SemesterResultModel.aggregate([
        { $match: { isPublished: true, cgpa: { $ne: null } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $gte: ["$cgpa", 9] }, then: "9–10" },
                  { case: { $gte: ["$cgpa", 8] }, then: "8–9" },
                  { case: { $gte: ["$cgpa", 7] }, then: "7–8" },
                  { case: { $gte: ["$cgpa", 6] }, then: "6–7" },
                  { case: { $gte: ["$cgpa", 5] }, then: "5–6" },
                ],
                default: "Below 5",
              },
            },
            students: { $sum: 1 },
          },
        },
        {
          $addFields: {
            order: {
              $indexOfArray: [["9–10", "8–9", "7–8", "6–7", "5–6", "Below 5"], "$_id"],
            },
          },
        },
        { $sort: { order: 1 } },
        { $project: { _id: 0, range: "$_id", students: 1 } },
      ]),
      Promise.all([
        LeaveRequestModel.countDocuments({ status: "pending" }),
        TimetableModel.countDocuments({ isActive: true, isApproved: false }),
        FacultyWorkloadModel.countDocuments({ isApproved: false }),
        StudentMarksModel.countDocuments({ verifiedBy: null }),
      ]),
      FacultyWorkloadModel.aggregate([
        { $sort: { totalWeeklyHours: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: "users",
            localField: "facultyId",
            foreignField: "_id",
            as: "faculty",
          },
        },
        { $unwind: { path: "$faculty", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "departments",
            localField: "departmentId",
            foreignField: "_id",
            as: "department",
          },
        },
        { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            facultyId: 1,
            name: { $ifNull: ["$faculty.name", "Faculty member"] },
            avatar: "$faculty.avatar",
            department: { $ifNull: ["$department.code", "Unassigned"] },
            teachingHours: "$totalWeeklyTeachingHours",
            totalHours: "$totalWeeklyHours",
            assignments: { $size: { $ifNull: ["$teachingAssignments", []] } },
            isApproved: 1,
          },
        },
      ]),
    ]);

    return {
      ...common,
      totalStudents,
      totalFaculty,
      totalPrograms,
      totalCourses,
      totalSections,
      totalDepartments,
      classesScheduled: timetableSummary.reduce(
        (total: number, item: { classes?: number }) => total + Number(item.classes ?? 0),
        0,
      ),
      classScheduleByDay: timetableSummary.map((item: { _id?: string; classes?: number }) => ({
        day: item._id ?? "Unassigned",
        classes: Number(item.classes ?? 0),
      })),
      academicContext: latestTimetable
        ? {
            academicYear: latestTimetable.academicYear,
            semesterType: latestTimetable.semesterType,
            semester: latestTimetable.semester,
          }
        : null,
      researchProjects,
      publications,
      upcomingExams,
      activeNotices,
      upcomingMeetings,
      overallAvgCompletion: Math.round(overallAvgCompletion * 10) / 10,
      courseCompletionStats,
      deptAttendance,
      workloadSummary,
      programEnrollment,
      attendanceTrend,
      cgpaDistribution,
      pendingApprovals: {
        leaveRequests: pendingApprovalCounts[0],
        timetables: pendingApprovalCounts[1],
        facultyWorkloads: pendingApprovalCounts[2],
        markVerifications: pendingApprovalCounts[3],
      },
      facultyWorkloadDetail,
      academicPerformance: academicPerformanceAgg[0] ?? null,
    };
  },

  /**
   * Scholarship Cell — application counts by status, disbursement summary.
   */
  getScholarshipDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [summary, byStatus, topSchemes, applicationTrend, disbursementTrend, schemeSummary] =
      await Promise.all([
        ScholarshipModel.aggregate([
          {
            $group: {
              _id: null,
              totalApplications: { $sum: 1 },
              pendingVerification: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["applied", "document_pending", "under_review"]] },
                    1,
                    0,
                  ],
                },
              },
              verifiedApproved: {
                $sum: { $cond: [{ $in: ["$status", ["approved", "disbursed"]] }, 1, 0] },
              },
              approvedAmount: { $sum: { $ifNull: ["$approvedAmount", 0] } },
              disbursedAmount: { $sum: { $ifNull: ["$disbursedAmount", 0] } },
            },
          },
        ]),
        ScholarshipModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
          { $sort: { count: -1 } },
        ]),
        ScholarshipModel.aggregate([
          {
            $group: {
              _id: { schemeId: "$schemeId", name: "$scholarshipName" },
              applications: { $sum: 1 },
              approved: {
                $sum: { $cond: [{ $in: ["$status", ["approved", "disbursed"]] }, 1, 0] },
              },
              disbursedAmount: { $sum: { $ifNull: ["$disbursedAmount", 0] } },
            },
          },
          { $sort: { applications: -1 } },
          { $limit: 6 },
        ]),
        ScholarshipModel.aggregate([
          {
            $group: {
              _id: { year: { $year: "$appliedDate" }, month: { $month: "$appliedDate" } },
              applications: { $sum: 1 },
              approved: {
                $sum: { $cond: [{ $in: ["$status", ["approved", "disbursed"]] }, 1, 0] },
              },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          { $limit: 12 },
        ]),
        ScholarshipModel.aggregate([
          { $match: { disbursedDate: { $ne: null } } },
          {
            $group: {
              _id: { year: { $year: "$disbursedDate" }, month: { $month: "$disbursedDate" } },
              amount: { $sum: { $ifNull: ["$disbursedAmount", 0] } },
              beneficiaries: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          { $limit: 12 },
        ]),
        ScholarshipSchemeModel.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              activeSchemes: { $sum: 1 },
              totalBudget: { $sum: "$budgetAmount" },
              reservedAmount: { $sum: "$reservedAmount" },
              schemeDisbursedAmount: { $sum: "$disbursedAmount" },
            },
          },
        ]),
      ]);

    const [recentApplications, pendingVerification] = await Promise.all([
      ScholarshipModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select(
          "scholarshipName scholarshipType studentId status amount approvedAmount disbursedAmount appliedDate createdAt",
        )
        .populate("studentId", "name email avatar")
        .lean(),
      ScholarshipModel.find({ status: { $in: ["applied", "document_pending", "under_review"] } })
        .sort({ appliedDate: 1 })
        .limit(6)
        .select("schemeId scholarshipName studentId status documents appliedDate amount")
        .populate("studentId", "name email avatar")
        .populate("schemeId", "name requiredDocumentTypes maxAwardAmount")
        .lean(),
    ]);

    const totals = summary[0] ?? {
      totalApplications: 0,
      pendingVerification: 0,
      verifiedApproved: 0,
      approvedAmount: 0,
      disbursedAmount: 0,
    };
    const schemes = schemeSummary[0] ?? {
      activeSchemes: 0,
      totalBudget: 0,
      reservedAmount: 0,
      schemeDisbursedAmount: 0,
    };

    return {
      ...common,
      ...totals,
      ...schemes,
      byStatus: byStatus.map((status) => ({
        name: status._id,
        value: status.count,
        totalAmount: status.totalAmount,
      })),
      topSchemes: topSchemes.map((scheme) => ({
        schemeId: scheme._id.schemeId,
        name: scheme._id.name,
        applications: scheme.applications,
        approved: scheme.approved,
        disbursedAmount: scheme.disbursedAmount,
      })),
      applicationTrend: applicationTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        applications: point.applications,
        approved: point.approved,
      })),
      disbursementTrend: disbursementTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        amount: point.amount,
        beneficiaries: point.beneficiaries,
      })),
      recentApplications,
      pendingVerification,
    };
  },

  getStoreDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalItems,
      itemsInStock,
      lowStockCount,
      pendingRequests,
      pendingGrns,
      inventoryValue,
      reqStats,
      categoryStats,
      purchaseSummary,
      movementSummary,
    ] = await Promise.all([
      StoreItemModel.countDocuments({ isActive: true }),
      StoreItemModel.countDocuments({ isActive: true, currentStock: { $gt: 0 } }),
      StoreItemModel.countDocuments({
        isActive: true,
        $expr: { $lte: ["$currentStock", "$minStock"] },
      }),
      StoreRequestModel.countDocuments({ status: "pending" }),
      ProcurementGoodsReceiptModel.countDocuments({ status: "received" }),
      StoreItemModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ["$currentStock", { $ifNull: ["$unitCost", 0] }] } },
          },
        },
      ]),
      StoreRequestModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      StoreItemModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$category",
            itemCount: { $sum: 1 },
            stockValue: {
              $sum: { $multiply: ["$currentStock", { $ifNull: ["$unitCost", 0] }] },
            },
          },
        },
        { $sort: { stockValue: -1 } },
      ]),
      ProcurementPurchaseOrderModel.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: "$totalAmount" },
            totalPurchaseOrders: { $sum: 1 },
            suppliers: { $addToSet: "$vendorId" },
          },
        },
        {
          $project: {
            _id: 0,
            totalPurchases: 1,
            totalPurchaseOrders: 1,
            totalSuppliers: { $size: "$suppliers" },
          },
        },
      ]),
      StoreStockMovementModel.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            receivedQuantity: {
              $sum: { $cond: [{ $gt: ["$delta", 0] }, "$delta", 0] },
            },
            issuedQuantity: {
              $sum: { $cond: [{ $lt: ["$delta", 0] }, { $abs: "$delta" }, 0] },
            },
            receivedValue: {
              $sum: { $cond: [{ $gt: ["$delta", 0] }, { $ifNull: ["$movementValue", 0] }, 0] },
            },
            issuedValue: {
              $sum: { $cond: [{ $lt: ["$delta", 0] }, { $ifNull: ["$movementValue", 0] }, 0] },
            },
          },
        },
      ]),
    ]);

    const [recentRequests, recentGrns, lowStockItems, recentMovements] = await Promise.all([
      StoreRequestModel.find().sort({ createdAt: -1 }).limit(6).lean(),
      ProcurementGoodsReceiptModel.find()
        .sort({ receivedAt: -1 })
        .limit(6)
        .populate("purchaseOrderId", "poNumber itemName quantity vendorId")
        .lean(),
      StoreItemModel.find({
        isActive: true,
        $expr: { $lte: ["$currentStock", "$minStock"] },
      })
        .sort({ currentStock: 1 })
        .limit(6)
        .select("sku name category unit currentStock minStock reorderQuantity")
        .lean(),
      StoreStockMovementModel.find({ createdAt: { $gte: monthStart } })
        .sort({ createdAt: -1 })
        .limit(12)
        .populate("itemId", "name sku unit")
        .lean(),
    ]);

    return {
      ...common,
      totalItems,
      itemsInStock,
      totalStockValue: inventoryValue[0]?.total ?? 0,
      lowStockCount,
      pendingRequests,
      pendingGrns,
      reqStats: reqStats.map((r) => ({ name: r._id, value: r.count })),
      categoryStats: categoryStats.map((category) => ({
        category: category._id,
        itemCount: category.itemCount,
        stockValue: category.stockValue,
      })),
      purchaseSummary: purchaseSummary[0] ?? {
        totalPurchases: 0,
        totalPurchaseOrders: 0,
        totalSuppliers: 0,
      },
      movementSummary: movementSummary[0] ?? {
        receivedQuantity: 0,
        issuedQuantity: 0,
        receivedValue: 0,
        issuedValue: 0,
      },
      recentRequests,
      recentGrns,
      lowStockItems,
      recentMovements,
    };
  },

  getTransportationDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const liveCutoff = new Date(Date.now() - 15 * 60 * 1000);

    const [
      totalBuses,
      totalRoutes,
      allocatedStudents,
      totalDrivers,
      activeTrackingSessions,
      todaysTrips,
      routeCapacity,
      feeSummary,
    ] = await Promise.all([
      BusRouteModel.countDocuments({}),
      BusRouteModel.countDocuments({ isActive: true }),
      TransportAllocationModel.countDocuments({ status: "active" }),
      DriverModel.countDocuments({ isActive: true }),
      TransportTrackingSessionModel.find({
        status: "active",
        expiresAt: { $gt: now() },
      })
        .select("routeId startedAt lastSeenAt lastRecordedAt")
        .lean(),
      TransportTrackingSessionModel.countDocuments({ startedAt: { $gte: todayStart } }),
      BusRouteModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            capacity: { $sum: "$capacity" },
            occupied: { $sum: "$occupiedCount" },
          },
        },
      ]),
      TransportFeeModel.aggregate([
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$totalDue" },
            paidAmount: { $sum: "$paidAmount" },
            outstandingAmount: { $sum: { $subtract: ["$totalDue", "$paidAmount"] } },
            overdueRecords: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const routeStats = await BusRouteModel.find({ isActive: true })
      .select(
        "routeNo routeName capacity occupiedCount driverName driverPhone vehicleNo vehicleType gps stops",
      )
      .sort({ routeNo: 1 })
      .lean();

    const [recentAllocations, expiringDrivers] = await Promise.all([
      TransportAllocationModel.find({ status: "active" })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("studentId", "name email avatar")
        .populate("routeId", "routeNo routeName vehicleNo")
        .lean(),
      DriverModel.find({
        isActive: true,
        licenseExpiry: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      })
        .sort({ licenseExpiry: 1 })
        .limit(5)
        .select("name licenseNo licenseExpiry assignedRoute")
        .lean(),
    ]);

    const activeRouteIds = new Set(
      activeTrackingSessions.map((session) => String(session.routeId)),
    );
    const onRouteCount = activeRouteIds.size;
    const inDepotCount = Math.max(totalBuses - onRouteCount, 0);
    const gpsOnlineCount = routeStats.filter(
      (route) => route.gps?.lastSeen && new Date(route.gps.lastSeen) >= liveCutoff,
    ).length;
    const onTimePerformance = totalRoutes
      ? Math.round((gpsOnlineCount / totalRoutes) * 1000) / 10
      : 0;
    const activeBuses = routeStats.map((route) => ({
      _id: route._id,
      routeNo: route.routeNo,
      routeName: route.routeName,
      vehicleNo: route.vehicleNo,
      vehicleType: route.vehicleType,
      driverName: route.driverName,
      capacity: route.capacity,
      occupiedCount: route.occupiedCount,
      stops: route.stops,
      gps: route.gps ?? null,
      status: activeRouteIds.has(String(route._id)) ? "on_route" : "in_depot",
    }));

    return {
      ...common,
      totalBuses,
      totalRoutes,
      allocatedStudents,
      totalDrivers,
      onRouteCount,
      inDepotCount,
      onTimePerformance,
      todaysTrips,
      capacity: routeCapacity[0] ?? { capacity: 0, occupied: 0 },
      feeSummary: feeSummary[0] ?? {
        totalDue: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueRecords: 0,
      },
      routeStats,
      activeBuses,
      recentAllocations,
      expiringDrivers,
    };
  },

  getResearchDevelopmentDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      totalProjects,
      ongoingProjects,
      totalPublications,
      publicationPatents,
      projectSummary,
      projectStatus,
      researchAreas,
    ] = await Promise.all([
      ResearchProjectModel.countDocuments({}),
      ResearchProjectModel.countDocuments({ status: "ongoing" }),
      RndPublicationModel.countDocuments({}),
      RndPublicationModel.countDocuments({ kind: "patent" }),
      ResearchProjectModel.aggregate([
        {
          $group: {
            _id: null,
            totalGrants: { $sum: { $ifNull: ["$sanctionedAmount", "$grantAmount"] } },
            totalExpenditure: { $sum: "$expenditureAmount" },
            projectPatents: { $sum: { $size: { $ifNull: ["$intellectualProperty", []] } } },
            collaborators: { $sum: { $size: { $ifNull: ["$coInvestigators", []] } } },
            milestones: { $sum: { $size: { $ifNull: ["$milestones", []] } } },
            completedMilestones: {
              $sum: {
                $size: {
                  $filter: {
                    input: { $ifNull: ["$milestones", []] },
                    as: "milestone",
                    cond: { $eq: ["$$milestone.status", "completed"] },
                  },
                },
              },
            },
          },
        },
      ]),
      ResearchProjectModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ResearchProjectModel.aggregate([
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "department",
          },
        },
        {
          $project: {
            _id: 0,
            departmentId: "$_id",
            name: { $ifNull: [{ $first: "$department.name" }, "Unassigned"] },
            count: 1,
          },
        },
      ]),
    ]);

    const publicationsTrend = await RndPublicationModel.aggregate([
      { $group: { _id: "$year", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 10 },
    ]);

    const recentProjects = await ResearchProjectModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("principalInvestigator", "name avatar")
      .lean();

    const recentPublications = await RndPublicationModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      ...common,
      totalProjects,
      ongoingProjects,
      totalPublications,
      totalPatents: publicationPatents + (projectSummary[0]?.projectPatents ?? 0),
      totalGrants: projectSummary[0]?.totalGrants ?? 0,
      totalExpenditure: projectSummary[0]?.totalExpenditure ?? 0,
      totalCollaborators: projectSummary[0]?.collaborators ?? 0,
      totalMilestones: projectSummary[0]?.milestones ?? 0,
      completedMilestones: projectSummary[0]?.completedMilestones ?? 0,
      projectStatus: projectStatus.map((status) => ({ name: status._id, value: status.count })),
      researchAreas,
      publicationsTrend: publicationsTrend.map((p) => ({ label: String(p._id), value: p.count })),
      recentProjects,
      recentPublications,
    };
  },

  getClubHeadDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const leaderId = new mongoose.Types.ObjectId(userId);
    const scope = {
      isActive: true,
      $or: [{ studentHead: leaderId }, { facultyAdvisor: leaderId }],
    };
    const [totalClubs, totalMembersAgg, categoryStats, membershipTrend] = await Promise.all([
      ClubModel.countDocuments(scope),
      ClubModel.aggregate([
        { $match: scope },
        { $project: { memberCount: { $size: "$members" } } },
        { $group: { _id: null, total: { $sum: "$memberCount" } } },
      ]),
      ClubModel.aggregate([
        { $match: scope },
        {
          $group: {
            _id: "$category",
            clubs: { $sum: 1 },
            members: { $sum: { $size: "$members" } },
            activities: { $sum: { $size: "$activities" } },
          },
        },
        { $sort: { members: -1 } },
      ]),
      ClubModel.aggregate([
        { $match: scope },
        { $unwind: "$members" },
        {
          $group: {
            _id: {
              year: { $year: "$members.joinedAt" },
              month: { $month: "$members.joinedAt" },
            },
            joined: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
    ]);

    const clubStats = await ClubModel.aggregate([
      { $match: scope },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          description: 1,
          logoUrl: 1,
          memberCount: { $size: "$members" },
          activityCount: { $size: "$activities" },
          upcomingActivities: {
            $filter: {
              input: "$activities",
              as: "activity",
              cond: { $gte: ["$$activity.date", now()] },
            },
          },
          recentActivities: {
            $slice: [
              {
                $sortArray: {
                  input: "$activities",
                  sortBy: { date: -1 },
                },
              },
              5,
            ],
          },
        },
      },
    ]);

    const allActivities = clubStats
      .flatMap((club) =>
        (club.recentActivities ?? []).map((activity: Record<string, unknown>) => ({
          ...activity,
          clubId: club._id,
          clubName: club.name,
        })),
      )
      .sort((a, b) => +new Date(String(b.date)) - +new Date(String(a.date)))
      .slice(0, 8);
    const upcomingActivities = clubStats
      .flatMap((club) =>
        (club.upcomingActivities ?? []).map((activity: Record<string, unknown>) => ({
          ...activity,
          clubId: club._id,
          clubName: club.name,
        })),
      )
      .sort((a, b) => +new Date(String(a.date)) - +new Date(String(b.date)))
      .slice(0, 8);

    return {
      ...common,
      totalClubs,
      totalMembers: totalMembersAgg[0]?.total ?? 0,
      totalActivities: clubStats.reduce((total, club) => total + club.activityCount, 0),
      clubStats: clubStats.map((c) => ({
        _id: c._id,
        name: c.name,
        category: c.category,
        description: c.description,
        logoUrl: c.logoUrl,
        members: c.memberCount,
        activities: c.activityCount,
      })),
      categoryStats: categoryStats.map((category) => ({
        name: category._id,
        clubs: category.clubs,
        members: category.members,
        activities: category.activities,
      })),
      membershipTrend: membershipTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        joined: point.joined,
      })),
      recentActivities: allActivities,
      upcomingActivities,
    };
  },

  getIicDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const [
      totalActivities,
      reportedToMic,
      pendingMicReport,
      totalParticipantsAgg,
      innovationSummary,
      innovationPipeline,
      innovationCategories,
      activityTrend,
    ] = await Promise.all([
      IicActivityModel.countDocuments({}),
      IicActivityModel.countDocuments({ reportedToMic: true }),
      IicActivityModel.countDocuments({ reportedToMic: false }),
      IicActivityModel.aggregate([{ $group: { _id: null, total: { $sum: "$participantCount" } } }]),
      InnovationProjectModel.aggregate([
        {
          $group: {
            _id: null,
            totalInnovations: { $sum: 1 },
            startupsSupported: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ["$startupName", ""] }, ""] }, 1, 0] },
            },
            totalFundingAllocated: { $sum: "$fundingAllocated" },
            totalFundingSpent: { $sum: "$fundingSpent" },
            totalIpRecords: { $sum: { $size: { $ifNull: ["$ipRecords", []] } } },
            totalTeamMembers: { $sum: { $size: { $ifNull: ["$teamMemberIds", []] } } },
          },
        },
      ]),
      InnovationProjectModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      InnovationProjectModel.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      IicActivityModel.aggregate([
        {
          $group: {
            _id: { year: { $year: "$startDate" }, month: { $month: "$startDate" } },
            activities: { $sum: 1 },
            participants: { $sum: { $ifNull: ["$participantCount", 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
    ]);

    const categoryStats = await IicActivityModel.aggregate([
      { $group: { _id: "$kind", count: { $sum: 1 } } },
    ]);

    const [recentActivities, recentInnovations] = await Promise.all([
      IicActivityModel.find().sort({ startDate: -1 }).limit(6).lean(),
      InnovationProjectModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("submitterId", "name avatar")
        .populate("mentorId", "name avatar")
        .lean(),
    ]);
    const summary = innovationSummary[0] ?? {
      totalInnovations: 0,
      startupsSupported: 0,
      totalFundingAllocated: 0,
      totalFundingSpent: 0,
      totalIpRecords: 0,
      totalTeamMembers: 0,
    };

    return {
      ...common,
      totalActivities,
      reportedToMic,
      pendingMicReport,
      totalParticipants: totalParticipantsAgg[0]?.total ?? 0,
      ...summary,
      totalMembers: summary.totalTeamMembers,
      categoryStats: categoryStats.map((c) => ({ name: c._id, value: c.count })),
      innovationPipeline: innovationPipeline.map((stage) => ({
        name: stage._id,
        value: stage.count,
      })),
      innovationCategories: innovationCategories.map((category) => ({
        name: category._id,
        value: category.count,
      })),
      activityTrend: activityTrend.map((point) => ({
        label: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
        activities: point.activities,
        participants: point.participants,
      })),
      recentActivities,
      recentInnovations,
    };
  },

  getAdministrationOfficeDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    const trendStart = new Date();
    trendStart.setDate(1);
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setMonth(trendStart.getMonth() - 5);

    const [
      aooUsers,
      totalStudents,
      verifiedStudentsCount,
      unverifiedStudentsCount,
      pendingAdmissions,
      verifiedAdmissions,
      rejectedAdmissions,
      totalStaff,
      activeStaff,
      pendingLeaveRequests,
      totalFeesCollectedAgg,
      totalOutstandingAgg,
      activeRoutes,
      routeCapacityAgg,
      routeOccupiedAgg,
      cataloguedItems,
      availableItems,
      lowStockCount,
      pendingStoreRequests,
      totalScholarships,
      pendingScholarships,
      scholarshipDisbursedAgg,
    ] = await Promise.all([
      UserModel.find({ roles: { $in: [SystemRole.ASSISTANT_ADMINISTRATION_OFFICER] } })
        .select("name email avatar")
        .lean(),
      StudentProfileModel.countDocuments(),
      StudentProfileModel.countDocuments({ verified: true }),
      StudentProfileModel.countDocuments({ verified: false }),
      AdmissionApplicationModel.countDocuments({ status: "submitted" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      AdmissionApplicationModel.countDocuments({ status: "approved" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      AdmissionApplicationModel.countDocuments({ status: "rejected" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      HrEmployeeModel.countDocuments({}),
      HrEmployeeModel.countDocuments({ employmentStatus: "active" } as unknown as Parameters<
        typeof HrEmployeeModel.countDocuments
      >[0]),
      LeaveRequestModel.countDocuments({ status: "pending" }),
      FeeRecordModel.aggregate([
        { $match: { status: "Paid" } },
        { $group: { _id: null, total: { $sum: "$totalPaid" } } },
      ]),
      FeeRecordModel.aggregate([
        { $match: { status: { $in: ["Pending", "Partial", "Overdue"] } } },
        { $group: { _id: null, total: { $sum: "$balanceDue" } } },
      ]),
      BusRouteModel.countDocuments({ isActive: true }),
      BusRouteModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: "$capacity" } } },
      ]),
      BusRouteModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: "$occupiedCount" } } },
      ]),
      StoreItemModel.countDocuments({ isActive: true }),
      StoreItemModel.countDocuments({ isActive: true, currentStock: { $gt: 0 } }),
      StoreItemModel.countDocuments({
        isActive: true,
        $expr: { $lte: ["$currentStock", "$minStock"] },
      }),
      StoreRequestModel.countDocuments({ status: "pending" }),
      ScholarshipModel.countDocuments({}),
      ScholarshipModel.countDocuments({ status: "applied" } as unknown as Parameters<
        typeof ScholarshipModel.countDocuments
      >[0]),
      ScholarshipModel.aggregate([
        { $match: { status: "disbursed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    // Aggregate verification activity by each AOO user
    const aooUserIds = aooUsers.map((u) => u._id);
    const [studentVerifications, admissionVerifications, admissionTrendRaw, feeTrendRaw] =
      await Promise.all([
        StudentProfileModel.aggregate([
          { $match: { verified: true, verifiedBy: { $in: aooUserIds } } },
          { $group: { _id: "$verifiedBy", count: { $sum: 1 } } },
        ]),
        AdmissionApplicationModel.aggregate([
          { $match: { status: "approved", verifiedBy: { $in: aooUserIds } } },
          { $group: { _id: "$verifiedBy", count: { $sum: 1 } } },
        ]),
        AdmissionApplicationModel.aggregate([
          { $match: { createdAt: { $gte: trendStart } } },
          {
            $group: {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              applications: { $sum: 1 },
              approved: {
                $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
              },
            },
          },
        ]),
        FeeRecordModel.aggregate([
          { $unwind: "$transactions" },
          { $match: { "transactions.paymentDate": { $gte: trendStart } } },
          {
            $group: {
              _id: {
                year: { $year: "$transactions.paymentDate" },
                month: { $month: "$transactions.paymentDate" },
              },
              collected: { $sum: "$transactions.amountPaid" },
            },
          },
        ]),
      ]);

    const monthlyTrends = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
      const year = month.getFullYear();
      const monthNumber = month.getMonth() + 1;
      const admission = admissionTrendRaw.find(
        (entry) => entry._id.year === year && entry._id.month === monthNumber,
      );
      const fees = feeTrendRaw.find(
        (entry) => entry._id.year === year && entry._id.month === monthNumber,
      );
      return {
        label: month.toLocaleString("en-IN", { month: "short" }),
        applications: admission?.applications ?? 0,
        approved: admission?.approved ?? 0,
        feeCollected: fees?.collected ?? 0,
      };
    });

    const aooActivity = aooUsers.map((u) => {
      const sv = studentVerifications.find((v) => String(v._id) === String(u._id))?.count ?? 0;
      const av = admissionVerifications.find((v) => String(v._id) === String(u._id))?.count ?? 0;
      return {
        _id: u._id,
        name: u.name,
        avatar: u.avatar ?? null,
        email: u.email,
        verifiedStudents: sv,
        verifiedAdmissions: av,
        totalVerifications: sv + av,
      };
    });

    return {
      ...common,
      aooActivity,
      monthlyTrends,
      students: {
        total: totalStudents,
        verified: verifiedStudentsCount,
        unverified: unverifiedStudentsCount,
      },
      admissions: {
        total: pendingAdmissions + verifiedAdmissions + rejectedAdmissions,
        pending: pendingAdmissions,
        verified: verifiedAdmissions,
        rejected: rejectedAdmissions,
      },
      hr: {
        total: totalStaff,
        active: activeStaff,
        pendingLeaves: pendingLeaveRequests,
      },
      accounts: {
        collected: totalFeesCollectedAgg[0]?.total ?? 0,
        outstanding: totalOutstandingAgg[0]?.total ?? 0,
      },
      transport: {
        routes: activeRoutes,
        capacity: routeCapacityAgg[0]?.total ?? 0,
        occupied: routeOccupiedAgg[0]?.total ?? 0,
      },
      store: {
        items: cataloguedItems,
        available: availableItems,
        lowStock: lowStockCount,
        pendingRequests: pendingStoreRequests,
      },
      scholarship: {
        total: totalScholarships,
        pending: pendingScholarships,
        disbursed: scholarshipDisbursedAgg[0]?.total ?? 0,
      },
    };
  },

  getAssistantAdministrationOfficerDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);

    const [
      myVerifiedStudents,
      myVerifiedAdmissions,
      totalUnverifiedStudents,
      totalPendingAdmissions,
      pendingStudentsList,
      pendingAdmissionsList,
    ] = await Promise.all([
      StudentProfileModel.countDocuments({ verified: true, verifiedBy: userId }),
      AdmissionApplicationModel.countDocuments({
        status: "approved",
        verifiedBy: userId,
      } as unknown as Parameters<typeof AdmissionApplicationModel.countDocuments>[0]),
      StudentProfileModel.countDocuments({ verified: false }),
      AdmissionApplicationModel.countDocuments({ status: "submitted" } as unknown as Parameters<
        typeof AdmissionApplicationModel.countDocuments
      >[0]),
      StudentProfileModel.find({ verified: false })
        .populate("userId", "name email avatar")
        .limit(5)
        .select("userId rollNumber program currentSemester")
        .lean(),
      AdmissionApplicationModel.find({ status: "submitted" } as unknown as Parameters<
        typeof AdmissionApplicationModel.find
      >[0])
        .limit(5)
        .select("applicantName program admissionType applicationNumber createdAt")
        .lean(),
    ]);

    return {
      ...common,
      myStats: {
        verifiedStudents: myVerifiedStudents,
        verifiedAdmissions: myVerifiedAdmissions,
        totalVerified: myVerifiedStudents + myVerifiedAdmissions,
      },
      queues: {
        totalUnverifiedStudents,
        totalPendingAdmissions,
        pendingStudents: pendingStudentsList.map((s) => ({
          id: s._id,
          rollNumber: s.rollNumber,
          name: (s.userId as unknown as { name?: string })?.name,
          avatar: (s.userId as unknown as { avatar?: string })?.avatar ?? null,
          program: s.program,
          semester: s.currentSemester,
        })),
        pendingAdmissions: pendingAdmissionsList,
      },
    };
  },

  /**
   * Common neutral dashboard for specialist roles (Store, Transportation,
   * R&D, IIC, Club Head, IQAC/NAAC etc.) that don't have a custom widget
   * payload yet. Returns the welcome banner + sidebar widgets without any
   * leadership-only stats so they don't accidentally see Principal numbers.
   */
  getCommonDashboard: async (userId: string) => {
    const common = await buildCommonStaffSections(userId);
    return { ...common };
  },
};
