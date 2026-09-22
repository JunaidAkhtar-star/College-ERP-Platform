import type { Request } from "express";
import { Module, PermissionAction } from "./permissions";

const ROUTE_MODULES: Readonly<Record<string, Module>> = {
  admission: Module.ADMISSION,
  "recruitment-crm": Module.ADMISSION,
  counseling: Module.COUNSELING,
  scholarship: Module.SCHOLARSHIP,
  "financial-aid": Module.SCHOLARSHIP,
  "lms-integration": Module.STUDY_MATERIAL,
  "campus-governance": Module.USER_MANAGEMENT,
  facilities: Module.STORE,
  advancement: Module.ALUMNI,
  "continuing-education": Module.CURRICULUM,
  "ai-governance": Module.COMPLIANCE,
  "student-profile": Module.STUDENT_PROFILE,
  "faculty-profile": Module.FACULTY_MANAGEMENT,
  "faculty-onboarding": Module.FACULTY_MANAGEMENT,
  department: Module.DEPARTMENT,
  subject: Module.SUBJECT,
  curriculum: Module.CURRICULUM,
  batch: Module.BATCH_MANAGEMENT,
  section: Module.SECTION_MANAGEMENT,
  "student-section-allotment": Module.STUDENT_ALLOTMENT,
  "assessment-policy": Module.INTERNAL_ASSESSMENT,
  "assessment-gradebook": Module.INTERNAL_ASSESSMENT,
  "academic-calendar": Module.ACADEMIC_CALENDAR,
  timetable: Module.TIMETABLE,
  "course-progress": Module.COURSE_PROGRESS,
  "lesson-plan": Module.LESSON_PLAN,
  "faculty-workload": Module.FACULTY_WORKLOAD,
  "semester-registration": Module.SEMESTER_REGISTRATION,
  "degree-audit": Module.SEMESTER_REGISTRATION,
  assignment: Module.ASSIGNMENT,
  quiz: Module.QUIZ,
  "question-bank": Module.QUESTION_BANK,
  "study-material": Module.STUDY_MATERIAL,
  attendance: Module.STUDENT_ATTENDANCE,
  "faculty-attendance": Module.FACULTY_ATTENDANCE,
  examination: Module.EXAMINATION,
  fee: Module.FEE_MANAGEMENT,
  accounts: Module.ACCOUNTS,
  "payment-settings": Module.ACCOUNTS,
  hr: Module.EMPLOYEE,
  payroll: Module.PAYROLL,
  leave: Module.EMPLOYEE,
  library: Module.LIBRARY,
  hostel: Module.HOSTEL,
  transport: Module.TRANSPORT,
  placement: Module.PLACEMENT,
  "job-posting": Module.PLACEMENT,
  "training-session": Module.PLACEMENT,
  alumni: Module.ALUMNI,
  chat: Module.CHAT,
  notice: Module.NOTICE,
  notification: Module.NOTIFICATION,
  event: Module.EVENT,
  "naac-nba": Module.NAAC,
  iqac: Module.IQAC,
  compliance: Module.COMPLIANCE,
  "compliance-workspace": Module.COMPLIANCE,
  "regulatory-integration": Module.REGULATORY_INTEGRATION,
  "research-development": Module.RESEARCH,
  iic: Module.IIC,
  procurement: Module.PROCUREMENT,
  store: Module.STORE,
  gatepass: Module.GATE_PASS,
  club: Module.CLUBS,
  clubs: Module.CLUBS,
  meeting: Module.MEETING,
  "meeting-recording": Module.MEETING,
  "audit-log": Module.AUDIT_LOG,
  dashboard: Module.DASHBOARD,
  "report-center": Module.REPORT_CENTER,
  "import-center": Module.IMPORT_CENTER,
  "document-template": Module.DOCUMENT_TEMPLATE,
  "communication-hub": Module.COMMUNICATION_HUB,
  sso: Module.SSO_SETTINGS,
  "form-workflow": Module.FORM_WORKFLOW,
  discipline: Module.DISCIPLINE,
  "data-portability": Module.DATA_PORTABILITY,
  "tenant-backup": Module.DATA_PORTABILITY,
  collaboration: Module.COLLABORATION,
  "external-connector": Module.EXTERNAL_CONNECTOR,
  "tenant-integrations": Module.EXTERNAL_CONNECTOR,
  document: Module.DOCUMENT_MANAGEMENT,
  mentor: Module.MENTOR,
  "student-success": Module.MENTOR,
  grievance: Module.GRIEVANCE,
  task: Module.TASK_MANAGEMENT,
  user: Module.USER_MANAGEMENT,
  admin: Module.USER_MANAGEMENT,
  role: Module.ROLE_MANAGEMENT,
  nav: Module.ROLE_MANAGEMENT,
  parent: Module.PARENT_PORTAL,
  search: Module.DASHBOARD,
  "institution-setting": Module.USER_MANAGEMENT,
  operations: Module.AUDIT_LOG,
};

/** Permission ownership for ERP navigation routes. */
export const NAV_HREF_MODULES: Readonly<Record<string, readonly Module[]>> = {
  "/dashboard": [Module.DASHBOARD],
  "/report-center": [Module.REPORT_CENTER],
  "/import-center": [Module.IMPORT_CENTER],
  "/document-designer": [Module.DOCUMENT_TEMPLATE],
  "/communication-hub": [Module.COMMUNICATION_HUB],
  "/sso-settings": [Module.SSO_SETTINGS],
  "/forms": [Module.FORM_WORKFLOW],
  "/discipline": [Module.DISCIPLINE],
  "/data-portability": [Module.DATA_PORTABILITY],
  "/collaboration": [Module.COLLABORATION],
  "/external-connector": [Module.EXTERNAL_CONNECTOR],
  "/campus-governance": [Module.USER_MANAGEMENT],
  "/facilities": [Module.STORE],
  "/advancement": [Module.ALUMNI],
  "/continuing-education": [Module.CURRICULUM],
  "/ai-governance": [Module.COMPLIANCE],
  "/government-integrations": [Module.REGULATORY_INTEGRATION],
  "/users": [Module.USER_MANAGEMENT],
  "/roles": [Module.ROLE_MANAGEMENT],
  "/nav-admin": [Module.ROLE_MANAGEMENT],
  "/audit-log": [Module.AUDIT_LOG],
  "/departments": [Module.DEPARTMENT],
  "/admission": [Module.ADMISSION],
  "/recruitment-crm": [Module.ADMISSION],
  "/financial-aid": [Module.SCHOLARSHIP],
  "/student-management": [Module.STUDENT_PROFILE],
  "/faculty-management": [Module.FACULTY_MANAGEMENT],
  "/subjects": [Module.SUBJECT],
  "/curriculum": [Module.CURRICULUM],
  "/academic-structure": [
    Module.BATCH_MANAGEMENT,
    Module.SECTION_MANAGEMENT,
    Module.STUDENT_ALLOTMENT,
  ],
  "/academic-calendar": [Module.ACADEMIC_CALENDAR],
  "/timetable": [Module.TIMETABLE],
  "/lesson-plan": [Module.LESSON_PLAN],
  "/course-progress": [Module.COURSE_PROGRESS],
  "/faculty-workload": [Module.FACULTY_WORKLOAD],
  "/degree-audit": [Module.SEMESTER_REGISTRATION],
  "/lms-integration": [Module.STUDY_MATERIAL],
  "/attendance": [Module.STUDENT_ATTENDANCE],
  "/faculty-attendance": [Module.FACULTY_ATTENDANCE],
  "/examination": [Module.EXAMINATION, Module.RESULT, Module.INTERNAL_ASSESSMENT],
  "/question-bank": [Module.QUESTION_BANK],
  "/assessment-policy": [Module.INTERNAL_ASSESSMENT],
  "/assignment": [Module.ASSIGNMENT],
  "/quiz": [Module.QUIZ],
  "/study-material": [Module.STUDY_MATERIAL],
  "/fee": [Module.FEE_MANAGEMENT],
  "/accounts": [Module.ACCOUNTS],
  "/payroll": [Module.PAYROLL],
  "/scholarship": [Module.SCHOLARSHIP],
  "/payment-settings": [Module.ACCOUNTS],
  "/hr": [Module.EMPLOYEE],
  "/leave": [Module.EMPLOYEE],
  "/mentor": [Module.MENTOR],
  "/student-success": [Module.MENTOR],
  "/counseling": [Module.COUNSELING, Module.COUNSELING_NOTES],
  "/grievance": [Module.GRIEVANCE],
  "/semester-registration": [Module.SEMESTER_REGISTRATION],
  "/library": [Module.LIBRARY],
  "/hostel": [Module.HOSTEL],
  "/transport": [Module.TRANSPORT],
  "/placement": [Module.PLACEMENT],
  "/training-session": [Module.PLACEMENT],
  "/alumni": [Module.ALUMNI],
  "/job-posting": [Module.PLACEMENT],
  "/task-management": [Module.TASK_MANAGEMENT],
  "/notice": [Module.NOTICE],
  "/event": [Module.EVENT],
  "/meeting": [Module.MEETING],
  "/chat": [Module.CHAT],
  "/notification": [Module.NOTIFICATION],
  "/document": [Module.DOCUMENT_MANAGEMENT],
  "/iqac": [Module.IQAC],
  "/naac-nba": [Module.NAAC, Module.NBA],
  "/accreditation": [Module.NAAC, Module.NBA],
  "/compliance": [Module.COMPLIANCE],
  "/procurement": [Module.PROCUREMENT],
  "/store": [Module.STORE],
  "/research-development": [Module.RESEARCH],
  "/iic": [Module.IIC],
  "/clubs": [Module.CLUBS],
  "/gate-pass": [Module.GATE_PASS],
  "/parent/ward": [Module.PARENT_PORTAL],
  "/parent/attendance": [Module.PARENT_PORTAL],
  "/parent/fees": [Module.PARENT_PORTAL],
  "/parent/results": [Module.PARENT_PORTAL],
};

export function permissionModulesForNavHref(href: string): readonly Module[] {
  const normalized = `/${href.split(/[?#]/)[0].split("/").filter(Boolean).join("/")}`;
  const owner = Object.keys(NAV_HREF_MODULES)
    .filter((candidate) => normalized === candidate || normalized.startsWith(`${candidate}/`))
    .sort((left, right) => right.length - left.length)[0];
  return owner ? NAV_HREF_MODULES[owner] : [];
}

const APPROVAL_PATH =
  /(?:^|\/)(approve|approval|reject|decide|verify|finalize|publish|freeze|lock|reconcile|receive|issue|reverse|moderate|pay)(?:\/|$)/i;
const EXPORT_PATH = /(?:^|\/)(export|download|report|transcript|marksheet)(?:\/|$)/i;

export function permissionForRequest(
  req: Pick<Request, "baseUrl" | "method" | "path">,
): { module: Module; action: PermissionAction } | null {
  const routeName = req.baseUrl.split("/").filter(Boolean).at(-1);
  let module = routeName ? ROUTE_MODULES[routeName] : undefined;
  if (routeName === "naac-nba" && /^\/nba(?:\/|$)/.test(req.path)) module = Module.NBA;
  if (!module) return null;

  if (routeName === "compliance" && /^\/export\/naac-/i.test(req.path)) {
    return { module: Module.NAAC, action: PermissionAction.EXPORT };
  }
  if (routeName === "compliance" && /^\/export\/nba-/i.test(req.path)) {
    return { module: Module.NBA, action: PermissionAction.EXPORT };
  }

  if (
    routeName === "compliance-workspace" &&
    ((req.method === "POST" && /^\/catalog\/[a-z0-9-]+\/activate$/i.test(req.path)) ||
      ((req.method === "POST" || req.method === "PUT") &&
        /^\/(?:frameworks|requirements)(?:\/[a-f0-9]{24})?$/i.test(req.path)) ||
      (req.method === "PATCH" && /^\/submissions\/[a-f0-9]{24}\/review$/i.test(req.path)) ||
      (req.method === "POST" && req.path === "/findings") ||
      (req.method === "PATCH" && /^\/findings\/[a-f0-9]{24}\/verify$/i.test(req.path)))
  ) {
    return { module: Module.COMPLIANCE, action: PermissionAction.APPROVE };
  }
  if (
    routeName === "compliance-workspace" &&
    req.method === "POST" &&
    /^\/accreditation\/scopes\/[a-f0-9]{24}\/decision$/i.test(req.path)
  ) {
    return { module: Module.COMPLIANCE, action: PermissionAction.APPROVE };
  }
  if (
    routeName === "compliance-workspace" &&
    req.method === "PATCH" &&
    /^\/accreditation\/scopes\/[a-f0-9]{24}\/trust$/i.test(req.path)
  ) {
    return { module: Module.COMPLIANCE, action: PermissionAction.APPROVE };
  }
  if (
    routeName === "compliance-workspace" &&
    req.method === "POST" &&
    /^\/accreditation\/scopes\/[a-f0-9]{24}\/snapshots$/i.test(req.path)
  ) {
    return { module: Module.COMPLIANCE, action: PermissionAction.EXPORT };
  }
  if (routeName === "compliance-workspace" && req.path === "/audit-package") {
    return { module: Module.COMPLIANCE, action: PermissionAction.EXPORT };
  }

  // `/nav/me` is authenticated self-service: every role needs it to load its
  // already-filtered navigation tree. Only nav administration CRUD requires
  // role_management permissions.
  if (routeName === "nav" && /^\/me(?:\/|$)/.test(req.path)) return null;
  if (routeName === "regulatory-integration") {
    if (req.method === "POST" && /^\/[a-z]+\/request-approval$/i.test(req.path)) {
      return { module: Module.REGULATORY_INTEGRATION, action: PermissionAction.EDIT };
    }
    if (req.method === "POST" && /^\/[a-z]+\/approval$/i.test(req.path)) {
      return { module: Module.REGULATORY_INTEGRATION, action: PermissionAction.APPROVE };
    }
    if (
      (req.method === "POST" || req.method === "DELETE") &&
      /^\/[a-z]+\/evidence(?:\/[a-f0-9]{24})?$/i.test(req.path)
    ) {
      return { module: Module.REGULATORY_INTEGRATION, action: PermissionAction.EDIT };
    }
  }
  if (
    routeName === "notification" &&
    (/^\/(?:my|preferences|fcm-token|chat\/read-all|read-all)(?:\/|$)/.test(req.path) ||
      /^\/[a-f0-9]{24}\/read$/i.test(req.path))
  )
    return null;
  // Chat is an authenticated self-service workspace. A role with module view
  // access may start participant-scoped conversations and send messages.
  // Conversation membership and group-admin operations remain enforced by the
  // chat service, so this does not grant access to another user's conversation.
  if (routeName === "chat") {
    return { module: Module.CHAT, action: PermissionAction.VIEW };
  }
  if (
    routeName === "tenant-integrations" &&
    /^\/firebase\/(?:client-config|readiness)$/.test(req.path)
  )
    return null;
  if (routeName === "admission" && /^\/my-application(?:\/|$)/.test(req.path)) return null;
  if (routeName === "hr" && /^\/me(?:\/|$)/.test(req.path)) return null;
  // Personal document upload and version replacement are authenticated
  // self-service operations. The controller always derives the owner from the
  // current user and enforces ownership; organisation-wide review remains
  // document_management:approve.
  if (routeName === "document" && req.method === "POST" && req.path === "/upload") {
    return { module: Module.DOCUMENT_MANAGEMENT, action: PermissionAction.VIEW };
  }
  // Cross-institution placement discovery is available to placement readers.
  // A participation request contains institution-level contact information only;
  // publishing and deciding requests remain approval-governed operations.
  if (
    routeName === "placement" &&
    req.method === "POST" &&
    /^\/network\/[a-f0-9]{24}\/requests$/i.test(req.path)
  ) {
    return { module: Module.PLACEMENT, action: PermissionAction.VIEW };
  }
  if (
    routeName === "placement" &&
    req.method === "PATCH" &&
    /^\/network\/requests\/[a-f0-9]{24}$/i.test(req.path)
  ) {
    return { module: Module.PLACEMENT, action: PermissionAction.APPROVE };
  }
  // IQAC workflow commands mutate an existing governed record. Treat action
  // plans and submission as edits, while final approval remains independently
  // permissioned. This keeps custom roles aligned with the UI and avoids
  // relying on legacy role-name allowlists.
  if (
    routeName === "iqac" &&
    req.method === "POST" &&
    /^\/copo\/[a-f0-9]{24}\/(?:action-plans|submit)$/i.test(req.path)
  ) {
    return { module: Module.IQAC, action: PermissionAction.EDIT };
  }
  if (routeName === "naac-nba" && /^\/naac\/evidence\/[a-f0-9]{24}\/review$/i.test(req.path)) {
    return { module: Module.NAAC, action: PermissionAction.APPROVE };
  }
  if (
    routeName === "naac-nba" &&
    req.method === "POST" &&
    /^\/naac\/evidence\/[a-f0-9]{24}\/submit$/i.test(req.path)
  ) {
    return { module: Module.NAAC, action: PermissionAction.EDIT };
  }
  // Allocating received alumni money is a governed financial decision, not a
  // generic record-creation operation. Keep it behind explicit approval rights.
  if (routeName === "advancement" && req.method === "POST" && req.path === "/designations") {
    return { module: Module.ALUMNI, action: PermissionAction.APPROVE };
  }
  // Idea submission is authenticated IIC self-service and remains ownership
  // scoped in the service. Governance transitions require approval; incubation
  // operations update an already-approved project.
  if (routeName === "iic" && req.method === "POST" && req.path === "/projects") {
    return { module: Module.IIC, action: PermissionAction.VIEW };
  }
  if (
    routeName === "iic" &&
    req.method === "PATCH" &&
    /^\/projects\/[a-f0-9]{24}\/transition$/i.test(req.path)
  ) {
    return { module: Module.IIC, action: PermissionAction.APPROVE };
  }
  if (
    routeName === "iic" &&
    /^\/projects\/[a-f0-9]{24}\/(?:mentor|milestones|funding|ip|outcome)(?:\/|$)/i.test(req.path)
  ) {
    return { module: Module.IIC, action: PermissionAction.EDIT };
  }
  if (routeName === "club" && req.method === "POST" && /\/join-request$/i.test(req.path)) {
    return { module: Module.CLUBS, action: PermissionAction.VIEW };
  }
  // Event discovery and registration are self-service for every role that can
  // view the module. Ownership, audience, department and capacity are enforced
  // in the event service. Attendance remains a managed edit operation.
  if (
    routeName === "event" &&
    req.method === "POST" &&
    /^\/[a-f0-9]{24}\/register$/i.test(req.path)
  ) {
    return { module: Module.EVENT, action: PermissionAction.VIEW };
  }
  if (
    routeName === "club" &&
    req.method === "PATCH" &&
    /^\/membership-requests\/[a-f0-9]{24}\/decision$/i.test(req.path)
  ) {
    return { module: Module.CLUBS, action: PermissionAction.APPROVE };
  }
  if (routeName === "club" && /^\/[a-f0-9]{24}\/(?:members|activities)(?:\/|$)/i.test(req.path)) {
    return { module: Module.CLUBS, action: PermissionAction.EDIT };
  }
  if (routeName === "notice" && req.method === "POST" && /\/[a-f0-9]{24}\/read$/i.test(req.path)) {
    return { module: Module.NOTICE, action: PermissionAction.VIEW };
  }
  if (
    routeName === "document" &&
    req.method === "PUT" &&
    /^\/[a-f0-9]{24}\/reupload$/i.test(req.path)
  ) {
    return { module: Module.DOCUMENT_MANAGEMENT, action: PermissionAction.VIEW };
  }
  // Filing a hostel complaint is student-owned self-service. Returning null
  // preserves the route's STUDENT role guard while the service scopes the
  // record to the authenticated resident; staff complaint updates remain
  // governed by hostel:edit.
  if (routeName === "hostel" && req.method === "POST" && req.path === "/complaints") return null;
  // Financial-aid student responses are ownership-checked self-service. Staff
  // approval and Accounts disbursement use distinct governed permissions rather
  // than inheriting the generic POST=create classification.
  if (routeName === "financial-aid" && /^\/packages\/[a-f0-9]{24}\/respond$/i.test(req.path))
    return null;
  if (routeName === "financial-aid" && /^\/packages\/[a-f0-9]{24}\/offer$/i.test(req.path)) {
    return { module: Module.SCHOLARSHIP, action: PermissionAction.APPROVE };
  }
  if (routeName === "library" && /^\/issues\/[a-f0-9]{24}\/renew$/i.test(req.path)) {
    return { module: Module.LIBRARY, action: PermissionAction.VIEW };
  }
  if (routeName === "library" && /^\/issues\/[a-f0-9]{24}\/fine-payments$/i.test(req.path)) {
    return { module: Module.LIBRARY, action: PermissionAction.EDIT };
  }
  if (
    routeName === "financial-aid" &&
    /^\/packages\/[a-f0-9]{24}\/items\/[a-f0-9]{24}\/disburse$/i.test(req.path)
  ) {
    return { module: Module.ACCOUNTS, action: PermissionAction.APPROVE };
  }
  // The header calendar is an authenticated, role-filtered feed. The
  // controller returns only published events visible to the active role and
  // department, so opening it must not require calendar-administration access.
  if (routeName === "academic-calendar" && /^\/visible(?:\/|$)/.test(req.path)) return null;
  if (routeName === "academic-calendar" && /^\/personal-events(?:\/|$)/.test(req.path)) return null;
  // Opening an authorised learning resource is part of normal study-material
  // viewing. The endpoint records access before returning its source URL; it
  // is not a bulk/report export operation.
  if (routeName === "study-material" && /^\/[a-f0-9]{24}\/download$/i.test(req.path)) {
    return { module: Module.STUDY_MATERIAL, action: PermissionAction.VIEW };
  }

  // Report Center mixes read-only previews, governed definition changes,
  // publication, evidence exports and schedule management under one route.
  // Classify each workflow by intent instead of treating every POST as create.
  if (routeName === "report-center") {
    if (req.method === "POST" && req.path === "/preview") {
      return { module: Module.REPORT_CENTER, action: PermissionAction.VIEW };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/submit$/i.test(req.path)) {
      return { module: Module.REPORT_CENTER, action: PermissionAction.EDIT };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/publish$/i.test(req.path)) {
      return { module: Module.REPORT_CENTER, action: PermissionAction.APPROVE };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/snapshot$/i.test(req.path)) {
      return { module: Module.REPORT_CENTER, action: PermissionAction.EXPORT };
    }
    if (req.method === "PATCH" && /^\/schedules\/[a-f0-9]{24}\/status$/i.test(req.path)) {
      return { module: Module.REPORT_CENTER, action: PermissionAction.EDIT };
    }
  }

  // Import Center is a maker-checker workflow. Uploading creates a staged job,
  // cancellation edits that job, approval commits it, and rollback deletes the
  // records created by it. Keep these commands independently assignable to
  // custom roles instead of treating every POST request as `create`.
  if (routeName === "import-center") {
    if (req.method === "POST" && req.path === "/stage") {
      return { module: Module.IMPORT_CENTER, action: PermissionAction.CREATE };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/commit$/i.test(req.path)) {
      return { module: Module.IMPORT_CENTER, action: PermissionAction.APPROVE };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/cancel$/i.test(req.path)) {
      return { module: Module.IMPORT_CENTER, action: PermissionAction.EDIT };
    }
    if (req.method === "POST" && /^\/[a-f0-9]{24}\/rollback$/i.test(req.path)) {
      return { module: Module.IMPORT_CENTER, action: PermissionAction.DELETE };
    }
  }

  if (routeName === "tenant-integrations" && /\/checkout$/.test(req.path)) {
    return { module: Module.FEE_MANAGEMENT, action: PermissionAction.CREATE };
  }
  if (EXPORT_PATH.test(req.path)) return { module, action: PermissionAction.EXPORT };
  if (APPROVAL_PATH.test(req.path)) return { module, action: PermissionAction.APPROVE };
  if (req.method === "GET" || req.method === "HEAD")
    return { module, action: PermissionAction.VIEW };
  if (req.method === "POST") return { module, action: PermissionAction.CREATE };
  if (req.method === "DELETE") return { module, action: PermissionAction.DELETE };
  return { module, action: PermissionAction.EDIT };
}
