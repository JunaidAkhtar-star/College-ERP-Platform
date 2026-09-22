/**
 * @file seed.ts
 * @description Single consolidated seed script for the Devvelocity ERP backend.
 * Idempotent — safe to re-run. Replaces the prior set of split seed scripts
 * (seed-fresh, seed-nav, seed-roles, seed-admission-test).
 *
 * Seeds, in order:
 *   1. NavItems         (sidebar groups + links, scoped per role)
 *   2. Roles            (one Role doc per SystemRole with defaults)
 *   3. Departments      (B.Tech branches + MBA + MCA + Diploma + BSH)
 *   4. Super Admin user (env-driven credentials)
 *   5. One user per other system role (dev / QA convenience)
 *
 * Run:
 *   pnpm --filter backend exec ts-node server/scripts/seed.ts
 *   pnpm --filter backend exec ts-node server/scripts/seed.ts --force
 *
 * Flags:
 *   --force   Overwrite role permissions / allowedNavItems back to defaults.
 *             Without this, custom edits made via the Roles admin UI are
 *             preserved.
 *
 * Env:
 *   MONGODB_URI          (required)
 *   SEED_ADMIN_EMAIL     (required)
 *   SEED_ADMIN_PASS      (required)
 *   SEED_ADMIN_NAME      (default: Super Admin)
 *   SEED_ADMIN_PHONE     (default: 9999999999)
 */

import "dotenv/config";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { NavItemModel } from "../models/nav-item.model";
import { RoleModel } from "../models/role.model";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { CurriculumModel } from "../models/curriculum.model";
import { UserModel } from "../models/user.model";
import { InstitutionSettingModel } from "../models/institution-setting.model";

import { ALL_ROLES, EMPLOYEE_ROLES, SystemRole } from "../constants/roles";
import {
  DEFAULT_PERMISSIONS,
  DISPLAY_NAMES,
  mergeMissingDefaultPermissions,
} from "../constants/role-defaults";

// ─────────────────────────────────────────────────────────────────────────────
// Env + flags
// ─────────────────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env["MONGODB_URI"] ?? "";
const MONGODB_DB_NAME = process.env["MONGODB_DB_NAME"];
const FORCE = process.argv.includes("--force");

const ADMIN_EMAIL = process.env["SEED_ADMIN_EMAIL"] ?? "";
const ADMIN_PASS = process.env["SEED_ADMIN_PASS"] ?? "";
const REQUIRE_ADMIN_PASSWORD_CHANGE = process.env["SEED_REQUIRE_PASSWORD_CHANGE"] === "true";
const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "Tenant Super Administrator";
const INSTITUTION_NAME = process.env["SEED_INSTITUTION_NAME"] ?? "Institution setup required";
const ADMIN_PHONE = process.env["SEED_ADMIN_PHONE"] ?? "";
const SEED_CORE_CURRICULA = process.env["SEED_CORE_CURRICULA"] === "true";
const SKIP_ADMIN = process.env["SEED_SKIP_ADMIN"] === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Role groupings — used by nav config
// ─────────────────────────────────────────────────────────────────────────────

const R = SystemRole;
const ALL = ALL_ROLES;

// ─────────────────────────────────────────────────────────────────────────────
// Role buckets — used by nav config. Each bucket models a *business audience*,
// not a permissions tier. Keep these small and specific so each role only sees
// what it actually needs in the sidebar.
// ─────────────────────────────────────────────────────────────────────────────

/** Top-tier system / institution leadership. */
const LEADERSHIP: SystemRole[] = [R.SUPER_ADMIN, R.ADMIN, R.PRINCIPAL];

/** Academic decision-making chain (dean joins leadership). */
const ACADEMIC_LEADERSHIP: SystemRole[] = [...LEADERSHIP, R.DEAN_ACADEMIC];

/** Department-aware staff (HOD joins academic leadership). */
const ACADEMIC_DEPT: SystemRole[] = [...ACADEMIC_LEADERSHIP, R.HOD];

/** Everyone who teaches / runs academic operations. */
const TEACHING_STAFF: SystemRole[] = [...ACADEMIC_DEPT, R.FACULTY];

/** Admissions handlers — AO/AOO/incharge/counselor + leadership. */
const ADMISSION_STAFF: SystemRole[] = [
  R.SUPER_ADMIN,
  R.ADMIN,
  R.ADMINISTRATION_OFFICE,
  R.ASSISTANT_ADMINISTRATION_OFFICER,
  R.ADMISSION_INCHARGE,
  R.ADMISSION_COUNSELOR,
];

/** Finance handlers — Accounts + AO (read-only via permissions) + leadership. */
const FINANCE_ROLES: SystemRole[] = [...LEADERSHIP, R.ACCOUNTS_DEPARTMENT, R.ADMINISTRATION_OFFICE];

/** HR handlers — HR dept + AO (read-only) + leadership. */
const HR_ROLES: SystemRole[] = [...LEADERSHIP, R.HR_DEPARTMENT, R.ADMINISTRATION_OFFICE];

/** Quality / accreditation cell. */
const QUALITY_ROLES: SystemRole[] = [...ACADEMIC_LEADERSHIP, R.IQAC_NAAC, R.IQAC_TEAM];

/** Roles allowed to see the global "User Management" admin page. */
const USER_MGMT_ROLES: SystemRole[] = [
  R.SUPER_ADMIN,
  R.ADMIN,
  R.PRINCIPAL,
  R.ADMINISTRATION_OFFICE,
];

// ─────────────────────────────────────────────────────────────────────────────
// Nav config — flat group → items model (matches NavItemModel)
// ─────────────────────────────────────────────────────────────────────────────

interface NavLink {
  label: string;
  roleLabels?: Record<string, string>;
  href: string;
  icon: string;
  requiredRoles: SystemRole[];
  gate?: string;
}
interface NavGroup {
  group: string;
  roleLabels?: Record<string, string>;
  requiredRoles: SystemRole[];
  items: NavLink[];
}

const NAV: NavGroup[] = [
  // ── Overview ────────────────────────────────────────────────────────────────
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
          faculty: "Staff Requisitions",
        },
        href: "/forms",
        icon: "ListChecks",
        requiredRoles: [...EMPLOYEE_ROLES, R.STUDENT],
      },
      {
        label: "Discipline",
        roleLabels: {
          student: "Code of Conduct",
          faculty: "Student Conduct & Incident Log",
        },
        href: "/discipline",
        icon: "Scale",
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.FACULTY, R.STUDENT],
      },
      {
        label: "Collaboration",
        roleLabels: {
          student: "Student Lounge",
          faculty: "Faculty Exchange",
        },
        href: "/collaboration",
        icon: "MessagesSquare",
        requiredRoles: [...EMPLOYEE_ROLES, R.STUDENT],
      },
      {
        label: "Task Management",
        roleLabels: {
          faculty: "My Class Tasks",
          hod: "Dept Action Items",
          student: "My Study Tasks",
        },
        href: "/task-management",
        icon: "SquareKanban",
        requiredRoles: [
          R.SUPER_ADMIN,
          R.ADMIN,
          R.PRINCIPAL,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.FACULTY,
          R.STUDENT,
        ],
      },
    ],
  },

  // ── Admissions ──────────────────────────────────────────────────────────────
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

  // ── Academics ───────────────────────────────────────────────────────────────
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

  // ── Students ────────────────────────────────────────────────────────────────
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

  // ── Faculty & HR ────────────────────────────────────────────────────────────
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

  // ── Attendance & Examinations ───────────────────────────────────────────────
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

  // ── Finance ─────────────────────────────────────────────────────────────────
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

  // ── Operations ──────────────────────────────────────────────────────────────
  {
    group: "Operations",
    roleLabels: {
      student: "Campus Living",
      hostel_warden: "Hostel Operations",
      warden: "Hostel Operations",
    },
    requiredRoles: [
      ...LEADERSHIP,
      R.DEAN_ACADEMIC,
      R.HOD,
      R.FACULTY,
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
        requiredRoles: [...LEADERSHIP, R.HOSTEL_WARDEN, R.STUDENT],
      },
      {
        label: "Transport",
        href: "/transport",
        icon: "Bus",
        requiredRoles: [...LEADERSHIP, R.TRANSPORTATION, R.ADMINISTRATION_OFFICE, R.STUDENT],
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
        requiredRoles: [
          ...LEADERSHIP,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.FACULTY,
          R.HOSTEL_WARDEN,
          R.STUDENT,
        ],
      },
      { label: "Documents", href: "/document", icon: "FileStack", requiredRoles: ALL },
    ],
  },

  // ── Placement & Career ──────────────────────────────────────────────────────
  {
    group: "Placement & Career",
    requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.PLACEMENT_CELL, R.STUDENT],
    items: [
      {
        label: "Placement",
        href: "/placement",
        icon: "Rocket",
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.STUDENT, R.PLACEMENT_CELL],
      },
      {
        label: "Job Postings",
        href: "/job-posting",
        icon: "Briefcase",
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.PLACEMENT_CELL, R.STUDENT],
      },
      {
        label: "Training Sessions",
        href: "/training-session",
        icon: "Zap",
        requiredRoles: [
          ...LEADERSHIP,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.PLACEMENT_CELL,
          R.FACULTY,
          R.STUDENT,
        ],
      },
      {
        label: "Alumni",
        href: "/alumni",
        icon: "Users2",
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.PLACEMENT_CELL],
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

  // ── Research & Innovation ───────────────────────────────────────────────────
  {
    group: "Research & Innovation",
    requiredRoles: [
      ...LEADERSHIP,
      R.DEAN_ACADEMIC,
      R.HOD,
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
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.RESEARCH_DEVELOPMENT, R.FACULTY],
      },
      {
        label: "IIC",
        href: "/iic",
        icon: "Lightbulb",
        requiredRoles: [
          ...LEADERSHIP,
          R.DEAN_ACADEMIC,
          R.HOD,
          R.IIC,
          R.RESEARCH_DEVELOPMENT,
          R.FACULTY,
        ],
      },
      {
        label: "Clubs & Activities",
        href: "/clubs",
        icon: "Sparkles",
        requiredRoles: [...LEADERSHIP, R.DEAN_ACADEMIC, R.HOD, R.CLUB_HEAD, R.STUDENT],
      },
    ],
  },

  // ── Communication ───────────────────────────────────────────────────────────
  {
    group: "Communication",
    requiredRoles: ALL,
    items: [
      { label: "Notice Board", href: "/notice", icon: "BellRing", requiredRoles: ALL },
      { label: "Events", href: "/event", icon: "CalendarClock", requiredRoles: ALL },
      { label: "Meetings", href: "/meeting", icon: "Video", requiredRoles: [...EMPLOYEE_ROLES] },
      { label: "Chat", href: "/chat", icon: "MessageCircle", requiredRoles: ALL },
    ],
  },

  // ── Support ─────────────────────────────────────────────────────────────────
  {
    group: "Support",
    requiredRoles: [...TEACHING_STAFF, R.STUDENT, R.PARENT, R.ADMISSION_COUNSELOR],
    items: [
      {
        label: "Counseling",
        href: "/counseling",
        icon: "HeartHandshake",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.ADMISSION_COUNSELOR, R.STUDENT],
      },
      {
        label: "Grievances",
        href: "/grievance",
        icon: "MessageSquareWarning",
        requiredRoles: [...ACADEMIC_DEPT, R.FACULTY, R.STUDENT],
      },
    ],
  },

  // ── Quality & Accreditation ─────────────────────────────────────────────────
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

  // ── Parents' Corner ─────────────────────────────────────────────────────────
  {
    group: "Parents' Corner",
    requiredRoles: [R.PARENT],
    items: [
      { label: "Ward's Profile", href: "/parent/ward", icon: "Baby", requiredRoles: [R.PARENT] },
      {
        label: "Attendance",
        href: "/parent/attendance",
        icon: "CalendarCheck2",
        requiredRoles: [R.PARENT],
      },
      { label: "Fee Status", href: "/parent/fees", icon: "Receipt", requiredRoles: [R.PARENT] },
      { label: "Results", href: "/parent/results", icon: "BarChart2", requiredRoles: [R.PARENT] },
    ],
  },

  // ── System Administration ───────────────────────────────────────────────────
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

  // ── Account ─────────────────────────────────────────────────────────────────
  {
    group: "Account",
    requiredRoles: ALL,
    items: [
      { label: "Profile", href: "/profile", icon: "User", requiredRoles: ALL },
      { label: "Settings", href: "/settings", icon: "Settings", requiredRoles: ALL },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Departments — full catalogue (B.Tech branches + PG + Diploma + service dept)
// ─────────────────────────────────────────────────────────────────────────────

interface DeptSeed {
  code: string;
  name: string;
  shortName: string;
  programs: string[];
  intake: number;
  establishedYear: number;
}

const DEPARTMENTS: DeptSeed[] = [
  // ── Engineering branches (UG + PG) ──
  {
    code: "CSE",
    name: "Computer Science Engineering",
    shortName: "CSE",
    programs: ["B.Tech", "M.Tech"],
    intake: 120,
    establishedYear: 2001,
  },
  {
    code: "ECE",
    name: "Electronics & Communication",
    shortName: "ECE",
    programs: ["B.Tech", "M.Tech"],
    intake: 60,
    establishedYear: 2001,
  },
  {
    code: "ME",
    name: "Mechanical Engineering",
    shortName: "ME",
    programs: ["B.Tech", "M.Tech"],
    intake: 60,
    establishedYear: 2001,
  },
  {
    code: "CE",
    name: "Civil Engineering",
    shortName: "CE",
    programs: ["B.Tech", "M.Tech"],
    intake: 60,
    establishedYear: 2003,
  },
  {
    code: "EE",
    name: "Electrical Engineering",
    shortName: "EE",
    programs: ["B.Tech", "M.Tech"],
    intake: 60,
    establishedYear: 2005,
  },

  // ── Management / Computer applications ──
  {
    code: "MBA",
    name: "MBA",
    shortName: "MBA",
    programs: ["MBA"],
    intake: 60,
    establishedYear: 2010,
  },
  {
    code: "MCA",
    name: "MCA",
    shortName: "MCA",
    programs: ["MCA"],
    intake: 60,
    establishedYear: 2012,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Per-role demo users — one user per SystemRole (Super Admin handled separately)
// ─────────────────────────────────────────────────────────────────────────────

async function seedNav(): Promise<void> {
  console.log("\n▶  nav items");
  let groupsInserted = 0;
  let linksInserted = 0;
  let touched = 0;

  const activeIds: mongoose.Types.ObjectId[] = [];

  for (let gi = 0; gi < NAV.length; gi++) {
    const g = NAV[gi];
    const groupSortOrder = (gi + 1) * 10;

    const groupDoc = await NavItemModel.findOneAndUpdate(
      { kind: "group", label: g.group, parentId: null },
      {
        $setOnInsert: {
          kind: "group",
          label: g.group,
          parentId: null,
          sortOrder: groupSortOrder,
        },
        $set: { requiredRoles: g.requiredRoles, roleLabels: g.roleLabels || {}, isActive: true },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (groupDoc) {
      activeIds.push(groupDoc._id as mongoose.Types.ObjectId);
      if (groupDoc.createdAt?.getTime() === groupDoc.updatedAt?.getTime()) {
        groupsInserted++;
      } else {
        touched++;
      }
    }

    for (let li = 0; li < g.items.length; li++) {
      const item = g.items[li];
      const itemSortOrder = (li + 1) * 10;

      const before = await NavItemModel.findOne({
        kind: "link",
        label: item.label,
        parentId: groupDoc?._id,
      });

      const linkDoc = await NavItemModel.findOneAndUpdate(
        { kind: "link", label: item.label, parentId: groupDoc?._id },
        {
          $setOnInsert: {
            kind: "link",
            label: item.label,
            parentId: groupDoc?._id,
            sortOrder: itemSortOrder,
          },
          $set: {
            href: item.href,
            icon: item.icon,
            roleLabels: item.roleLabels || {},
            requiredRoles: item.requiredRoles,
            gate: item.gate,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      if (linkDoc) {
        activeIds.push(linkDoc._id as mongoose.Types.ObjectId);
      }

      if (!before) linksInserted++;
      else touched++;
    }
  }

  const deactivateResult = await NavItemModel.updateMany(
    { _id: { $nin: activeIds } },
    { $set: { isActive: false } },
  );
  console.log(`   Deactivated ${deactivateResult.modifiedCount} obsolete nav items.`);

  console.log(
    `   groups inserted=${groupsInserted}  links inserted=${linksInserted}  updated=${touched}`,
  );
}

async function deriveAllowedNavItems(roleName: SystemRole): Promise<Types.ObjectId[]> {
  const matching = await NavItemModel.find({ isActive: true, requiredRoles: roleName })
    .select("_id parentId kind")
    .lean();

  const navIdSet = new Set<string>();
  matching.forEach((item) => {
    navIdSet.add(String(item._id));
    if (item.parentId) {
      navIdSet.add(String(item.parentId));
    }
  });

  return Array.from(navIdSet).map((id) => new mongoose.Types.ObjectId(id));
}

async function seedRoles(): Promise<void> {
  console.log("\n▶  roles");
  let created = 0;
  let updated = 0;

  for (const roleName of ALL_ROLES) {
    const existing = await RoleModel.findOne({ name: roleName });
    const navIds = await deriveAllowedNavItems(roleName);
    const defaults = {
      name: roleName,
      baseRole: roleName,
      displayName: DISPLAY_NAMES[roleName],
      description: `System role: ${DISPLAY_NAMES[roleName]}`,
      permissions: DEFAULT_PERMISSIONS[roleName],
      allowedNavItems: navIds,
      isSystem: true,
      isActive: true,
    };

    if (!existing) {
      await RoleModel.create(defaults);
      created++;
      console.log(`   + ${roleName.padEnd(36)} (${navIds.length} nav items)`);
      continue;
    }

    const patch: Record<string, unknown> = {
      isSystem: true,
      baseRole: roleName,
      displayName: defaults.displayName,
    };
    patch["permissions"] =
      FORCE || !existing.permissions?.length
        ? defaults.permissions
        : mergeMissingDefaultPermissions(existing.permissions, defaults.permissions);
    if (FORCE || !existing.allowedNavItems?.length) {
      patch["allowedNavItems"] = navIds;
    } else {
      // Preserve tenant additions while appending navigation introduced by a
      // newer release. Without this, upgraded tenants can be left with only
      // the few menu ids that existed when their role was first seeded.
      const existingIds = new Set(existing.allowedNavItems.map((id) => String(id)));
      patch["allowedNavItems"] = [
        ...existing.allowedNavItems,
        ...navIds.filter((id) => !existingIds.has(String(id))),
      ];
    }

    await RoleModel.updateOne({ _id: existing._id }, { $set: patch });
    updated++;
  }

  console.log(`   created=${created}  updated=${updated}  force=${FORCE}`);
}

async function _seedDepartments(): Promise<void> {
  console.log("\n▶  departments");
  let created = 0;
  let patched = 0;

  const firstCurr = await CurriculumModel.findOne();
  const defaultCurriculumIds = firstCurr ? [firstCurr._id] : [];

  for (const d of DEPARTMENTS) {
    const existing = await DepartmentModel.findOne({ code: d.code });
    if (!existing) {
      if (!defaultCurriculumIds.length) {
        throw new Error(
          "No curriculum found to seed department. Make sure seedCurriculum runs first.",
        );
      }
      await DepartmentModel.create({
        code: d.code,
        name: d.name,
        shortName: d.shortName,
        curriculumIds: defaultCurriculumIds,
        programs: [firstCurr?.program || "B.Tech"],
        intake: d.intake,
        establishedYear: d.establishedYear,
        status: DepartmentStatus.ACTIVE,
      });
      created++;
      console.log(`   + ${d.code.padEnd(10)} ${d.name}`);
      continue;
    }

    // Always sync name / shortName / intake from seed; curricula are selected
    // from the Curriculum master and are not hardcoded here.
    await DepartmentModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: d.name,
          shortName: d.shortName,
          intake: d.intake,
        },
      },
    );
    patched++;
  }

  console.log(`   created=${created}  patched=${patched}  total=${DEPARTMENTS.length}`);
}

// ─────────────────────────────────────────────────────────────────────
// Curriculum — optional core course/program masters. Departments select from
// Curriculum records; by default seed does not create curricula so the UI stays
// empty until an admin creates them.
// ─────────────────────────────────────────────────────────────────────

const CURRICULUM_REGULATION_YEAR =
  process.env["SEED_CURRICULUM_REGULATION_YEAR"] ?? String(new Date().getFullYear());

const PROGRAM_SEMESTERS: Record<
  string,
  {
    semesters: number;
    credits: number;
    academicLevel: "diploma" | "undergraduate" | "postgraduate";
  }
> = {
  "B.Tech": { semesters: 8, credits: 160, academicLevel: "undergraduate" },
  "M.Tech": { semesters: 4, credits: 80, academicLevel: "postgraduate" },
  MBA: { semesters: 4, credits: 90, academicLevel: "postgraduate" },
  MCA: { semesters: 4, credits: 80, academicLevel: "postgraduate" },
  Diploma: { semesters: 6, credits: 120, academicLevel: "diploma" },
};

async function _seedCurriculum(): Promise<void> {
  console.log("\n▶  curriculum");
  if (!SEED_CORE_CURRICULA) {
    console.log("   skipped — set SEED_CORE_CURRICULA=true to create demo curricula");
    return;
  }

  const admin = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    console.log("   ! super admin not found — skipping curriculum");
    return;
  }

  let created = 0;
  let updated = 0;
  let patched = 0;

  for (const [program, meta] of Object.entries(PROGRAM_SEMESTERS)) {
    const emptySemesters = Array.from({ length: meta.semesters }, (_, i) => ({
      semesterNo: i + 1,
      subjects: [],
      totalCredits: 0,
      totalTheoryHours: 0,
      totalLabHours: 0,
    }));

    const existing = await CurriculumModel.findOne({
      program,
      regulationYear: CURRICULUM_REGULATION_YEAR,
    });

    if (!existing) {
      await CurriculumModel.create({
        program,
        academicLevel: meta.academicLevel,
        openForAdmissions: true,
        regulationYear: CURRICULUM_REGULATION_YEAR,
        totalSemesters: meta.semesters,
        totalCreditsRequired: meta.credits,
        semesterPlans: emptySemesters,
        programOutcomes: [],
        isActive: true,
        version: 1,
        createdBy: admin._id,
      });
      created++;
      console.log(`   + ${program.padEnd(8)} ${CURRICULUM_REGULATION_YEAR}`);
      continue;
    }

    await CurriculumModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          totalSemesters: meta.semesters,
          totalCreditsRequired: meta.credits,
          academicLevel: meta.academicLevel,
          openForAdmissions: true,
          isActive: true,
        },
        $unset: { departmentId: "", branch: "" },
        $setOnInsert: {
          semesterPlans: emptySemesters,
          programOutcomes: [],
          version: 1,
          createdBy: admin._id,
        },
      },
    );
    updated++;
  }

  for (const d of DEPARTMENTS) {
    const curricula = await CurriculumModel.find({
      program: { $in: d.programs },
      regulationYear: CURRICULUM_REGULATION_YEAR,
      isActive: true,
    })
      .select("_id program")
      .lean();

    await DepartmentModel.updateOne(
      { code: d.code },
      {
        $set: {
          curriculumIds: curricula.map((c) => c._id),
          programs: [...new Set(curricula.map((c) => c.program))],
        },
      },
    );
    patched++;
  }

  console.log(`   created=${created}  updated=${updated}  departmentsPatched=${patched}`);
}

async function seedSuperAdmin(): Promise<void> {
  console.log("\n▶  super admin");
  const hashed = await bcrypt.hash(ADMIN_PASS, 12);
  const existing = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    existing.password = hashed;
    existing.roles = Array.from(new Set([R.SUPER_ADMIN, ...(existing.roles ?? [])]));
    existing.status = "active";
    existing.isEmailVerified = true;
    existing.mustChangePassword = REQUIRE_ADMIN_PASSWORD_CHANGE;
    await existing.save();
    console.log(`   ~ ${ADMIN_EMAIL}  → password reset to ${ADMIN_PASS}`);
    return;
  }

  await UserModel.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hashed,
    roles: [R.SUPER_ADMIN],
    isEmailVerified: true,
    mustChangePassword: REQUIRE_ADMIN_PASSWORD_CHANGE,
    status: "active",
    phone: ADMIN_PHONE,
  });
  console.log(`   + ${ADMIN_EMAIL}  |  password: ${ADMIN_PASS}`);
}

async function seedInstitutionSettings(): Promise<void> {
  await InstitutionSettingModel.updateOne(
    {},
    {
      $setOnInsert: {
        name: INSTITUTION_NAME,
        tagline: "Connected education operations",
        accreditations: [],
        primaryColor: "#0178D7",
        secondaryColor: "#9BB94F",
        onboardingStatus: "pending",
      },
    },
    { upsert: true },
  );
  console.log(`   institution=${INSTITUTION_NAME}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  if (!SKIP_ADMIN && (!ADMIN_EMAIL || !ADMIN_PASS)) {
    console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASS must be explicitly configured");
    process.exit(1);
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  Devvelocity TENANT — SEED");
  console.log(`  force=${FORCE}`);
  console.log("════════════════════════════════════════════════════════════");

  await mongoose.connect(MONGODB_URI, MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : undefined);
  console.log("Connected to MongoDB");

  try {
    await seedNav();
    await seedRoles();
    await seedInstitutionSettings();
    if (SKIP_ADMIN) console.log("   admin=skipped (SEED_SKIP_ADMIN=true)");
    else await seedSuperAdmin();
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  Seed complete");
  console.log(`  Super Admin: ${ADMIN_EMAIL}`);
  console.log("  Change the bootstrap password immediately in production.");
  console.log("════════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
