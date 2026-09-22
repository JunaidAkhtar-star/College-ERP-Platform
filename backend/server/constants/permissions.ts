/**
 * Granular permission actions per module.
 * Every API action is guarded by module + action combination.
 *
 * Pattern: <MODULE>:<ACTION>
 * Stored in Role documents; enforced by RBAC middleware.
 */

export enum PermissionAction {
  VIEW = "view",
  CREATE = "create",
  EDIT = "edit",
  DELETE = "delete",
  APPROVE = "approve",
  EXPORT = "export",
}

export enum Module {
  // Foundation
  USER_MANAGEMENT = "user_management",
  ROLE_MANAGEMENT = "role_management",
  AUDIT_LOG = "audit_log",

  // Admission & Student lifecycle
  ADMISSION = "admission",
  COUNSELING = "counseling",
  STUDENT_PROFILE = "student_profile",
  DOCUMENT_MANAGEMENT = "document_management",

  // Academic
  ACADEMIC_CALENDAR = "academic_calendar",
  /** @deprecated Retained for tenant-role migration compatibility. */
  ACADEMIC_STRUCTURE = "academic_structure",
  BATCH_MANAGEMENT = "batch_management",
  SECTION_MANAGEMENT = "section_management",
  STUDENT_ALLOTMENT = "student_allotment",
  CURRICULUM = "curriculum",
  DEPARTMENT = "department",
  SUBJECT = "subject",
  FACULTY_MANAGEMENT = "faculty_management",
  FACULTY_WORKLOAD = "faculty_workload",
  TIMETABLE = "timetable",
  COURSE_PROGRESS = "course_progress",
  LESSON_PLAN = "lesson_plan",

  // Attendance
  STUDENT_ATTENDANCE = "student_attendance",
  FACULTY_ATTENDANCE = "faculty_attendance",

  // Examination & Marks
  EXAMINATION = "examination",
  INTERNAL_ASSESSMENT = "internal_assessment",
  QUESTION_BANK = "question_bank",
  RESULT = "result",

  // LMS
  STUDY_MATERIAL = "study_material",
  ASSIGNMENT = "assignment",
  QUIZ = "quiz",

  // Mentoring
  MENTOR = "mentor",
  COUNSELING_NOTES = "counseling_notes",

  // Administrative
  SCHOLARSHIP = "scholarship",
  LIBRARY = "library",
  PLACEMENT = "placement",
  NOTICE = "notice",
  CHAT = "chat",
  NOTIFICATION = "notification",
  PARENT_PORTAL = "parent_portal",

  // Quality
  IQAC = "iqac",
  NAAC = "naac",
  NBA = "nba",

  // HR & Finance
  EMPLOYEE = "employee",
  PAYROLL = "payroll",
  FEE_MANAGEMENT = "fee_management",
  ACCOUNTS = "accounts",

  // Facilities
  HOSTEL = "hostel",
  TRANSPORT = "transport",
  EVENT = "event",
  ALUMNI = "alumni",
  STORE = "store",
  RESEARCH = "research",
  IIC = "iic",
  CLUBS = "clubs",

  // Analytics
  DASHBOARD = "dashboard",
  REPORT_CENTER = "report_center",
  IMPORT_CENTER = "import_center",
  DOCUMENT_TEMPLATE = "document_template",
  FORM_WORKFLOW = "form_workflow",
  DISCIPLINE = "discipline",
  DATA_PORTABILITY = "data_portability",
  COLLABORATION = "collaboration",
  EXTERNAL_CONNECTOR = "external_connector",
  PROCUREMENT = "procurement",
  COMMUNICATION_HUB = "communication_hub",
  SSO_SETTINGS = "sso_settings",
  GRIEVANCE = "grievance",
  SEMESTER_REGISTRATION = "semester_registration",
  TASK_MANAGEMENT = "task_management",
  MEETING = "meeting",
  GATE_PASS = "gate_pass",
  COMPLIANCE = "compliance",
  REGULATORY_INTEGRATION = "regulatory_integration",
}

/** A single permission entry stored in the Role document. */
export interface IPermission {
  module: Module | string;
  actions: PermissionAction[];
}
