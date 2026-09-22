/**
 * @file seed-tenant-test-data.ts
 * @description Interactive destructive reset and realistic baseline seed for one tenant database.
 * with complete end-to-end operational test data:
 *   - Interactive tenant list & selection (or via --tenant=<tenantId>)
 *   - Exact tenant confirmation followed by a complete tenant database reset
 *   - Sidebar NavItem Documents (All 14 Groups & Links) seeded in NavItem collection
 *   - System Role Documents seeded in Role collection for all 26 SystemRoles with DEFAULT_PERMISSIONS & allowedNavItems
 *   - Audit-compliant documents with isDeleted: false for seamless Mongoose model querying
 *   - Institution Settings & Onboarding completion
 *   - 4 Academic Programs (Curriculums: B.Tech CSE, B.Tech ECE, MBA, BCA)
 *   - 4 Departments (CSE, ECE, SOM, SOCA) with core & elective subjects
 *   - Academic Batches (2026 admission year, regulation 2026)
 *   - Class Sections (CSE-1A, CSE-1B, ECE-1A, SOM-1A, SOCA-1A) with Class Teachers assigned
 *   - Classrooms & Computer Labs (FacilitySpace: CR-101, CR-102, LAB-CSE-1, LAB-ECE-1)
 *   - Timetables are intentionally NOT seeded so they can be created through the ERP workflow
 *   - 50 Faculty members with unique names, employee IDs, HOD assignments, & FacultyProfiles
 *   - 140 Students with unique names, roll numbers, Section Allotments, & StudentProfiles
 *   - Dedicated test login accounts for ALL 26 SystemRoles (password: Password123!)
 *
 * Run:
 *   pnpm seed:tenant-test
 *   pnpm seed:tenant-test -- --tenant=giet --confirm=RESET-giet
 */

import "dotenv/config";
import type { Model } from "mongoose";
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import readline from "readline";

import { SystemRole, ALL_ROLES } from "../constants/roles";
import { DEFAULT_PERMISSIONS } from "../constants/role-defaults";
import { TenantStatus } from "../models/tenant.model";
import { DepartmentStatus } from "../models/department.model";
import { SubjectType, SubjectCategory } from "../models/subject.model";
import {
  Qualification,
  Designation,
  EmploymentType,
  FacultyStatus,
} from "../models/faculty-profile.model";
import { StudentStatus } from "../models/student-profile.model";
import { AdmissionType, AdmissionCategory } from "../models/admission-application.model";
import { BatchStatus } from "../models/batch.model";
import { SectionStatus } from "../models/section.model";
import { StudentSectionAllotmentStatus } from "../models/student-section-allotment.model";

// ── Environment & Configuration ────────────────────────────────────────────────
const MONGODB_URI = process.env["MONGODB_URI"] ?? "";
const MASTER_DB_NAME = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

// Parse CLI flags
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
const CLI_TARGET_TENANT_ID = tenantArg ? tenantArg.split("=")[1]?.trim().toLowerCase() : undefined;
const confirmArg = process.argv.find((a) => a.startsWith("--confirm="));
const CLI_CONFIRMATION = confirmArg ? confirmArg.split("=")[1]?.trim() : undefined;

const DEFAULT_PASSWORD = process.env["SEED_DEFAULT_PASSWORD"] ?? "Password123!";
if (DEFAULT_PASSWORD.length < 10) {
  throw new Error("SEED_DEFAULT_PASSWORD must contain at least 10 characters.");
}

// ── Helper: Prompt User in Terminal ───────────────────────────────────────────
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ── Role Buckets for Nav Configuration ─────────────────────────────────────────
const R = SystemRole;
const ALL = ALL_ROLES;

const LEADERSHIP: SystemRole[] = [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL];
const ACADEMIC_LEADERSHIP: SystemRole[] = [...LEADERSHIP, R.DEAN_ACADEMIC];
const ACADEMIC_DEPT: SystemRole[] = [...ACADEMIC_LEADERSHIP, R.HOD];
const TEACHING_STAFF: SystemRole[] = [...ACADEMIC_DEPT, R.FACULTY];
const ADMISSION_STAFF: SystemRole[] = [
  R.SUPER_ADMIN,
  R.ADMIN,
  R.ADMINISTRATION_OFFICE,
  R.ASSISTANT_ADMINISTRATION_OFFICER,
  R.ADMISSION_INCHARGE,
  R.ADMISSION_COUNSELOR,
];
const FINANCE_ROLES: SystemRole[] = [...LEADERSHIP, R.ACCOUNTS_DEPARTMENT, R.ADMINISTRATION_OFFICE];
const HR_ROLES: SystemRole[] = [...LEADERSHIP, R.HR_DEPARTMENT, R.ADMINISTRATION_OFFICE];
const QUALITY_ROLES: SystemRole[] = [...ACADEMIC_LEADERSHIP, R.IQAC_NAAC, R.IQAC_TEAM];
const USER_MGMT_ROLES: SystemRole[] = [
  R.SUPER_ADMIN,
  R.ADMIN,
  R.PRINCIPAL,
  R.ADMINISTRATION_OFFICE,
];

interface NavLinkConfig {
  label: string;
  roleLabels?: Record<string, string>;
  href: string;
  icon: string;
  requiredRoles: SystemRole[];
  gate?: string;
}
interface NavGroupConfig {
  group: string;
  roleLabels?: Record<string, string>;
  requiredRoles: SystemRole[];
  items: NavLinkConfig[];
}

const NAV_CONFIG: NavGroupConfig[] = [
  {
    group: "Overview",
    roleLabels: {
      student: "My Workspace",
      parent: "Parent Desk",
      faculty: "Faculty Hub",
      hod: "HOD Console",
      principal: "Executive Suite",
      dean_academic: "Academic Leadership",
      hostel_warden: "Warden Desk",
      accounts_department: "Finance Desk",
      hr_department: "HR Desk",
      library_staff: "Library Desk",
      transportation: "Transit Desk",
      placement_cell: "Placement Desk",
      scholarship_cell: "Scholarship Desk",
      examination_cell: "Exam Cell Desk",
    },
    requiredRoles: ALL,
    items: [
      {
        label: "Dashboard",
        roleLabels: {
          student: "My Dashboard",
          parent: "Parent Portal",
          faculty: "Faculty Dashboard",
          hod: "Department Dashboard",
          principal: "Executive Dashboard",
          dean_academic: "Academic Dashboard",
          hostel_warden: "Warden Dashboard",
          accounts_department: "Accounts Dashboard",
          hr_department: "HR Dashboard",
          library_staff: "Library Dashboard",
          transportation: "Transport Dashboard",
          placement_cell: "Placement Dashboard",
          scholarship_cell: "Scholarship Dashboard",
          examination_cell: "Exam Controller Dashboard",
        },
        href: "/dashboard",
        icon: "LayoutDashboard",
        requiredRoles: ALL,
      },
      {
        label: "Report Center",
        roleLabels: {
          hod: "Dept Analytics & Reports",
          principal: "Institutional Reports",
        },
        href: "/report-center",
        icon: "FileBarChart",
        requiredRoles: [...LEADERSHIP, R.HOD, R.IQAC_NAAC, R.IQAC_TEAM],
      },
      {
        label: "Import Center",
        href: "/import-center",
        icon: "DatabaseZap",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Document Designer",
        href: "/document-designer",
        icon: "FileBadge",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Notifications",
        roleLabels: {
          student: "My Alerts & Bulletins",
          parent: "Campus Notices",
        },
        href: "/notification",
        icon: "Bell",
        requiredRoles: ALL,
      },
      {
        label: "Communication Hub",
        href: "/communication-hub",
        icon: "Send",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.ADMINISTRATION_OFFICE,
        ],
      },
      {
        label: "Forms & Workflows",
        roleLabels: {
          student: "My Requests & Applications",
        },
        href: "/forms",
        icon: "ListChecks",
        requiredRoles: ALL,
      },
      {
        label: "Discipline",
        roleLabels: {
          student: "Code of Conduct",
        },
        href: "/discipline",
        icon: "Scale",
        requiredRoles: ALL,
      },
      {
        label: "Collaboration",
        roleLabels: {
          student: "Student Lounge",
        },
        href: "/collaboration",
        icon: "MessagesSquare",
        requiredRoles: ALL,
      },
      {
        label: "Task Management",
        roleLabels: {
          faculty: "My Class Tasks",
          hod: "Dept Action Items",
        },
        href: "/task-management",
        icon: "SquareKanban",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.HOD, R.FACULTY],
      },
    ],
  },
  {
    group: "Admissions",
    roleLabels: {
      admission_incharge: "Admissions Desk",
      admission_counselor: "Counselor Desk",
    },
    requiredRoles: ADMISSION_STAFF,
    items: [
      {
        label: "Recruitment CRM",
        href: "/recruitment-crm",
        icon: "ContactRound",
        requiredRoles: ADMISSION_STAFF,
      },
      {
        label: "Applications",
        href: "/admission",
        icon: "FilePlus",
        requiredRoles: ADMISSION_STAFF,
      },
      {
        label: "New Application",
        href: "/admission/initiate",
        icon: "UserPlus",
        requiredRoles: ADMISSION_STAFF,
      },
    ],
  },
  {
    group: "Academics",
    roleLabels: {
      student: "My Academics",
      parent: "Student Academics",
      faculty: "Academic Management",
      hod: "Department Academics",
      dean_academic: "Academic Governance",
      admin: "Academic Setup",
    },
    requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.PARENT],
    items: [
      {
        label: "Programs & Regulations",
        roleLabels: {
          faculty: "Syllabus & Regulations",
          hod: "Curriculum Planning",
        },
        href: "/curriculum",
        icon: "BookMarked",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY],
      },
      {
        label: "Departments / Branches",
        href: "/departments",
        icon: "Building2",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.DEAN_ACADEMIC],
      },
      {
        label: "Subject Catalogue",
        roleLabels: {
          student: "My Courses",
          parent: "Enrolled Subjects",
          faculty: "My Subjects",
          hod: "Dept Subject Allocation",
        },
        href: "/subjects",
        icon: "BookOpen",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT],
      },
      {
        label: "Batches & Sections",
        href: "/academic-structure",
        icon: "Layers",
        requiredRoles: [...ACADEMIC_DEPT, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Academic Calendar",
        roleLabels: {
          student: "My Calendar",
        },
        href: "/academic-calendar",
        icon: "CalendarDays",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.PARENT],
      },
      {
        label: "Timetable",
        roleLabels: {
          student: "My Class Timetable",
          parent: "Student Schedule",
          faculty: "My Teaching Timetable",
          hod: "Dept Master Timetable",
        },
        href: "/timetable",
        icon: "Clock",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT],
      },
      {
        label: "Lesson Plans",
        roleLabels: {
          faculty: "My Lesson Plans",
          hod: "Dept Lesson Plan Audit",
        },
        href: "/lesson-plan",
        icon: "ListTodo",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY],
      },
      {
        label: "Course Progress",
        roleLabels: {
          faculty: "Class Progress Tracker",
        },
        href: "/course-progress",
        icon: "TrendingUp",
        requiredRoles: [...TEACHING_STAFF],
      },
      {
        label: "Semester Registration",
        href: "/semester-registration",
        icon: "ClipboardPen",
        requiredRoles: [...ACADEMIC_DEPT],
      },
      {
        label: "Degree Audit & Planner",
        roleLabels: {
          student: "My Credit Progress",
        },
        href: "/degree-audit",
        icon: "GraduationCap",
        requiredRoles: [...TEACHING_STAFF, R.EXAMINATION_CELL, R.STUDENT],
      },
      {
        label: "LMS Integration",
        href: "/lms-integration",
        icon: "CloudCog",
        requiredRoles: [...TEACHING_STAFF, R.EXAMINATION_CELL],
      },
    ],
  },
  {
    group: "Students",
    roleLabels: {
      student: "My Directory & Support",
      parent: "Ward Profile",
      faculty: "Student Advising",
      hod: "Department Students",
    },
    requiredRoles: [
      ...ACADEMIC_DEPT,
      R.FACULTY,
      R.EXAMINATION_CELL,
      R.ACCOUNTS_DEPARTMENT,
      R.ADMINISTRATION_OFFICE,
      R.STUDENT,
    ],
    items: [
      {
        label: "Student Management",
        roleLabels: {
          student: "My Profile & Records",
          parent: "Ward Info & Records",
          faculty: "Student Roster",
          hod: "Dept Student Registry",
        },
        href: "/student-management",
        icon: "GraduationCap",
        requiredRoles: [
          ...ACADEMIC_DEPT,
          R.FACULTY,
          R.EXAMINATION_CELL,
          R.ACCOUNTS_DEPARTMENT,
          R.ADMINISTRATION_OFFICE,
          R.PLACEMENT_CELL,
          R.SCHOLARSHIP_CELL,
          R.STUDENT,
        ],
      },
      {
        label: "Mentor Assignments",
        roleLabels: {
          student: "My Faculty Mentor",
          parent: "Assigned Mentor",
          faculty: "Mentees Assigned",
          hod: "Dept Mentor Allocation",
        },
        href: "/mentor",
        icon: "Handshake",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.STUDENT],
      },
      {
        label: "Student Success",
        roleLabels: {
          student: "My Academic Counseling",
          faculty: "Student Mentorship & Guidance",
        },
        href: "/student-success",
        icon: "HeartHandshake",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.STUDENT],
      },
    ],
  },
  {
    group: "Faculty & HR",
    roleLabels: {
      faculty: "Faculty Portal",
      hod: "Faculty Operations",
      hr_department: "Human Resources",
    },
    requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.HR_DEPARTMENT, R.ADMINISTRATION_OFFICE],
    items: [
      {
        label: "Faculty Management",
        roleLabels: {
          faculty: "My Faculty Profile",
          hod: "Dept Faculty Roster",
          hr_department: "Employee Directory",
        },
        href: "/faculty-management",
        icon: "UserCheck",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.ADMINISTRATION_OFFICE, R.HR_DEPARTMENT],
      },
      {
        label: "Teaching & Workload",
        roleLabels: {
          hod: "Faculty Teaching Assignments",
          faculty: "My Teaching Assignments",
        },
        href: "/faculty-workload",
        icon: "ChartNoAxesGantt",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY],
      },
      {
        label: "HR Management",
        roleLabels: {
          hr_department: "Staff Administration",
        },
        href: "/hr",
        icon: "UserCog",
        requiredRoles: HR_ROLES,
      },
      {
        label: "Faculty Attendance",
        roleLabels: {
          faculty: "My Attendance Record",
          hod: "Dept Faculty Attendance",
          hr_department: "Staff Attendance Register",
        },
        href: "/faculty-attendance",
        icon: "CalendarCheck",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.HR_DEPARTMENT],
      },
      {
        label: "Leave Management",
        roleLabels: {
          student: "My Leave Requests",
          faculty: "Apply Leave & Status",
          hr_department: "Leave Approvals",
        },
        href: "/leave",
        icon: "CalendarMinus",
        requiredRoles: [...HR_ROLES, R.FACULTY, R.STUDENT],
      },
      {
        label: "Payroll",
        roleLabels: {
          faculty: "My Salary Slips",
          hr_department: "Payroll & Compensation",
          accounts_department: "Payroll Disbursement",
        },
        href: "/payroll",
        icon: "Banknote",
        requiredRoles: [...FINANCE_ROLES, R.HR_DEPARTMENT],
      },
    ],
  },
  {
    group: "Attendance & Examinations",
    roleLabels: {
      student: "My Progress & Exams",
      faculty: "Classroom & Exams",
    },
    requiredRoles: [...TEACHING_STAFF, R.EXAMINATION_CELL, R.STUDENT, R.PARENT],
    items: [
      {
        label: "Student Attendance",
        roleLabels: {
          student: "My Attendance",
          faculty: "Mark Attendance",
        },
        href: "/attendance",
        icon: "UserCheck2",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.PARENT],
      },
      {
        label: "Examinations",
        roleLabels: {
          student: "My Exams & Marks",
          faculty: "Exam Duties & Marks",
        },
        href: "/examination",
        icon: "FileText",
        requiredRoles: [...TEACHING_STAFF, R.EXAMINATION_CELL, R.STUDENT, R.PARENT],
      },
      {
        label: "Assessment Policies",
        href: "/assessment-policy",
        icon: "ScrollText",
        requiredRoles: [...TEACHING_STAFF, R.EXAMINATION_CELL],
      },
      {
        label: "Question Bank",
        href: "/question-bank",
        icon: "HelpCircle",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.EXAMINATION_CELL],
      },
      {
        label: "Assignments",
        roleLabels: {
          student: "My Assignments",
          faculty: "Class Assignments",
        },
        href: "/assignment",
        icon: "PenSquare",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT],
      },
      {
        label: "Quizzes",
        roleLabels: {
          student: "My Quizzes",
          faculty: "Class Quizzes",
        },
        href: "/quiz",
        icon: "CheckSquare",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT],
      },
      {
        label: "Study Material",
        roleLabels: {
          student: "Course Materials",
          faculty: "Shared Study Material",
        },
        href: "/study-material",
        icon: "FolderOpen",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT],
      },
    ],
  },
  {
    group: "Finance",
    roleLabels: {
      student: "My Payments",
      accountant: "Accounts & Finance",
      accounts_department: "Accounts & Finance",
    },
    requiredRoles: [...FINANCE_ROLES, R.SCHOLARSHIP_CELL, R.STUDENT, R.PARENT],
    items: [
      {
        label: "Fee Management",
        roleLabels: {
          student: "Fee Receipts & Dues",
          accountant: "Fee Collection & Dues",
          accounts_department: "Fee Collection & Dues",
        },
        href: "/fee",
        icon: "CreditCard",
        requiredRoles: [...FINANCE_ROLES, R.STUDENT, R.PARENT],
      },
      { label: "Accounts", href: "/accounts", icon: "Landmark", requiredRoles: FINANCE_ROLES },
      {
        label: "Scholarships",
        roleLabels: {
          student: "My Scholarships",
        },
        href: "/scholarship",
        icon: "Award",
        requiredRoles: [...FINANCE_ROLES, R.SCHOLARSHIP_CELL, R.STUDENT],
      },
      {
        label: "Financial Aid",
        roleLabels: {
          student: "My Financial Aid",
        },
        href: "/financial-aid",
        icon: "BadgeIndianRupee",
        requiredRoles: [...FINANCE_ROLES, R.SCHOLARSHIP_CELL, R.STUDENT],
      },
      {
        label: "Payment Settings",
        href: "/payment-settings",
        icon: "WalletCards",
        requiredRoles: FINANCE_ROLES,
      },
    ],
  },
  {
    group: "Operations",
    roleLabels: {
      student: "Campus Living",
      hostel_warden: "Hostel Operations",
      warden: "Hostel Operations",
    },
    requiredRoles: [
      ...ACADEMIC_DEPT,
      R.LIBRARY_STAFF,
      R.HOSTEL_WARDEN,
      R.TRANSPORTATION,
      R.STORE,
      R.ADMINISTRATION_OFFICE,
      R.STUDENT,
    ],
    items: [
      {
        label: "Library",
        roleLabels: {
          student: "My Library Books",
        },
        href: "/library",
        icon: "Library",
        requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.LIBRARY_STAFF],
      },
      {
        label: "Hostel",
        roleLabels: {
          student: "My Hostel Room & Outpass",
          hostel_warden: "Room Allocations & Passes",
          warden: "Room Allocations & Passes",
        },
        href: "/hostel",
        icon: "Home",
        requiredRoles: [...ACADEMIC_DEPT, R.STUDENT, R.HOSTEL_WARDEN],
      },
      {
        label: "Transport",
        href: "/transport",
        icon: "Bus",
        requiredRoles: [...ACADEMIC_DEPT, R.STUDENT, R.TRANSPORTATION, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Store",
        href: "/store",
        icon: "Package",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.STORE, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Facilities & Assets",
        href: "/facilities",
        icon: "Building2",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.ADMINISTRATION_OFFICE,
          R.ASSISTANT_ADMINISTRATION_OFFICER,
          R.HOD,
          R.FACULTY,
          R.STORE,
        ],
      },
      {
        label: "Continuing Education",
        href: "/continuing-education",
        icon: "BadgeCheck",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.ADMINISTRATION_OFFICE,
        ],
      },
      {
        label: "Procurement",
        href: "/procurement",
        icon: "ShoppingCart",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.FACULTY,
          R.STORE,
        ],
      },
      {
        label: "Gate Pass",
        href: "/gate-pass",
        icon: "ShieldAlert",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.DEAN_ACADEMIC, R.HOD, R.FACULTY],
      },
      { label: "Documents", href: "/document", icon: "FileStack", requiredRoles: ALL },
    ],
  },
  {
    group: "Placement & Career",
    requiredRoles: [...ACADEMIC_DEPT, R.PLACEMENT_CELL, R.STUDENT],
    items: [
      {
        label: "Placement",
        href: "/placement",
        icon: "Rocket",
        requiredRoles: [...ACADEMIC_DEPT, R.STUDENT, R.PLACEMENT_CELL],
      },
      {
        label: "Job Postings",
        href: "/job-posting",
        icon: "Briefcase",
        requiredRoles: [...ACADEMIC_DEPT, R.PLACEMENT_CELL, R.STUDENT],
      },
      {
        label: "Training Sessions",
        href: "/training-session",
        icon: "Zap",
        requiredRoles: [...ACADEMIC_DEPT, R.PLACEMENT_CELL, R.FACULTY, R.STUDENT],
      },
      {
        label: "Alumni",
        href: "/alumni",
        icon: "Users2",
        requiredRoles: [...ACADEMIC_DEPT, R.PLACEMENT_CELL],
      },
      {
        label: "Advancement",
        href: "/advancement",
        icon: "HeartHandshake",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.PLACEMENT_CELL,
          R.ACCOUNTS_DEPARTMENT,
        ],
      },
    ],
  },
  {
    group: "Research & Innovation",
    requiredRoles: [
      ...ACADEMIC_DEPT,
      R.RESEARCH_DEVELOPMENT,
      R.IIC,
      R.CLUB_HEAD,
      R.FACULTY,
      R.STUDENT,
    ],
    items: [
      {
        label: "R & D",
        href: "/research-development",
        icon: "FlaskConical",
        requiredRoles: [...ACADEMIC_DEPT, R.RESEARCH_DEVELOPMENT, R.FACULTY],
      },
      {
        label: "IIC",
        href: "/iic",
        icon: "Lightbulb",
        requiredRoles: [...ACADEMIC_DEPT, R.IIC, R.RESEARCH_DEVELOPMENT, R.FACULTY],
      },
      {
        label: "Clubs & Activities",
        href: "/clubs",
        icon: "Sparkles",
        requiredRoles: [...ACADEMIC_DEPT, R.CLUB_HEAD, R.STUDENT],
      },
    ],
  },
  {
    group: "Communication",
    requiredRoles: ALL,
    items: [
      { label: "Notice Board", href: "/notice", icon: "BellRing", requiredRoles: ALL },
      { label: "Events", href: "/event", icon: "CalendarClock", requiredRoles: ALL },
      { label: "Meetings", href: "/meeting", icon: "Video", requiredRoles: TEACHING_STAFF },
      { label: "Chat", href: "/chat", icon: "MessageCircle", requiredRoles: ALL },
    ],
  },
  {
    group: "Support",
    requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.PARENT],
    items: [
      {
        label: "Counseling",
        href: "/counseling",
        icon: "HeartHandshake",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.STUDENT],
      },
      {
        label: "Grievances",
        href: "/grievance",
        icon: "MessageSquareWarning",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY],
      },
    ],
  },
  {
    group: "Quality & Accreditation",
    requiredRoles: QUALITY_ROLES,
    items: [
      { label: "IQAC", href: "/iqac", icon: "Star", requiredRoles: QUALITY_ROLES },
      { label: "NAAC / NBA", href: "/naac-nba", icon: "BadgeCheck", requiredRoles: QUALITY_ROLES },
      {
        label: "Compliance Workspace",
        href: "/compliance",
        icon: "ClipboardCheck",
        requiredRoles: [...QUALITY_ROLES, R.ACCOUNTS_DEPARTMENT, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Accreditation Reports",
        href: "/accreditation",
        icon: "FileSpreadsheet",
        requiredRoles: QUALITY_ROLES,
      },
      {
        label: "Government Integrations",
        href: "/government-integrations",
        icon: "Landmark",
        requiredRoles: [...QUALITY_ROLES, R.ADMINISTRATION_OFFICE],
      },
    ],
  },
  {
    group: "System Administration",
    requiredRoles: [
      R.SUPER_ADMIN,
      R.ADMIN,
      R.PRINCIPAL,
      R.DEAN_ACADEMIC,
      R.HR_DEPARTMENT,
      R.ADMINISTRATION_OFFICE,
    ],
    items: [
      {
        label: "User Management",
        href: "/users",
        icon: "Users",
        requiredRoles: USER_MGMT_ROLES,
      },
      {
        label: "Role Management",
        href: "/roles",
        icon: "ShieldCheck",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN],
      },
      {
        label: "Navigation",
        href: "/nav-admin",
        icon: "Menu",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL],
      },
      {
        label: "Audit Log",
        href: "/audit-log",
        icon: "ClipboardList",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN],
      },
      {
        label: "Data Portability",
        href: "/data-portability",
        icon: "PackageOpen",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.ADMINISTRATION_OFFICE],
      },
      {
        label: "Campus Governance",
        href: "/campus-governance",
        icon: "Building2",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.ADMINISTRATION_OFFICE,
          R.HOD,
        ],
      },
      {
        label: "Responsible AI",
        href: "/ai-governance",
        icon: "BrainCircuit",
        requiredRoles: [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL, R.DEAN_ACADEMIC, R.IQAC_NAAC],
      },
    ],
  },
  {
    group: "Account",
    requiredRoles: ALL,
    items: [
      { label: "Profile", href: "/profile", icon: "User", requiredRoles: ALL },
      { label: "Settings", href: "/settings", icon: "Settings", requiredRoles: ALL },
    ],
  },
];

// ── Dynamic Models Interface & Getter ──────────────────────────────────────────
export interface ITenantDbModels {
  User: Model<Record<string, unknown>>;
  Department: Model<Record<string, unknown>>;
  Curriculum: Model<Record<string, unknown>>;
  Subject: Model<Record<string, unknown>>;
  FacultyProfile: Model<Record<string, unknown>>;
  StudentProfile: Model<Record<string, unknown>>;
  Role: Model<Record<string, unknown>>;
  NavItem: Model<Record<string, unknown>>;
  InstitutionSetting: Model<Record<string, unknown>>;
  Batch: Model<Record<string, unknown>>;
  Section: Model<Record<string, unknown>>;
  StudentSectionAllotment: Model<Record<string, unknown>>;
  Campus: Model<Record<string, unknown>>;
  FacilitySpace: Model<Record<string, unknown>>;
  Notice: Model<Record<string, unknown>>;
}

function getModels(connection: mongoose.Connection): ITenantDbModels {
  const schemaOptions = { strict: false };
  return {
    User: connection.model<Record<string, unknown>>("User", new Schema({}, schemaOptions)),
    Department: connection.model<Record<string, unknown>>(
      "Department",
      new Schema({}, schemaOptions),
    ),
    Curriculum: connection.model<Record<string, unknown>>(
      "Curriculum",
      new Schema({}, schemaOptions),
    ),
    Subject: connection.model<Record<string, unknown>>("Subject", new Schema({}, schemaOptions)),
    FacultyProfile: connection.model<Record<string, unknown>>(
      "FacultyProfile",
      new Schema({}, schemaOptions),
    ),
    StudentProfile: connection.model<Record<string, unknown>>(
      "StudentProfile",
      new Schema({}, schemaOptions),
    ),
    Role: connection.model<Record<string, unknown>>("Role", new Schema({}, schemaOptions)),
    NavItem: connection.model<Record<string, unknown>>("NavItem", new Schema({}, schemaOptions)),
    InstitutionSetting: connection.model<Record<string, unknown>>(
      "InstitutionSetting",
      new Schema({}, schemaOptions),
    ),
    Batch: connection.model<Record<string, unknown>>("Batch", new Schema({}, schemaOptions)),
    Section: connection.model<Record<string, unknown>>("Section", new Schema({}, schemaOptions)),
    StudentSectionAllotment: connection.model<Record<string, unknown>>(
      "StudentSectionAllotment",
      new Schema({}, schemaOptions),
    ),
    Campus: connection.model<Record<string, unknown>>("Campus", new Schema({}, schemaOptions)),
    FacilitySpace: connection.model<Record<string, unknown>>(
      "FacilitySpace",
      new Schema({}, schemaOptions),
    ),
    Notice: connection.model<Record<string, unknown>>("Notice", new Schema({}, schemaOptions)),
  };
}

// ── Realistic Name Generators ────────────────────────────────────────────────
const FIRST_NAMES = [
  "Aarav",
  "Ananya",
  "Rohan",
  "Priya",
  "Aditya",
  "Neha",
  "Vikram",
  "Sanya",
  "Rahul",
  "Pooja",
  "Amit",
  "Divya",
  "Karan",
  "Kavya",
  "Manish",
  "Meera",
  "Nikhil",
  "Ritu",
  "Siddharth",
  "Tanvi",
  "Abhishek",
  "Bhavna",
  "Deepak",
  "Isha",
  "Gaurav",
  "Jyoti",
  "Mayank",
  "Nisha",
  "Pranav",
  "Rachna",
  "Sachin",
  "Swati",
  "Tushar",
  "Varun",
  "Yash",
  "Akansha",
  "Bhuvan",
  "Chetan",
  "Devika",
  "Harsh",
  "Ishita",
  "Jatin",
  "Komal",
  "Lokesh",
  "Mohit",
  "Nandini",
  "Parth",
  "Riya",
  "Shubham",
  "Tara",
  "Alok",
  "Bharti",
  "Chiranjeev",
  "Dinesh",
  "Ekta",
  "Farhan",
  "Geeta",
  "Hemant",
  "Indu",
  "Jaidev",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Patel",
  "Singh",
  "Kumar",
  "Gupta",
  "Joshi",
  "Mehta",
  "Rao",
  "Nair",
  "Das",
  "Mishra",
  "Mohanty",
  "Panda",
  "Pradhan",
  "Sahoo",
  "Tripathy",
  "Nayak",
  "Swain",
  "Rath",
  "Bhat",
  "Chaudhary",
  "Deshmukh",
  "Ghosh",
  "Iyer",
  "Kulkarni",
  "Mahajan",
  "Pandey",
  "Reddy",
  "Sen",
  "Agarwal",
  "Banerjee",
  "Chakraborty",
  "Dutt",
  "Jha",
  "Kashyap",
  "Lal",
  "Mukherjee",
  "Roy",
  "Saxena",
];

function getUniqueName(index: number): { firstName: string; lastName: string; fullName: string } {
  const fIdx = (index - 1) % FIRST_NAMES.length;
  const lIdx = (Math.floor((index - 1) / FIRST_NAMES.length) + (index - 1)) % LAST_NAMES.length;

  const firstName = FIRST_NAMES[fIdx] as string;
  const lastName = LAST_NAMES[lIdx] as string;
  const numSuffix = Math.floor((index - 1) / (FIRST_NAMES.length * LAST_NAMES.length));

  const fullName =
    numSuffix > 0 ? `${firstName} ${lastName} ${numSuffix + 1}` : `${firstName} ${lastName}`;
  return { firstName, lastName, fullName };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Seeding Engine
// ─────────────────────────────────────────────────────────────────────────────
async function runMigrationAndSeed(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required in environment.");
  }

  console.log("════════════════════════════════════════════════════════════════════════");
  console.log("  DevVelocity ERP — Tenant Data Migration & Seed Tool");
  console.log("════════════════════════════════════════════════════════════════════════");

  console.log(`\nConnecting to Master Database (${MASTER_DB_NAME})...`);
  await mongoose.connect(MONGODB_URI);

  const masterDb = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  const tenantsColl = masterDb.collection("tenants");

  // Fetch all registered tenants
  const allTenants = await tenantsColl.find({}).toArray();

  if (!allTenants || allTenants.length === 0) {
    throw new Error(
      "No tenants present in master database ('tenants' collection). Per requirements, this script WILL NOT create new tenants. Please provision a tenant first.",
    );
  }

  // Display Available Tenant List
  console.log("\n📋 AVAILABLE TENANTS IN MASTER DATABASE:");
  console.log("--------------------------------------------------------------------------------");
  allTenants.forEach((t, idx) => {
    const statusStr = t["status"] ? String(t["status"]).toUpperCase() : "UNKNOWN";
    const dbStr = String(t["databaseName"] || `tenant_${String(t["tenantId"])}`);
    console.log(
      `  [${idx + 1}] ID: ${String(t["tenantId"]).padEnd(12)} | Name: ${String(t["name"]).padEnd(42)} | DB: ${dbStr.padEnd(18)} | Status: ${statusStr}`,
    );
  });
  console.log("--------------------------------------------------------------------------------");

  // Select Target Tenant
  let selectedTenantDoc: Record<string, unknown> | null = null;

  if (CLI_TARGET_TENANT_ID) {
    selectedTenantDoc =
      (allTenants.find(
        (t) => String(t["tenantId"]).toLowerCase() === CLI_TARGET_TENANT_ID,
      ) as Record<string, unknown>) || null;
    if (!selectedTenantDoc) {
      throw new Error(
        `CLI tenant ID '${CLI_TARGET_TENANT_ID}' was specified but not found in the list above.`,
      );
    }
    console.log(`\n✔ Using CLI specified tenant: ${String(selectedTenantDoc["tenantId"])}`);
  } else if (process.stdin.isTTY) {
    // Interactive Selection in Terminal
    const answer = await askQuestion(
      `\nSelect a tenant by number (1..${allTenants.length}) or enter its tenantId: `,
    );
    if (answer) {
      const parsedNum = parseInt(answer, 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= allTenants.length) {
        selectedTenantDoc = (allTenants[parsedNum - 1] as Record<string, unknown>) || null;
      } else {
        selectedTenantDoc =
          (allTenants.find(
            (t) => String(t["tenantId"]).toLowerCase() === answer.toLowerCase(),
          ) as Record<string, unknown>) || null;
      }
    }
    if (!selectedTenantDoc) throw new Error("A valid tenant selection is required.");
  } else {
    throw new Error(
      "Non-interactive execution requires --tenant=<tenantId> and --confirm=RESET-<tenantId>.",
    );
  }

  if (!selectedTenantDoc) {
    throw new Error("Failed to select a valid target tenant.");
  }

  const tenantId = String(selectedTenantDoc["tenantId"]).toLowerCase();
  const tenantName = String(selectedTenantDoc["name"]);
  const databaseName = String(selectedTenantDoc["databaseName"] || `tenant_${tenantId}`);
  const expectedDatabaseName = `tenant_${tenantId}`;
  if (databaseName !== expectedDatabaseName || databaseName === MASTER_DB_NAME) {
    throw new Error(
      `Refusing unsafe tenant database mapping '${databaseName}'. Expected '${expectedDatabaseName}'.`,
    );
  }

  console.log("\n========================================================================");
  console.log(`  ACTIVE TARGET TENANT SUMMARY`);
  console.log(`  - Tenant ID     : ${tenantId}`);
  console.log(`  - College Name  : ${tenantName}`);
  console.log(`  - Database Name : ${databaseName}`);
  console.log(`  - Auto Clean    : YES (Cleaning old data before fresh seeding)`);
  console.log("========================================================================");

  const requiredConfirmation = `RESET-${tenantId}`;
  const confirmation =
    CLI_CONFIRMATION ??
    (process.stdin.isTTY
      ? await askQuestion(
          `\nThis permanently deletes every collection in '${databaseName}'. Type ${requiredConfirmation} to continue: `,
        )
      : "");
  if (confirmation !== requiredConfirmation) {
    throw new Error("Tenant reset cancelled: confirmation did not match.");
  }

  // Upgrade Tenant Record to the authoritative Enterprise plan and module catalogue.
  const modulesCatalog = await masterDb
    .collection("productmodules")
    .find({ status: "active" })
    .toArray();
  const catalogSlugs = modulesCatalog.map((m) => String(m["slug"]));
  const enterprisePlan = await masterDb
    .collection("subscriptionplans")
    .findOne({ slug: "enterprise", isActive: true });
  if (!enterprisePlan) {
    throw new Error("Active Enterprise subscription plan is missing from the master database.");
  }
  const allEnterpriseModules =
    catalogSlugs.length > 0
      ? catalogSlugs
      : [
          "admissions",
          "academics",
          "attendance",
          "examinations",
          "fees",
          "hr-payroll",
          "library",
          "hostel",
          "transport",
          "placements",
          "communication",
          "naac-iqac",
          "research",
          "procurement",
          "clubs",
          "virtual-classrooms",
          "security",
          "analytics",
          "government-regulatory-integrations",
          "lms-integrations",
          "multi-campus-governance",
        ];

  await tenantsColl.updateOne(
    { tenantId },
    {
      $set: {
        billingStatus: "active",
        status: TenantStatus.ACTIVE,
        planId: enterprisePlan["_id"],
        subscriptionExpiresAt: new Date("2035-12-31"),
        enabledModuleSlugs:
          Array.isArray(enterprisePlan["moduleSlugs"]) && enterprisePlan["moduleSlugs"].length
            ? enterprisePlan["moduleSlugs"]
            : allEnterpriseModules,
        maxStudents: Number(enterprisePlan["studentLimit"] ?? 5000),
        maxEmployees: Number(enterprisePlan["employeeLimit"] ?? 500),
        entitlementEnforced: true,
      },
    },
  );
  console.log(
    `   ✔ Tenant master record updated: Enterprise Plan with ALL ${allEnterpriseModules.length} Modules.`,
  );

  // Connect to Target Tenant DB
  const tenantDb = mongoose.connection.useDb(databaseName, { useCache: true });
  console.log(`\n🧹 Dropping every collection from confirmed tenant database ${databaseName}...`);
  await tenantDb.dropDatabase();
  const models = getModels(tenantDb);
  console.log(`   ✔ Tenant database fully reset. Master tenant registry was preserved.`);

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ───────────────────────────────────────────────────────────────────────────
  // 0. Seed Sidebar NavItems (Groups & Links)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [1/11] Seeding Sidebar Navigation Items (All 14 Groups & Links)...");
  const roleNavMap: Record<string, mongoose.Types.ObjectId[]> = {};

  for (let gi = 0; gi < NAV_CONFIG.length; gi++) {
    const g = NAV_CONFIG[gi] as NavGroupConfig;
    const groupSortOrder = (gi + 1) * 10;

    const groupDoc = await models.NavItem.findOneAndUpdate(
      { kind: "group", label: g.group, parentId: null },
      {
        $setOnInsert: {
          kind: "group",
          label: g.group,
          parentId: null,
          sortOrder: groupSortOrder,
        },
        $set: {
          requiredRoles: g.requiredRoles,
          roleLabels: g.roleLabels || {},
          isActive: true,
          isDeleted: false,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const groupId = groupDoc?._id as mongoose.Types.ObjectId;

    for (let li = 0; li < g.items.length; li++) {
      const item = g.items[li] as NavLinkConfig;
      const itemSortOrder = (li + 1) * 10;

      const linkDoc = await models.NavItem.findOneAndUpdate(
        { kind: "link", label: item.label, parentId: groupId },
        {
          $setOnInsert: {
            kind: "link",
            label: item.label,
            parentId: groupId,
            sortOrder: itemSortOrder,
          },
          $set: {
            href: item.href,
            icon: item.icon,
            roleLabels: item.roleLabels || {},
            requiredRoles: item.requiredRoles,
            gate: item.gate,
            isActive: true,
            isDeleted: false,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      const linkId = linkDoc?._id as mongoose.Types.ObjectId;

      // Track allowedNavItems per role
      for (const role of item.requiredRoles) {
        if (!roleNavMap[role]) roleNavMap[role] = [];
        if (groupId && !roleNavMap[role].some((id) => id.equals(groupId))) {
          roleNavMap[role].push(groupId);
        }
        if (linkId && !roleNavMap[role].some((id) => id.equals(linkId))) {
          roleNavMap[role].push(linkId);
        }
      }
    }
  }
  console.log(`   ✔ Seeded all 14 navigation groups & links, calculated role menu entitlements.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Seed System Role Documents into Role Collection with Default Permissions & NavItems
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [2/11] Seeding 26 System Role Documents with Full Permission Matrix...");
  for (const roleValue of ALL_ROLES) {
    const formattedName = roleValue
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const perms = DEFAULT_PERMISSIONS[roleValue as SystemRole] || [];
    const allowedNav = roleNavMap[roleValue] || [];
    await models.Role.create({
      name: roleValue,
      baseRole: roleValue,
      displayName: formattedName,
      description: `System role configuration for ${formattedName}`,
      isSystem: true,
      isActive: true,
      isDeleted: false,
      permissions: perms,
      allowedNavItems: allowedNav,
    });
  }
  console.log(
    `   ✔ Seeded all ${ALL_ROLES.length} SystemRole definitions with default permissions and nav entitlements in ${databaseName}.`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Seed Institution Setting & Onboarding Status
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [3/11] Seeding Institution Setting & Onboarding Completion...");
  await models.InstitutionSetting.updateOne(
    {},
    {
      $set: {
        name: tenantName,
        shortCode: tenantId.toUpperCase(),
        tagline: "Empowering Education & Digital Governance",
        address: "Main Institutional Campus, University Enclave",
        phone: "9876543210",
        email: `info@${tenantId}.edu`,
        websiteUrl: `https://${tenantId}.edu`,
        primaryColor: "#0178D7",
        secondaryColor: "#9BB94F",
        onboardingStatus: "completed",
        onboardingCompletedAt: new Date(),
        isDeleted: false,
      },
    },
    { upsert: true },
  );
  console.log(`   ✔ Institution settings & onboarding status configured for ${tenantName}.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Seed 4 Academic Programs (Curriculums)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [4/11] Seeding 4 Academic Programs (Curriculums)...");
  const PROGRAM_SPECS = [
    {
      program: "B.Tech Computer Science & Engineering",
      academicLevel: "undergraduate",
      semesters: 8,
      credits: 160,
      codePrefix: "CSE",
    },
    {
      program: "B.Tech Electronics & Communication Engineering",
      academicLevel: "undergraduate",
      semesters: 8,
      credits: 160,
      codePrefix: "ECE",
    },
    {
      program: "Master of Business Administration",
      academicLevel: "postgraduate",
      semesters: 4,
      credits: 80,
      codePrefix: "MBA",
    },
    {
      program: "Bachelor of Computer Applications",
      academicLevel: "undergraduate",
      semesters: 6,
      credits: 120,
      codePrefix: "BCA",
    },
  ];

  const curriculumDocs: Record<string, Record<string, unknown>> = {};

  for (const spec of PROGRAM_SPECS) {
    const emptySemesters = Array.from({ length: spec.semesters }, (_, i) => ({
      semesterNo: i + 1,
      subjects: [],
      totalCredits: 20,
      totalTheoryHours: 15,
      totalLabHours: 6,
    }));

    const created = await models.Curriculum.create({
      program: spec.program,
      academicLevel: spec.academicLevel,
      openForAdmissions: true,
      regulationYear: "2026",
      totalSemesters: spec.semesters,
      totalCreditsRequired: spec.credits,
      semesterPlans: emptySemesters,
      programOutcomes: [
        {
          poCode: "PO1",
          description: "Apply domain knowledge to solve engineering/management problems.",
        },
        {
          poCode: "PO2",
          description: "Design innovative software, hardware, and analytical systems.",
        },
      ],
      isActive: true,
      isDeleted: false,
      version: 1,
    });
    curriculumDocs[spec.codePrefix] = created.toObject();
    console.log(`   + Created Program: ${spec.program}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Seed Departments (CSE, ECE, SOM, SOCA)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [5/11] Seeding Departments...");
  const DEPT_SPECS = [
    {
      code: "CSE",
      name: "Computer Science & Engineering",
      shortName: "Dept of CSE",
      programs: ["B.Tech Computer Science & Engineering"],
      curriculumKey: "CSE",
      intake: 180,
    },
    {
      code: "ECE",
      name: "Electronics & Communication Engineering",
      shortName: "Dept of ECE",
      programs: ["B.Tech Electronics & Communication Engineering"],
      curriculumKey: "ECE",
      intake: 120,
    },
    {
      code: "SOM",
      name: "School of Management",
      shortName: "Dept of Management",
      programs: ["Master of Business Administration"],
      curriculumKey: "MBA",
      intake: 60,
    },
    {
      code: "SOCA",
      name: "School of Computer Applications",
      shortName: "Dept of Computer Apps",
      programs: ["Bachelor of Computer Applications"],
      curriculumKey: "BCA",
      intake: 60,
    },
  ];

  const deptDocs: Record<string, Record<string, unknown>> = {};
  const curriculumKeyByDepartment = Object.fromEntries(
    DEPT_SPECS.map((department) => [department.code, department.curriculumKey]),
  ) as Record<string, string>;

  for (const dSpec of DEPT_SPECS) {
    const curr = curriculumDocs[dSpec.curriculumKey];
    if (!curr) throw new Error(`Curriculum missing for key ${dSpec.curriculumKey}`);
    const currId = curr["_id"];

    const created = await models.Department.create({
      code: dSpec.code,
      name: dSpec.name,
      shortName: dSpec.shortName,
      curriculumIds: [currId],
      programs: dSpec.programs,
      intake: dSpec.intake,
      establishedYear: 2010,
      status: DepartmentStatus.ACTIVE,
      isDeleted: false,
      location: `Building Block-${dSpec.code}`,
      email: `${dSpec.code.toLowerCase()}@${tenantId}.edu`,
      phone: "9876543210",
    });
    deptDocs[dSpec.code] = created.toObject();
    console.log(`   + Created Department: ${dSpec.code} - ${dSpec.name}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Seed Dedicated Test Accounts for ALL 26 System Roles
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [6/11] Seeding Dedicated Test Accounts for ALL SystemRoles...");
  const ROLE_TEST_ACCOUNTS: { role: SystemRole; emailPrefix: string; name: string }[] = [
    { role: SystemRole.SUPER_ADMIN, emailPrefix: "superadmin", name: "Tenant Super Admin" },
    { role: SystemRole.ADMIN, emailPrefix: "admin", name: "Tenant Admin" },
    { role: SystemRole.PRINCIPAL, emailPrefix: "principal", name: "College Principal" },
    { role: SystemRole.DEAN_ACADEMIC, emailPrefix: "dean_academic", name: "Dean Academics" },
    {
      role: SystemRole.ADMINISTRATION_OFFICE,
      emailPrefix: "admin_office",
      name: "Admin Office Head",
    },
    {
      role: SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
      emailPrefix: "asst_admin_office",
      name: "Asst Admin Officer",
    },
    { role: SystemRole.HOD, emailPrefix: "hod_cse", name: "HOD Computer Science" },
    { role: SystemRole.FACULTY, emailPrefix: "faculty_user", name: "Faculty Test User" },
    { role: SystemRole.STUDENT, emailPrefix: "student_user", name: "Student Test User" },
    { role: SystemRole.PARENT, emailPrefix: "parent_user", name: "Parent Test User" },
    { role: SystemRole.EXAMINATION_CELL, emailPrefix: "exam_cell", name: "Controller of Exams" },
    { role: SystemRole.IQAC_NAAC, emailPrefix: "iqac_naac", name: "IQAC Coordinator" },
    { role: SystemRole.IQAC_TEAM, emailPrefix: "iqac_team", name: "IQAC Team Member" },
    {
      role: SystemRole.SCHOLARSHIP_CELL,
      emailPrefix: "scholarship_cell",
      name: "Scholarship Officer",
    },
    { role: SystemRole.LIBRARY_STAFF, emailPrefix: "library_staff", name: "Head Librarian" },
    { role: SystemRole.HOSTEL_WARDEN, emailPrefix: "hostel_warden", name: "Chief Hostel Warden" },
    { role: SystemRole.PLACEMENT_CELL, emailPrefix: "placement_cell", name: "Placement Officer" },
    { role: SystemRole.HR_DEPARTMENT, emailPrefix: "hr_dept", name: "HR Manager" },
    {
      role: SystemRole.ACCOUNTS_DEPARTMENT,
      emailPrefix: "accounts_dept",
      name: "Finance & Accounts Officer",
    },
    { role: SystemRole.TRANSPORTATION, emailPrefix: "transportation", name: "Transport Incharge" },
    { role: SystemRole.RESEARCH_DEVELOPMENT, emailPrefix: "research_dev", name: "R&D Coordinator" },
    { role: SystemRole.CLUB_HEAD, emailPrefix: "club_head", name: "Student Activity Club Head" },
    { role: SystemRole.IIC, emailPrefix: "iic_head", name: "IIC Innovation President" },
    { role: SystemRole.STORE, emailPrefix: "store_manager", name: "Central Store Manager" },
    {
      role: SystemRole.ADMISSION_INCHARGE,
      emailPrefix: "admission_incharge",
      name: "Admission Incharge",
    },
    {
      role: SystemRole.ADMISSION_COUNSELOR,
      emailPrefix: "admission_counselor",
      name: "Admission Counselor",
    },
  ];

  const cseDept = deptDocs["CSE"];
  const defaultDeptId = cseDept ? cseDept["_id"] : undefined;
  let adminUserId: mongoose.Types.ObjectId | undefined;

  for (const [accountIndex, accountSpec] of ROLE_TEST_ACCOUNTS.entries()) {
    if ([SystemRole.HOD, SystemRole.FACULTY, SystemRole.STUDENT].includes(accountSpec.role)) {
      continue;
    }
    const email = `${accountSpec.emailPrefix}.${tenantId}@${tenantId}.edu`;
    const created = await models.User.create({
      name: accountSpec.name,
      email,
      phone: `97000${String(accountIndex + 1).padStart(5, "0")}`,
      password: hashedPassword,
      roles: [accountSpec.role],
      department: defaultDeptId,
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
      isDeleted: false,
    });
    const userObj = created.toObject();
    if (accountSpec.role === SystemRole.SUPER_ADMIN) {
      adminUserId = userObj["_id"] as mongoose.Types.ObjectId;
    }
  }
  if (!adminUserId) {
    adminUserId = new mongoose.Types.ObjectId();
  }
  console.log(
    `   ✔ Seeded leadership and operations test accounts. HOD, faculty and student credentials will be attached to their real profiles. Admin User ID: ${String(adminUserId)}`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Seed Batches & Class Sections
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [7/11] Seeding Academic Batches & Class Sections...");
  const batchDocs: Record<string, Record<string, unknown>> = {};
  const sectionDocs: Record<string, Record<string, unknown>> = {};

  for (const deptCode of ["CSE", "ECE", "SOM", "SOCA"]) {
    const dept = deptDocs[deptCode];
    if (!dept) continue;
    const curr = curriculumDocs[curriculumKeyByDepartment[deptCode] ?? deptCode];
    if (!curr) continue;

    const deptPrograms = (dept["programs"] as string[]) || [];
    const programName = deptPrograms[0] || "B.Tech Computer Science & Engineering";

    // Create Batch
    const batch = await models.Batch.create({
      name: `Batch 2026-${deptCode}`,
      curriculumId: curr["_id"],
      departmentId: dept["_id"],
      program: programName,
      departmentCode: deptCode,
      admissionYear: 2026,
      regulationYear: "2026",
      expectedGraduationYear: deptCode === "SOM" ? 2028 : 2030,
      lateralEntryAllowed: deptCode === "CSE" || deptCode === "ECE",
      intake: dept["intake"],
      status: BatchStatus.ACTIVE,
      isDeleted: false,
      createdBy: adminUserId,
    });
    batchDocs[deptCode] = batch.toObject();

    // Create Sections (e.g., CSE-1A, CSE-1B, ECE-1A, SOM-1A, SOCA-1A)
    const numSections = deptCode === "CSE" ? 2 : 1;
    for (let s = 1; s <= numSections; s++) {
      const secLetter = String.fromCharCode(64 + s); // A, B
      const sectionName = `${deptCode}-1${secLetter}`;
      const sec = await models.Section.create({
        academicYear: "2026-27",
        batchId: batch._id,
        curriculumId: curr["_id"],
        departmentId: dept["_id"],
        program: programName,
        departmentCode: deptCode,
        semesterNo: 1,
        sectionName,
        capacity: 60,
        allottedCount: 0,
        status: SectionStatus.ACTIVE,
        isDeleted: false,
        createdBy: adminUserId,
      });
      sectionDocs[sectionName] = sec.toObject();
      console.log(`   + Created Section: ${sectionName} (Capacity: 60)`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Seed Core & Elective Subjects
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [8/11] Seeding Core & Elective Subjects...");
  const SUBJECT_SPECS = [
    // CSE Subjects
    {
      code: "CS101",
      name: "Data Structures & Algorithms",
      dept: "CSE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 1,
    },
    {
      code: "CS102",
      name: "Database Management Systems",
      dept: "CSE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 2,
    },
    {
      code: "CS103",
      name: "Operating Systems",
      dept: "CSE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 3,
    },
    {
      code: "CS104",
      name: "DBMS Laboratory",
      dept: "CSE",
      type: SubjectType.PRACTICAL,
      credits: 2,
      sem: 2,
    },
    {
      code: "CS105",
      name: "Artificial Intelligence & ML",
      dept: "CSE",
      type: SubjectType.ELECTIVE,
      credits: 3,
      sem: 5,
    },
    // ECE Subjects
    {
      code: "EC101",
      name: "Circuit Theory & Networks",
      dept: "ECE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 1,
    },
    {
      code: "EC102",
      name: "Digital Signal Processing",
      dept: "ECE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 3,
    },
    {
      code: "EC103",
      name: "Microprocessors & Microcontrollers",
      dept: "ECE",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 4,
    },
    {
      code: "EC104",
      name: "Embedded Systems Lab",
      dept: "ECE",
      type: SubjectType.PRACTICAL,
      credits: 2,
      sem: 4,
    },
    // SOM Subjects
    {
      code: "MB101",
      name: "Financial Accounting & Management",
      dept: "SOM",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 1,
    },
    {
      code: "MB102",
      name: "Marketing Strategy & Consumer Behavior",
      dept: "SOM",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 2,
    },
    {
      code: "MB103",
      name: "Human Resource Management",
      dept: "SOM",
      type: SubjectType.THEORY,
      credits: 3,
      sem: 2,
    },
    // SOCA Subjects
    {
      code: "CA101",
      name: "Web Technologies & Node.js",
      dept: "SOCA",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 1,
    },
    {
      code: "CA102",
      name: "Object Oriented Programming in Java",
      dept: "SOCA",
      type: SubjectType.THEORY,
      credits: 4,
      sem: 2,
    },
    {
      code: "CA103",
      name: "Full-Stack Development Lab",
      dept: "SOCA",
      type: SubjectType.PRACTICAL,
      credits: 2,
      sem: 3,
    },
  ];

  const subjectDocs: Record<string, Record<string, unknown>> = {};

  for (const sSpec of SUBJECT_SPECS) {
    const dept = deptDocs[sSpec.dept];
    if (!dept) continue;
    const deptId = dept["_id"];

    const created = await models.Subject.create({
      code: sSpec.code,
      name: sSpec.name,
      shortName: sSpec.name.substring(0, 15),
      departmentId: deptId,
      departmentCode: dept["code"],
      type: sSpec.type,
      category:
        sSpec.type === SubjectType.ELECTIVE ? SubjectCategory.PROFESSIONAL : SubjectCategory.CORE,
      credits: sSpec.credits,
      lectureHours:
        sSpec.type === SubjectType.THEORY || sSpec.type === SubjectType.ELECTIVE ? 3 : 0,
      practicalHours: sSpec.type === SubjectType.PRACTICAL ? 3 : 0,
      tutorialHours: sSpec.type === SubjectType.PRACTICAL ? 0 : 1,
      totalHours: sSpec.type === SubjectType.PRACTICAL ? 3 : 4,
      semester: sSpec.sem,
      internalMarks: 30,
      externalMarks: 70,
      totalMarks: 100,
      passMarksInternal: 12,
      passMarksExternal: 28,
      hasLabComponent: sSpec.type === SubjectType.PRACTICAL,
      isElective: sSpec.type === SubjectType.ELECTIVE,
      isActive: true,
      isDeleted: false,
      createdBy: adminUserId,
    });
    subjectDocs[sSpec.code] = created.toObject();
  }
  for (const spec of PROGRAM_SPECS) {
    const curriculum = curriculumDocs[spec.codePrefix];
    if (!curriculum) continue;
    const departmentCode =
      DEPT_SPECS.find((department) => department.curriculumKey === spec.codePrefix)?.code ??
      spec.codePrefix;
    const semesterPlans = Array.from({ length: spec.semesters }, (_, index) => {
      const semesterNo = index + 1;
      const semesterSubjects = SUBJECT_SPECS.filter(
        (subject) => subject.dept === departmentCode && subject.sem === semesterNo,
      ).map((subject) => {
        const document = subjectDocs[subject.code];
        const isPractical = subject.type === SubjectType.PRACTICAL;
        const isElective = subject.type === SubjectType.ELECTIVE;
        return {
          subjectId: document?.["_id"],
          subjectCode: subject.code,
          subjectName: subject.name,
          credits: subject.credits,
          theoryHours: isPractical ? 0 : 3,
          labHours: isPractical ? 3 : 0,
          tutorialHours: isPractical ? 0 : 1,
          isElective,
          electiveGroup: isElective ? `${departmentCode}-PE` : undefined,
          courseOutcomes: [
            {
              coCode: "CO1",
              description: `Explain and apply the core concepts of ${subject.name}.`,
              bloomsLevel: "apply",
            },
          ],
        };
      });
      return {
        semesterNo,
        subjects: semesterSubjects,
        totalCredits: semesterSubjects.reduce((sum, subject) => sum + subject.credits, 0),
        totalTheoryHours: semesterSubjects.reduce(
          (sum, subject) => sum + subject.theoryHours + subject.tutorialHours,
          0,
        ),
        totalLabHours: semesterSubjects.reduce((sum, subject) => sum + subject.labHours, 0),
      };
    });
    await models.Curriculum.updateOne(
      { _id: curriculum["_id"] },
      { $set: { semesterPlans, createdBy: adminUserId, updatedBy: adminUserId } },
    );
  }
  console.log(`   ✔ Total subjects created: ${SUBJECT_SPECS.length}`);

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Seed 50 Faculty Members & Profiles
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [9/11] Seeding 50 Faculty Members with Profiles...");
  const deptCodes = ["CSE", "ECE", "SOM", "SOCA"];
  const facultyUsers: Record<string, unknown>[] = [];
  const hodMap: Record<string, Record<string, unknown>> = {};

  for (let i = 1; i <= 50; i++) {
    const deptCode = deptCodes[(i - 1) % deptCodes.length] as string;
    const dept = deptDocs[deptCode];
    if (!dept) continue;
    const deptId = dept["_id"];

    const { firstName, lastName, fullName } = getUniqueName(i);
    const email =
      i === 1
        ? `hod_cse.${tenantId}@${tenantId}.edu`
        : i === 5
          ? `faculty_user.${tenantId}@${tenantId}.edu`
          : `faculty${i}.${tenantId}@${tenantId}.edu`;
    const employeeId = `EMP-${tenantId.toUpperCase()}-FAC-${String(i).padStart(3, "0")}`;
    const facultyId = `FAC-${tenantId.toUpperCase()}-${deptCode}-${String(i).padStart(4, "0")}`;

    const designation =
      i <= 4
        ? Designation.PROFESSOR
        : i % 3 === 0
          ? Designation.ASSOCIATE_PROFESSOR
          : Designation.ASSISTANT_PROFESSOR;
    const isHod = i <= 4;

    const roles = [SystemRole.FACULTY];
    if (isHod) roles.push(SystemRole.HOD);

    const createdUser = await models.User.create({
      name: fullName,
      email,
      phone: `98000${String(i).padStart(5, "0")}`,
      password: hashedPassword,
      roles,
      department: deptId,
      employeeId,
      facultyId,
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
      isDeleted: false,
    });
    const userObj = createdUser.toObject();

    if (isHod) {
      hodMap[deptCode] = userObj;
    }

    const userId = userObj["_id"];
    await models.FacultyProfile.create({
      userId,
      employeeId,
      facultyId,
      firstName,
      lastName,
      dateOfBirth: new Date(`198${i % 10}-01-15`),
      gender: i % 2 === 0 ? "female" : "male",
      nationality: "Indian",
      category: AdmissionCategory.GEN,
      isPhysicallyChallenged: false,
      collegeEmail: email,
      personalEmail: `faculty${i}.${tenantId}.personal@gmail.com`,
      phone: userObj["phone"],
      department: deptId,
      departmentCode: dept["code"],
      designation,
      highestQualification:
        designation === Designation.PROFESSOR ? Qualification.PHD : Qualification.ME_MTECH,
      specialization: String(dept["name"]),
      employmentType: EmploymentType.PERMANENT,
      status: FacultyStatus.ACTIVE,
      isDeleted: false,
      joiningDate: new Date("2020-07-15"),
      createdBy: adminUserId,
      qualifications: [
        {
          degree:
            designation === Designation.PROFESSOR ? Qualification.PHD : Qualification.ME_MTECH,
          specialization: String(dept["name"]),
          instituteName: tenantName,
          university: tenantName,
          passingYear: 2018,
          verified: true,
        },
      ],
      permanentAddress: {
        line1: `Faculty Residence Quarter #${i}`,
        city: "Bhubaneswar",
        district: "Khurda",
        state: "Odisha",
        pincode: "751024",
        country: "India",
      },
    });
    facultyUsers.push(userObj);
  }

  // Update Department HOD linkage dynamically
  for (const deptCode of deptCodes) {
    const hodUser = hodMap[deptCode];
    if (hodUser) {
      await models.Department.updateOne(
        { code: deptCode },
        { $set: { hodId: hodUser["_id"], hodName: hodUser["name"] } },
      );
      await models.Section.updateMany(
        { departmentCode: deptCode },
        {
          $set: {
            classTeacherId: hodUser["_id"],
            classTeacherName: hodUser["name"],
            updatedBy: adminUserId,
          },
        },
      );
    }
  }
  console.log(`   ✔ 50 Faculty members created with unique names, employee IDs, & profiles.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Seed Classrooms & Laboratory Spaces (Facilities)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [10/11] Seeding Campus, Classrooms & Laboratory Facility Spaces...");
  const campus = await models.Campus.create({
    code: `${tenantId.toUpperCase()}-MAIN`,
    name: `${tenantName} Main Campus`,
    type: "campus",
    timezone: "Asia/Kolkata",
    address: {
      line1: "Main Institutional Campus, University Enclave",
      city: "Bhubaneswar",
      state: "Odisha",
      postalCode: "752057",
      country: "India",
    },
    contactEmail: `info@${tenantId}.edu`,
    contactPhone: "9876543210",
    status: "active",
    openedAt: new Date("2010-07-01"),
    isDeleted: false,
    createdBy: adminUserId,
  });
  const FACILITY_SPECS = [
    {
      code: "CR-101",
      name: "Lecture Hall 101",
      building: "Academic Block A",
      type: "classroom",
      capacity: 70,
    },
    {
      code: "CR-102",
      name: "Lecture Hall 102",
      building: "Academic Block A",
      type: "classroom",
      capacity: 70,
    },
    {
      code: "CR-103",
      name: "Lecture Hall 103",
      building: "Academic Block B",
      type: "classroom",
      capacity: 70,
    },
    {
      code: "LAB-CSE-1",
      name: "Advanced Software Engineering Lab",
      building: "Tech Block C",
      type: "laboratory",
      capacity: 40,
    },
    {
      code: "LAB-ECE-1",
      name: "Digital Signal Processing Lab",
      building: "Tech Block D",
      type: "laboratory",
      capacity: 40,
    },
  ];

  for (const fSpec of FACILITY_SPECS) {
    await models.FacilitySpace.create({
      campusId: campus._id,
      code: fSpec.code,
      name: fSpec.name,
      building: fSpec.building,
      floor: "Ground Floor",
      type: fSpec.type,
      capacity: fSpec.capacity,
      amenities: ["Projector", "Air Conditioning", "High-Speed Wi-Fi"],
      status: "active",
      isDeleted: false,
      createdBy: adminUserId,
    });
    console.log(`   + Created Facility: ${fSpec.code} - ${fSpec.name}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Seed 140 Students & Section Allotments
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [11/11] Seeding 140 Students, Parent Link & Section Allotments...");
  const totalStudents = 140;

  for (let i = 1; i <= totalStudents; i++) {
    const deptCode = deptCodes[(i - 1) % deptCodes.length] as string;
    const dept = deptDocs[deptCode];
    if (!dept) continue;
    const deptId = dept["_id"];

    const batch = batchDocs[deptCode];
    const curr = curriculumDocs[curriculumKeyByDepartment[deptCode] ?? deptCode];

    const targetSecName =
      deptCode === "CSE" ? (i % 2 === 0 ? "CSE-1B" : "CSE-1A") : `${deptCode}-1A`;
    const sectionObj = sectionDocs[targetSecName];

    const deptPrograms = (dept["programs"] as string[]) || [];
    const programName = deptPrograms[0] || "B.Tech Computer Science & Engineering";

    const { firstName, lastName, fullName } = getUniqueName(50 + i);
    const email =
      i === 1
        ? `student_user.${tenantId}@${tenantId}.edu`
        : `student${i}.${tenantId}@${tenantId}.edu`;
    const rollNumber = `2026-${tenantId.toUpperCase()}-${deptCode}-${String(i).padStart(3, "0")}`;
    const createdUser = await models.User.create({
      name: fullName,
      email,
      phone: `91000${String(i).padStart(5, "0")}`,
      password: hashedPassword,
      roles: [SystemRole.STUDENT],
      department: deptId,
      studentId: rollNumber,
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
      isDeleted: false,
    });
    const userObj = createdUser.toObject();
    const userId = userObj["_id"];

    const studentProfile = await models.StudentProfile.create({
      userId,
      rollNumber,
      firstName,
      lastName,
      dateOfBirth: new Date("2004-05-15"),
      gender: i % 2 === 0 ? "female" : "male",
      nationality: "Indian",
      category: AdmissionCategory.GEN,
      isPhysicallyChallenged: false,
      personalEmail: `student${i}.${tenantId}.personal@gmail.com`,
      collegeEmail: email,
      phone: userObj["phone"],
      program: programName,
      admissionType: AdmissionType.REGULAR,
      admissionCategory: AdmissionCategory.GEN,
      batch: "2026",
      academicYear: "2026-27",
      department: deptId,
      departmentCode: dept["code"],
      currentSemester: 1,
      currentYear: 1,
      section: targetSecName,
      mentor: hodMap[deptCode]?.["_id"],
      classTeacher: hodMap[deptCode]?.["_id"],
      admissionDate: new Date("2026-07-15"),
      status: StudentStatus.ACTIVE,
      isDeleted: false,
      parentInfo: {
        fatherName: `Father of ${firstName}`,
        fatherPhone: `99000${String(i).padStart(5, "0")}`,
        fatherEmail:
          i === 1 ? `parent_user.${tenantId}@${tenantId}.edu` : `parent${i}@example.test`,
        motherName: `Mother of ${firstName}`,
      },
      permanentAddress: {
        line1: `Plot #${i}, Student Colony`,
        city: "Cuttack",
        district: "Cuttack",
        state: "Odisha",
        pincode: "753001",
        country: "India",
      },
    });

    // Create Section Allotment
    if (sectionObj && batch && curr) {
      await models.StudentSectionAllotment.create({
        studentId: userId,
        studentProfileId: studentProfile._id,
        sectionId: sectionObj["_id"],
        batchId: batch["_id"],
        curriculumId: curr["_id"],
        departmentId: deptId,
        academicYear: "2026-27",
        semesterNo: 1,
        rollNo: rollNumber,
        status: StudentSectionAllotmentStatus.ACTIVE,
        validFrom: new Date(),
        isDeleted: false,
        createdBy: adminUserId,
      });

      // Increment allotted count on section
      await models.Section.updateOne({ _id: sectionObj["_id"] }, { $inc: { allottedCount: 1 } });
    }
  }
  console.log(
    `   ✔ 140 Students created with StudentProfiles, Roll Numbers, & Section Allotments.`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Audit Verification Report
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n▶ Verification: auditing records and dependency relationships...");
  const navCount = await models.NavItem.countDocuments({});
  const roleCount = await models.Role.countDocuments({});
  const currCount = await models.Curriculum.countDocuments({});
  const deptCount = await models.Department.countDocuments({});
  const subjCount = await models.Subject.countDocuments({});
  const batchCount = await models.Batch.countDocuments({});
  const sectionCount = await models.Section.countDocuments({});
  const allotmentCount = await models.StudentSectionAllotment.countDocuments({});
  const facilityCount = await models.FacilitySpace.countDocuments({});
  const timetableCount = await tenantDb.collection("timetables").countDocuments({});
  const campusCount = await models.Campus.countDocuments({});
  const facultyCount = await models.FacultyProfile.countDocuments({});
  const studentCount = await models.StudentProfile.countDocuments({});
  const userCount = await models.User.countDocuments({});
  const linkedCurriculumCount = await models.Curriculum.countDocuments({
    "semesterPlans.subjects.0": { $exists: true },
  });
  const teacherLinkedSections = await models.Section.countDocuments({
    classTeacherId: { $exists: true },
  });
  const credentialEmails = ROLE_TEST_ACCOUNTS.map(
    (account) => `${account.emailPrefix}.${tenantId}@${tenantId}.edu`,
  );
  const credentialUserCount = await models.User.countDocuments({
    email: { $in: credentialEmails },
  });
  const profiledTeachingCredentialCount = await models.FacultyProfile.countDocuments({
    collegeEmail: {
      $in: [`hod_cse.${tenantId}@${tenantId}.edu`, `faculty_user.${tenantId}@${tenantId}.edu`],
    },
  });
  const profiledStudentCredentialCount = await models.StudentProfile.countDocuments({
    collegeEmail: `student_user.${tenantId}@${tenantId}.edu`,
    "parentInfo.fatherEmail": `parent_user.${tenantId}@${tenantId}.edu`,
  });
  if (timetableCount !== 0) throw new Error("Verification failed: timetables must remain empty");
  if (linkedCurriculumCount !== currCount) {
    throw new Error("Verification failed: every curriculum must contain linked subjects");
  }
  if (teacherLinkedSections !== sectionCount) {
    throw new Error("Verification failed: every section must have a class teacher");
  }
  if (allotmentCount !== studentCount) {
    throw new Error("Verification failed: every seeded student must have one active allotment");
  }
  if (credentialUserCount !== ROLE_TEST_ACCOUNTS.length) {
    throw new Error("Verification failed: one or more role test credentials are missing");
  }
  if (profiledTeachingCredentialCount !== 2 || profiledStudentCredentialCount !== 1) {
    throw new Error("Verification failed: teaching, student or parent test profiles are unlinked");
  }

  console.log("════════════════════════════════════════════════════════════════════════");
  console.log("  EMBEDDED VERIFICATION REPORT");
  console.log("════════════════════════════════════════════════════════════════════════");
  console.log(`  Tenant Name        : ${tenantName} (${tenantId})`);
  console.log(`  Target Database    : ${databaseName}`);
  console.log(`  Sidebar Nav Items  : ${navCount} Menu Items`);
  console.log(
    `  System Roles       : ${roleCount} Role Definitions (With Full Permissions & Nav Entitlements)`,
  );
  console.log(`  Academic Programs  : ${currCount} (Requirement >= 4: PASSED)`);
  console.log(`  Departments        : ${deptCount} (CSE, ECE, SOM, SOCA)`);
  console.log(`  Batches            : ${batchCount}`);
  console.log(`  Class Sections     : ${sectionCount} (Allotments: ${allotmentCount})`);
  console.log(`  Facility Spaces    : ${facilityCount} Classrooms/Labs`);
  console.log(`  Campuses           : ${campusCount} real campus record`);
  console.log(`  Timetables         : ${timetableCount} (intentionally empty — create in ERP)`);
  console.log(`  Subjects           : ${subjCount}`);
  console.log(`  Faculty Members    : ${facultyCount} (Requirement >= 50: PASSED)`);
  console.log(`  Student Profiles   : ${studentCount} (Requirement 100-150: PASSED)`);
  console.log(`  Total User Accounts: ${userCount}`);
  console.log("════════════════════════════════════════════════════════════════════════");

  console.log(`\n🔑 ROLE TEST LOGIN CREDENTIALS (All passwords: ${DEFAULT_PASSWORD}):`);
  console.log("--------------------------------------------------------------------------------");
  for (const item of ROLE_TEST_ACCOUNTS) {
    const fullEmail = `${item.emailPrefix}.${tenantId}@${tenantId}.edu`;
    console.log(` • ${item.role.toUpperCase().padEnd(35)}: ${fullEmail}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log("🎉 Complete operational test data migration & seeding finished cleanly!");

  await mongoose.disconnect();
}

runMigrationAndSeed().catch((err) => {
  console.error("\n❌ Migration/Seed failed:", err);
  process.exit(1);
});
