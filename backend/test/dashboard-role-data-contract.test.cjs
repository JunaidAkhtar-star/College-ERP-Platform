const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const dedicatedDashboardMethods = [
  "getAdminDashboard",
  "getPrincipalDashboard",
  "getAdministrationOfficeDashboard",
  "getAssistantAdministrationOfficerDashboard",
  "getDeanAcademicDashboard",
  "getHodDashboard",
  "getFacultyDashboard",
  "getStudentDashboard",
  "getParentDashboard",
  "getExaminationDashboard",
  "getIqacDashboard",
  "getScholarshipDashboard",
  "getLibraryDashboard",
  "getHostelWardenDashboard",
  "getPlacementDashboard",
  "getHrDashboard",
  "getAccountsDashboard",
  "getTransportationDashboard",
  "getResearchDevelopmentDashboard",
  "getClubHeadDashboard",
  "getIicDashboard",
  "getStoreDashboard",
  "getAdmissionCounselorDashboard",
  "getAdmissionInchargeDashboard",
];

test("dashboard dispatches from the active session role instead of all assigned roles", () => {
  const controller = read("controllers/dashboard.controller.ts");

  assert.match(controller, /const role = req\.activeRole as SystemRole/);
  assert.doesNotMatch(controller, /getSuperAdminDashboard\(\)/);
  assert.match(controller, /role === SystemRole\.SUPER_ADMIN[\s\S]*?getAdminDashboard\(\)/);
  assert.match(controller, /role === SystemRole\.ADMIN/);
  assert.match(controller, /getAdminDashboard\(\)/);
  assert.match(controller, /role === SystemRole\.PRINCIPAL/);
  assert.match(controller, /getPrincipalDashboard\(academicYear\)/);
  assert.match(controller, /getHodDashboard\(deptId, userId\)/);
  assert.match(controller, /getFacultyDashboard\(userId\)/);
  assert.match(controller, /getStudentDashboard\(userId\)/);
  assert.match(controller, /getParentDashboard\(userId\)/);
  assert.match(controller, /getHostelWardenDashboard\(userId\)/);
  assert.doesNotMatch(controller, /user\.roles\.(?:includes|some)/);
});

test("every system-role dashboard family has a dedicated service dispatch", () => {
  const controller = read("controllers/dashboard.controller.ts");

  for (const method of dedicatedDashboardMethods) {
    assert.match(controller, new RegExp(`${method}\\(`), `${method} is not dispatched`);
  }
});

test("principal dashboard derives academic and attendance analytics from ledgers", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getPrincipalDashboard: async/);
  assert.match(service, /AttendanceRecordModel\.aggregate/);
  assert.match(service, /SemesterResultModel\.aggregate/);
  assert.match(service, /gradeDistribution/);
  assert.match(service, /attendancePercentage/);
  assert.match(service, /passPercentage/);
});

test("admin academic metrics come from published results rather than attendance proxies", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(
    service,
    /SemesterResultModel\.aggregate\(\[\s*\{ \$match: \{ isPublished: true \} \}/,
  );
  assert.doesNotMatch(service, /Performance buckets from student attendance summary \(proxy\)/);
});

test("admin finance totals include partial collections and use the authoritative late-fee field", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /totalPaid: \{ \$gt: 0 \}/);
  assert.match(service, /status: \{ \$ne: FeePaymentStatus\.REFUNDED \}/);
  assert.match(service, /\{ \$sum: "\$lateFee" \}/);
  assert.doesNotMatch(service, /\{ \$sum: "\$lateFees" \}/);
});

test("HOD dashboard uses real attendance totals, enrollment, and published results", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /\$divide: \["\$totalPresent", "\$totalStrength"\]/);
  assert.match(service, /department: departmentObjectId, status: StudentStatus\.ACTIVE/);
  assert.match(service, /departmentId: departmentObjectId, isPublished: true/);
  assert.match(service, /studentAttendanceToday/);
  assert.doesNotMatch(service, /\$eq: \["\$\$e\.status", "present"\]/);
});

test("Dean dashboard resolves department names and published academic outcomes", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /_id: "\$profile\.department"/);
  assert.match(service, /as: "department"/);
  assert.match(service, /academicPerformanceAgg/);
  assert.doesNotMatch(service, /_id: "\$profile\.departmentId"/);
});

test("student and parent dashboards expose the actual latest CGPA", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /academicSummary: latestPublishedResult/);
  assert.match(service, /academicSummary: studentDashboard\.academicSummary/);
  assert.match(service, /workingDays: present \+ absent \+ halfday \+ late/);
  assert.doesNotMatch(service, /workingDays: 7/);
});

test("hostel warden receives operational hostel analytics instead of the common fallback", () => {
  const controller = read("controllers/dashboard.controller.ts");
  const service = read("services/dashboard.service.ts");

  assert.match(controller, /role === SystemRole\.HOSTEL_WARDEN/);
  assert.match(service, /getHostelWardenDashboard: async/);
  assert.match(service, /HostelRoomModel\.aggregate/);
  assert.match(service, /HostelComplaintModel\.countDocuments/);
  assert.match(service, /HostelVisitorModel\.countDocuments/);
  assert.match(service, /HostelFeeModel\.aggregate/);
});

test("faculty dashboard returns only real published marks from assigned sections and subjects", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /const assignedSectionIds =/);
  assert.match(service, /const assignedSubjectCodes = new Set/);
  assert.match(service, /isPublished: true/);
  assert.match(service, /sectionId: \{ \$in: assignedSectionIds \}/);
  assert.match(service, /"subjectResults\.subjectCode": \{ \$in:/);
  assert.match(service, /status: subject\.isPassed/);
  assert.doesNotMatch(service, /id: `EX\$\{1000 \+ i\}`/);
  assert.doesNotMatch(service, /marksPct: 0/);
});

test("student dashboard separates published exam results from attendance analytics", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(
    service,
    /SemesterResultModel\.find\(\{ studentId: studentUserId, isPublished: true \}\)/,
  );
  assert.match(service, /latestPublishedResult\?\.subjectResults/);
  assert.match(service, /const semesterAttendance = attendanceHistory\.filter/);
  assert.match(service, /examScore: Math\.round\(\(result\.sgpa \?\? 0\) \* 10\)/);
  assert.doesNotMatch(service, /examResultBars = attendanceSummaryRaw/);
  assert.doesNotMatch(service, /attendance: 0,/);
});

test("parent dashboard does not invent leave entitlements when no ledger exists", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /configured: Boolean\(leaveBalance\)/);
  assert.doesNotMatch(service, /leaveBalance\?\.sick \?\? 10/);
  assert.doesNotMatch(service, /leaveBalance\?\.casual \?\? 12/);
});

test("store dashboard is backed by inventory, movement, purchase order, and GRN ledgers", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getStoreDashboard: async/);
  assert.match(service, /StoreItemModel\.aggregate/);
  assert.match(service, /StoreStockMovementModel\.aggregate/);
  assert.match(service, /ProcurementPurchaseOrderModel\.aggregate/);
  assert.match(service, /ProcurementGoodsReceiptModel\.countDocuments/);
  assert.match(service, /recentGrns/);
  assert.match(service, /lowStockItems/);
  assert.match(service, /movementSummary/);
});

test("transportation dashboard uses tracking sessions, route capacity, drivers, and fee ledgers", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getTransportationDashboard: async/);
  assert.match(service, /TransportTrackingSessionModel\.find/);
  assert.match(service, /TransportTrackingSessionModel\.countDocuments/);
  assert.match(service, /TransportFeeModel\.aggregate/);
  assert.match(service, /activeRouteIds/);
  assert.match(service, /onTimePerformance/);
  assert.match(service, /expiringDrivers/);
});

test("research dashboard derives financial, milestone, patent, and collaboration metrics", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getResearchDevelopmentDashboard: async/);
  assert.match(service, /totalExpenditure/);
  assert.match(service, /projectPatents/);
  assert.match(service, /completedMilestones/);
  assert.match(service, /collaborators/);
  assert.match(service, /projectStatus/);
  assert.match(service, /researchAreas/);
});

test("club head dashboard scopes clubs to the signed-in leader and derives activity history", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /const leaderId = new mongoose\.Types\.ObjectId\(userId\)/);
  assert.match(service, /\$or: \[\{ studentHead: leaderId \}, \{ facultyAdvisor: leaderId \}\]/);
  assert.match(service, /membershipTrend/);
  assert.match(service, /upcomingActivities/);
  assert.match(service, /recentActivities: allActivities/);
});

test("IIC dashboard joins activity reporting with the innovation project pipeline", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getIicDashboard: async/);
  assert.match(service, /InnovationProjectModel\.aggregate/);
  assert.match(service, /totalFundingAllocated/);
  assert.match(service, /totalIpRecords/);
  assert.match(service, /innovationPipeline/);
  assert.match(service, /recentInnovations/);
});

test("hostel dashboard derives room type, hostel, resident, visitor, complaint, and fee summaries", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /roomTypeStats/);
  assert.match(service, /hostelStats/);
  assert.match(service, /newCheckIns/);
  assert.match(service, /visitorsToday/);
  assert.match(service, /complaintStats/);
  assert.match(service, /messCharges/);
  assert.match(service, /recentAllocations/);
});

test("library dashboard derives circulation, category, overdue, ranking, and arrival data", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /collectionSummary/);
  assert.match(service, /activeMembers/);
  assert.match(service, /overdueFineSummary/);
  assert.match(service, /circulationTrend/);
  assert.match(service, /topIssuedBooks/);
  assert.match(service, /overdueRows/);
  assert.match(service, /newArrivals/);
});

test("placement dashboard joins profiles, drives, applications, offers, companies, and packages", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /StudentPlacementProfileModel\.aggregate/);
  assert.match(service, /PlacementApplicationModel\.aggregate/);
  assert.match(service, /placementStatus/);
  assert.match(service, /placementTrend/);
  assert.match(service, /departmentPlacement/);
  assert.match(service, /packageDistribution/);
  assert.match(service, /topCompanies/);
  assert.match(service, /awaitingOffers/);
});

test("scholarship dashboard derives schemes, verification queues, budgets, and disbursements", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /ScholarshipSchemeModel\.aggregate/);
  assert.match(service, /pendingVerification/);
  assert.match(service, /verifiedApproved/);
  assert.match(service, /topSchemes/);
  assert.match(service, /applicationTrend/);
  assert.match(service, /disbursementTrend/);
  assert.match(service, /schemeDisbursedAmount/);
});

test("examination dashboard derives schedules, scripts, published results, and revaluation queues", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getExaminationDashboard: async/);
  assert.match(service, /StudentMarksModel\.aggregate/);
  assert.match(service, /SemesterResultModel\.aggregate/);
  assert.match(service, /RecheckRequestModel\.find/);
  assert.match(service, /scheduleOverview/);
  assert.match(service, /programResults/);
  assert.match(service, /topSubjects/);
  assert.match(service, /recentRevaluations/);
});

test("HR dashboard uses employee, attendance, leave, department, and payroll ledgers", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getHrDashboard: async/);
  assert.match(service, /employmentStatus: EmploymentStatus\.ACTIVE/);
  assert.match(service, /dateOfJoining/);
  assert.match(service, /FacultyAttendanceModel\.aggregate/);
  assert.match(service, /LeaveRequestModel\.aggregate/);
  assert.match(service, /PayslipModel\.aggregate/);
  assert.match(service, /departmentStrength/);
  assert.match(service, /attendanceOverview/);
  assert.match(service, /payrollSummary/);
  assert.doesNotMatch(service, /HrEmployeeModel\.find\(\{ status: "active" \}\)/);
});

test("accounts dashboard derives cash flow, budgets, categories, and reconciliation from ledgers", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getAccountsDashboard: async/);
  assert.match(service, /AccountsTransactionModel\.aggregate/);
  assert.match(service, /FinanceBudgetModel\.aggregate/);
  assert.match(service, /BankStatementLineModel\.aggregate/);
  assert.match(service, /monthlyCashFlow/);
  assert.match(service, /categorySummary/);
  assert.match(service, /budgetSummary/);
  assert.match(service, /reconciliationStatus/);
  assert.match(service, /closingBalance: totalIncome - totalExpense/);
});

test("admission counselor and in-charge have distinct scoped collection contracts", () => {
  const controller = read("controllers/dashboard.controller.ts");
  const service = read("services/dashboard.service.ts");

  assert.match(controller, /getAdmissionCounselorDashboard\(userId\)/);
  assert.match(controller, /getAdmissionInchargeDashboard\(userId\)/);
  assert.match(service, /const ownerId = new mongoose\.Types\.ObjectId\(userId\)/);
  assert.match(service, /RecruitmentLeadModel\.aggregate/);
  assert.match(service, /RecruitmentActivityModel\.find/);
  assert.match(service, /upcomingFollowUps/);
  assert.match(service, /sourceSummary/);
  assert.match(service, /AdmissionApplicationModel\.aggregate/);
  assert.match(service, /applicationTrend/);
  assert.match(service, /documentStatus/);
  assert.match(service, /programPreferences/);
});

test("IQAC and NAAC dashboard joins evidence, audits, feedback, attainment, and NBA reports", () => {
  const service = read("services/dashboard.service.ts");

  assert.match(service, /getIqacDashboard: async/);
  assert.match(service, /NaacEvidenceModel\.aggregate/);
  assert.match(service, /IQACAuditModel\.aggregate/);
  assert.match(service, /IQACFeedbackModel\.aggregate/);
  assert.match(service, /COPOAttainmentModel\.aggregate/);
  assert.match(service, /NbaReportModel\.aggregate/);
  assert.match(service, /criteriaProgress/);
  assert.match(service, /attainmentSummary/);
  assert.match(service, /recentEvidence/);
  assert.doesNotMatch(service, /avgRating: \{ \$avg: "\$overallRating" \}/);
});
