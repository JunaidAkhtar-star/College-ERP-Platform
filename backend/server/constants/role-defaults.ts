/**
 * Default permission matrix for the 15 shipped SystemRoles.
 * Used by the seed-roles script to initialise the Role collection.
 * Super Admin can edit these via the Roles admin UI afterwards.
 */

import { SystemRole } from "./roles";
import { Module, PermissionAction, type IPermission } from "./permissions";

const A = PermissionAction;
const M = Module;

const ALL_ACTIONS: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.APPROVE, A.EXPORT];
const VIEW_ONLY: PermissionAction[] = [A.VIEW];
const VIEW_EXPORT: PermissionAction[] = [A.VIEW, A.EXPORT];
const VIEW_EDIT: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT];
const VIEW_EDIT_APPROVE: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT, A.APPROVE];
const REPORT_AUTHOR: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT, A.EXPORT];
const REPORT_APPROVER: PermissionAction[] = [...REPORT_AUTHOR, A.APPROVE];
const MEETING_MANAGER: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT, A.DELETE];
const MEETING_APPROVER: PermissionAction[] = [...MEETING_MANAGER, A.APPROVE, A.EXPORT];
const IMPORT_OPERATOR: PermissionAction[] = [A.VIEW, A.CREATE, A.EDIT, A.EXPORT];

const PRINCIPAL_APPROVAL_MODULES = new Set<Module>([
  M.ACADEMIC_CALENDAR,
  M.CURRICULUM,
  M.EXAMINATION,
  M.RESULT,
  M.SCHOLARSHIP,
  M.PROCUREMENT,
  M.COMPLIANCE,
  M.REGULATORY_INTEGRATION,
  M.GRIEVANCE,
  M.EVENT,
  M.MEETING,
  M.IMPORT_CENTER,
]);

const all = (): IPermission[] =>
  Object.values(M).map((module) => ({ module, actions: [...ALL_ACTIONS] }));

const map = (spec: Partial<Record<Module, PermissionAction[]>>): IPermission[] =>
  (Object.entries(spec) as [Module, PermissionAction[]][]).map(([module, actions]) => ({
    module,
    actions,
  }));

/** Preserve tenant-edited modules while appending modules introduced by newer releases. */
export function mergeMissingDefaultPermissions(
  existing: IPermission[],
  defaults: IPermission[],
): IPermission[] {
  const configured = new Set(existing.map((permission) => permission.module));
  return [
    ...existing,
    ...defaults
      .filter((permission) => !configured.has(permission.module))
      .map((permission) => ({ ...permission, actions: [...permission.actions] })),
  ];
}

export const DEFAULT_PERMISSIONS: Record<SystemRole, IPermission[]> = {
  [SystemRole.SUPER_ADMIN]: all(),

  // Institution governance: visibility across the ERP, with approval authority
  // only for workflows that require the head of institution. Routine data entry
  // remains with the operating departments (maker-checker separation).
  [SystemRole.PRINCIPAL]: Object.values(M).map((module) => ({
    module,
    actions:
      module === M.REPORT_CENTER
        ? [...REPORT_APPROVER]
        : module === M.MEETING
          ? [...MEETING_APPROVER]
          : module === M.DASHBOARD || module === M.ROLE_MANAGEMENT || module === M.AUDIT_LOG
            ? [...VIEW_ONLY]
            : PRINCIPAL_APPROVAL_MODULES.has(module)
              ? [A.VIEW, A.APPROVE, A.EXPORT]
              : [...VIEW_EXPORT],
  })),

  [SystemRole.DEAN_ACADEMIC]: map({
    [M.USER_MANAGEMENT]: VIEW_ONLY,
    [M.DASHBOARD]: VIEW_ONLY,
    [M.REPORT_CENTER]: REPORT_AUTHOR,
    [M.DEPARTMENT]: VIEW_EDIT,
    [M.ACADEMIC_CALENDAR]: VIEW_EDIT_APPROVE,
    [M.BATCH_MANAGEMENT]: VIEW_EDIT_APPROVE,
    [M.SECTION_MANAGEMENT]: VIEW_EDIT_APPROVE,
    [M.STUDENT_ALLOTMENT]: VIEW_EDIT_APPROVE,
    [M.CURRICULUM]: VIEW_EDIT_APPROVE,
    [M.SUBJECT]: VIEW_EDIT,
    [M.FACULTY_MANAGEMENT]: VIEW_EDIT,
    [M.FACULTY_WORKLOAD]: VIEW_EDIT_APPROVE,
    [M.TIMETABLE]: VIEW_EDIT_APPROVE,
    [M.COURSE_PROGRESS]: VIEW_EDIT,
    [M.LESSON_PLAN]: VIEW_EDIT,
    [M.STUDENT_ATTENDANCE]: [...VIEW_ONLY, A.EXPORT],
    [M.FACULTY_ATTENDANCE]: VIEW_EDIT_APPROVE,
    [M.EXAMINATION]: VIEW_EDIT_APPROVE,
    [M.INTERNAL_ASSESSMENT]: VIEW_EDIT_APPROVE,
    [M.RESULT]: VIEW_EDIT_APPROVE,
    [M.MENTOR]: VIEW_EDIT,
    [M.COUNSELING]: VIEW_EDIT,
    [M.COUNSELING_NOTES]: VIEW_EDIT,
    [M.NOTICE]: VIEW_EDIT_APPROVE,
    [M.DISCIPLINE]: VIEW_EDIT_APPROVE,
    [M.COLLABORATION]: VIEW_EDIT,
    [M.CHAT]: VIEW_EDIT,
    [M.NOTIFICATION]: VIEW_EDIT,
    [M.IQAC]: VIEW_EDIT,
    [M.NAAC]: VIEW_EDIT,
    [M.NBA]: VIEW_EDIT,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.ADMISSION]: VIEW_ONLY,
    [M.SEMESTER_REGISTRATION]: VIEW_EDIT_APPROVE,
    [M.PROCUREMENT]: VIEW_EDIT_APPROVE,
    [M.TASK_MANAGEMENT]: VIEW_EDIT,
    [M.MEETING]: MEETING_APPROVER,
    [M.GRIEVANCE]: VIEW_EDIT_APPROVE,
    [M.GATE_PASS]: VIEW_EDIT_APPROVE,
    [M.EVENT]: VIEW_EDIT_APPROVE,
    [M.COMMUNICATION_HUB]: VIEW_EDIT_APPROVE,
    [M.COMPLIANCE]: [...VIEW_EDIT, A.EXPORT],
    [M.REGULATORY_INTEGRATION]: [A.VIEW, A.APPROVE, A.EXPORT],
  }),

  [SystemRole.HOD]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.REPORT_CENTER]: REPORT_AUTHOR,
    [M.DEPARTMENT]: VIEW_ONLY,
    [M.BATCH_MANAGEMENT]: VIEW_ONLY,
    [M.SECTION_MANAGEMENT]: VIEW_EDIT,
    [M.STUDENT_ALLOTMENT]: [A.VIEW, A.EDIT],
    [M.CURRICULUM]: VIEW_ONLY,
    [M.SUBJECT]: VIEW_EDIT,
    [M.FACULTY_MANAGEMENT]: VIEW_EDIT,
    [M.FACULTY_WORKLOAD]: VIEW_EDIT,
    [M.TIMETABLE]: VIEW_EDIT,
    [M.COURSE_PROGRESS]: VIEW_EDIT,
    [M.LESSON_PLAN]: VIEW_EDIT_APPROVE,
    [M.STUDENT_ATTENDANCE]: VIEW_EDIT,
    [M.FACULTY_ATTENDANCE]: VIEW_EDIT_APPROVE,
    [M.STUDENT_PROFILE]: VIEW_EDIT,
    [M.EXAMINATION]: VIEW_EDIT,
    [M.INTERNAL_ASSESSMENT]: VIEW_EDIT_APPROVE,
    [M.QUESTION_BANK]: VIEW_EDIT,
    [M.RESULT]: VIEW_EDIT_APPROVE,
    [M.MENTOR]: VIEW_EDIT,
    [M.COUNSELING]: VIEW_EDIT,
    [M.COUNSELING_NOTES]: VIEW_EDIT,
    [M.STUDY_MATERIAL]: VIEW_EDIT,
    [M.ASSIGNMENT]: VIEW_EDIT_APPROVE,
    [M.QUIZ]: VIEW_EDIT_APPROVE,
    [M.NOTICE]: VIEW_EDIT_APPROVE,
    [M.CHAT]: VIEW_EDIT,
    [M.NOTIFICATION]: VIEW_ONLY,
    [M.SEMESTER_REGISTRATION]: VIEW_EDIT_APPROVE,
    [M.PROCUREMENT]: VIEW_EDIT_APPROVE,
    [M.TASK_MANAGEMENT]: VIEW_EDIT,
    [M.MEETING]: MEETING_MANAGER,
    [M.GRIEVANCE]: VIEW_EDIT_APPROVE,
    [M.GATE_PASS]: VIEW_EDIT_APPROVE,
    [M.EVENT]: VIEW_EDIT_APPROVE,
    [M.COMPLIANCE]: VIEW_EDIT,
  }),

  [SystemRole.FACULTY]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.FACULTY_WORKLOAD]: VIEW_ONLY,
    [M.CURRICULUM]: VIEW_ONLY,
    [M.SUBJECT]: VIEW_ONLY,
    [M.TIMETABLE]: VIEW_ONLY,
    [M.COURSE_PROGRESS]: VIEW_EDIT,
    [M.LESSON_PLAN]: VIEW_EDIT,
    [M.STUDENT_ATTENDANCE]: VIEW_EDIT,
    [M.FACULTY_ATTENDANCE]: VIEW_ONLY,
    [M.LIBRARY]: VIEW_ONLY,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.EXAMINATION]: VIEW_ONLY,
    [M.INTERNAL_ASSESSMENT]: VIEW_EDIT,
    [M.QUESTION_BANK]: VIEW_EDIT,
    [M.RESULT]: VIEW_EDIT,
    [M.STUDY_MATERIAL]: VIEW_EDIT,
    [M.ASSIGNMENT]: VIEW_EDIT,
    [M.QUIZ]: VIEW_EDIT,
    [M.MENTOR]: VIEW_EDIT,
    [M.COUNSELING]: VIEW_EDIT,
    [M.COUNSELING_NOTES]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
    [M.CHAT]: VIEW_EDIT,
    [M.NOTIFICATION]: VIEW_ONLY,
    [M.SEMESTER_REGISTRATION]: VIEW_ONLY,
    [M.PROCUREMENT]: VIEW_EDIT,
    [M.TASK_MANAGEMENT]: VIEW_EDIT,
    [M.MEETING]: VIEW_EDIT,
    [M.GRIEVANCE]: VIEW_EDIT,
    [M.GATE_PASS]: VIEW_EDIT,
    [M.IQAC]: [A.VIEW, A.CREATE, A.EDIT],
    [M.IIC]: VIEW_ONLY,
    [M.CLUBS]: VIEW_ONLY,
    [M.EVENT]: VIEW_EDIT,
  }),

  [SystemRole.STUDENT]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.ADMISSION]: VIEW_ONLY,
    [M.ACADEMIC_CALENDAR]: VIEW_ONLY,
    [M.TIMETABLE]: VIEW_ONLY,
    [M.COURSE_PROGRESS]: VIEW_ONLY,
    [M.LESSON_PLAN]: VIEW_ONLY,
    [M.STUDENT_ATTENDANCE]: VIEW_ONLY,
    [M.EXAMINATION]: VIEW_ONLY,
    [M.RESULT]: VIEW_ONLY,
    [M.STUDY_MATERIAL]: VIEW_ONLY,
    [M.ASSIGNMENT]: VIEW_EDIT,
    [M.QUIZ]: VIEW_EDIT,
    [M.FEE_MANAGEMENT]: VIEW_ONLY,
    [M.SCHOLARSHIP]: VIEW_EDIT,
    [M.LIBRARY]: VIEW_ONLY,
    [M.HOSTEL]: VIEW_ONLY,
    [M.TRANSPORT]: VIEW_ONLY,
    [M.PLACEMENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
    [M.CHAT]: VIEW_EDIT,
    [M.NOTIFICATION]: VIEW_ONLY,
    [M.MENTOR]: VIEW_ONLY,
    [M.COUNSELING]: VIEW_ONLY,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.SEMESTER_REGISTRATION]: VIEW_EDIT,
    [M.TASK_MANAGEMENT]: VIEW_EDIT,
    [M.MEETING]: VIEW_ONLY,
    [M.GRIEVANCE]: VIEW_EDIT,
    [M.GATE_PASS]: VIEW_EDIT,
    [M.IIC]: VIEW_ONLY,
    [M.CLUBS]: VIEW_ONLY,
    [M.IQAC]: [A.VIEW, A.CREATE],
  }),

  [SystemRole.PARENT]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.STUDENT_ATTENDANCE]: VIEW_ONLY,
    [M.TIMETABLE]: VIEW_ONLY,
    [M.RESULT]: VIEW_ONLY,
    [M.FEE_MANAGEMENT]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
    [M.NOTIFICATION]: VIEW_ONLY,
    [M.PARENT_PORTAL]: VIEW_ONLY,
    [M.CHAT]: VIEW_EDIT,
    [M.IQAC]: [A.VIEW, A.CREATE],
  }),

  [SystemRole.EXAMINATION_CELL]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.EXAMINATION]: ALL_ACTIONS,
    [M.INTERNAL_ASSESSMENT]: VIEW_EDIT_APPROVE,
    [M.QUESTION_BANK]: VIEW_EDIT,
    [M.RESULT]: ALL_ACTIONS,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.NOTICE]: VIEW_EDIT,
    // Examination Cell prepares frozen academic-credit records but does not approve its own work.
    [M.REGULATORY_INTEGRATION]: VIEW_EDIT,
  }),

  [SystemRole.IQAC_TEAM]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.REPORT_CENTER]: REPORT_AUTHOR,
    [M.IQAC]: [...VIEW_EDIT, A.EXPORT],
    [M.NAAC]: [...VIEW_EDIT, A.EXPORT],
    [M.NBA]: [...VIEW_EDIT, A.EXPORT],
    [M.COMPLIANCE]: [...VIEW_EDIT_APPROVE, A.EXPORT],
    [M.REGULATORY_INTEGRATION]: [...VIEW_EDIT, A.EXPORT],
    [M.NOTICE]: VIEW_EDIT,
  }),

  [SystemRole.SCHOLARSHIP_CELL]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.SCHOLARSHIP]: VIEW_EDIT,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
  }),

  [SystemRole.LIBRARY_STAFF]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.LIBRARY]: ALL_ACTIONS,
    [M.NOTICE]: VIEW_ONLY,
  }),

  [SystemRole.HOSTEL_WARDEN]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.HOSTEL]: ALL_ACTIONS,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.ACCOUNTS]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
  }),

  [SystemRole.PLACEMENT_CELL]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.PLACEMENT]: ALL_ACTIONS,
    [M.ALUMNI]: VIEW_EDIT,
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.NOTICE]: VIEW_EDIT,
  }),

  [SystemRole.HR_DEPARTMENT]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.EMPLOYEE]: ALL_ACTIONS,
    [M.PAYROLL]: [A.VIEW, A.CREATE, A.EDIT, A.EXPORT],
    [M.FACULTY_ATTENDANCE]: VIEW_EDIT_APPROVE,
    [M.FACULTY_MANAGEMENT]: VIEW_EDIT,
    [M.USER_MANAGEMENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
    [M.MEETING]: MEETING_MANAGER,
  }),

  [SystemRole.ACCOUNTS_DEPARTMENT]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.FEE_MANAGEMENT]: ALL_ACTIONS,
    [M.ACCOUNTS]: ALL_ACTIONS,
    [M.SCHOLARSHIP]: [A.VIEW, A.EDIT, A.EXPORT],
    [M.PAYROLL]: [A.VIEW, A.APPROVE, A.EXPORT],
    [M.STUDENT_PROFILE]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
    [M.PROCUREMENT]: VIEW_EDIT_APPROVE,
    [M.COMPLIANCE]: [...VIEW_EDIT, A.EXPORT],
  }),

  [SystemRole.ADMISSION_COUNSELOR]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.ADMISSION]: VIEW_EDIT,
    [M.COUNSELING]: VIEW_EDIT,
    [M.STUDENT_PROFILE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
  }),

  // ── Admin (full institution access; behaves like Principal for permission defaults) ──
  [SystemRole.ADMIN]: all().map((p) =>
    p.module === M.AUDIT_LOG || p.module === M.ROLE_MANAGEMENT ? { ...p, actions: VIEW_ONLY } : p,
  ),

  // ── Administration Office (admission decisions/enrollment; read-only elsewhere) ──
  [SystemRole.ADMINISTRATION_OFFICE]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.IMPORT_CENTER]: IMPORT_OPERATOR,
    [M.DOCUMENT_TEMPLATE]: VIEW_ONLY,
    [M.FORM_WORKFLOW]: VIEW_ONLY,
    [M.DATA_PORTABILITY]: VIEW_EXPORT,
    [M.ACCOUNTS]: VIEW_EXPORT,
    [M.BATCH_MANAGEMENT]: VIEW_ONLY,
    [M.SECTION_MANAGEMENT]: VIEW_ONLY,
    [M.STUDENT_ALLOTMENT]: VIEW_EXPORT,
    [M.FEE_MANAGEMENT]: VIEW_EXPORT,
    [M.PAYROLL]: VIEW_EXPORT,
    [M.EMPLOYEE]: VIEW_EXPORT,
    [M.FACULTY_MANAGEMENT]: VIEW_EXPORT,
    [M.SCHOLARSHIP]: VIEW_EXPORT,
    [M.TRANSPORT]: VIEW_EXPORT,
    [M.ADMISSION]: ALL_ACTIONS,
    [M.COUNSELING]: VIEW_EDIT_APPROVE,
    [M.STUDENT_PROFILE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.USER_MANAGEMENT]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
    [M.STORE]: VIEW_EXPORT,
    [M.PROCUREMENT]: VIEW_EXPORT,
    [M.COMMUNICATION_HUB]: VIEW_ONLY,
    [M.TASK_MANAGEMENT]: VIEW_ONLY,
    [M.MEETING]: MEETING_MANAGER,
    [M.REGULATORY_INTEGRATION]: VIEW_EXPORT,
    [M.COMPLIANCE]: VIEW_ONLY,
  }),

  // ── Assistant Administration Officer (handles admission + counseling submissions only) ──
  [SystemRole.ASSISTANT_ADMINISTRATION_OFFICER]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.ADMISSION]: ALL_ACTIONS,
    [M.COUNSELING]: ALL_ACTIONS,
    [M.STUDENT_PROFILE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.USER_MANAGEMENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
  }),

  // ── Admission Incharge ──
  [SystemRole.ADMISSION_INCHARGE]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.ADMISSION]: ALL_ACTIONS,
    [M.COUNSELING]: ALL_ACTIONS,
    [M.STUDENT_PROFILE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_ONLY,
  }),

  // ── Transportation ──
  [SystemRole.TRANSPORTATION]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.TRANSPORT]: ALL_ACTIONS,
    [M.NOTICE]: VIEW_ONLY,
  }),

  // ── IQAC + NAAC consolidated role ──
  [SystemRole.IQAC_NAAC]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.REPORT_CENTER]: REPORT_AUTHOR,
    [M.IQAC]: VIEW_EDIT_APPROVE,
    [M.NAAC]: VIEW_EDIT_APPROVE,
    [M.NBA]: VIEW_EDIT_APPROVE,
    [M.COMPLIANCE]: VIEW_EDIT_APPROVE,
    // Operational maker role; final authorization remains with Dean Academic or Principal.
    [M.REGULATORY_INTEGRATION]: [...VIEW_EDIT, A.EXPORT],
    [M.NOTICE]: VIEW_EDIT,
  }),

  // ── R&D / Club Head / IIC / Store: lightweight defaults; refined via Roles admin UI ──
  [SystemRole.RESEARCH_DEVELOPMENT]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.NOTICE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.RESEARCH]: ALL_ACTIONS,
    [M.IIC]: VIEW_EDIT,
  }),

  [SystemRole.CLUB_HEAD]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.EVENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_EDIT,
    [M.CLUBS]: ALL_ACTIONS,
  }),

  [SystemRole.IIC]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.EVENT]: VIEW_EDIT,
    [M.NOTICE]: VIEW_EDIT,
    [M.DOCUMENT_MANAGEMENT]: VIEW_EDIT,
    [M.IIC]: ALL_ACTIONS,
    [M.RESEARCH]: VIEW_ONLY,
  }),

  [SystemRole.STORE]: map({
    [M.DASHBOARD]: VIEW_ONLY,
    [M.NOTICE]: VIEW_ONLY,
    [M.STORE]: ALL_ACTIONS,
    [M.PROCUREMENT]: VIEW_EDIT_APPROVE,
  }),
};

// Every role can see these code-owned, tenant-wide collaboration surfaces.
// Elevated actions already configured above are preserved.
const UNIVERSAL_NAV_PERMISSIONS = map({
  [M.DASHBOARD]: VIEW_ONLY,
  [M.NOTIFICATION]: VIEW_ONLY,
  [M.NOTICE]: VIEW_ONLY,
  [M.EVENT]: VIEW_ONLY,
  [M.CHAT]: VIEW_EDIT,
  [M.FORM_WORKFLOW]: VIEW_ONLY,
  [M.DISCIPLINE]: VIEW_ONLY,
  [M.DOCUMENT_MANAGEMENT]: VIEW_ONLY,
});

for (const role of Object.values(SystemRole)) {
  DEFAULT_PERMISSIONS[role] = mergeMissingDefaultPermissions(
    DEFAULT_PERMISSIONS[role],
    UNIVERSAL_NAV_PERMISSIONS,
  );
}

export const DISPLAY_NAMES: Record<SystemRole, string> = {
  [SystemRole.SUPER_ADMIN]: "Super Admin",
  [SystemRole.ADMIN]: "Admin",
  [SystemRole.PRINCIPAL]: "Principal",
  [SystemRole.DEAN_ACADEMIC]: "Dean Academic",
  [SystemRole.ADMINISTRATION_OFFICE]: "Administration Office",
  [SystemRole.ASSISTANT_ADMINISTRATION_OFFICER]: "Assistant Administration Officer",
  [SystemRole.HOD]: "Head of Department",
  [SystemRole.FACULTY]: "Faculty",
  [SystemRole.STUDENT]: "Student",
  [SystemRole.PARENT]: "Parent",
  [SystemRole.EXAMINATION_CELL]: "Examination Cell",
  [SystemRole.IQAC_TEAM]: "IQAC Team",
  [SystemRole.IQAC_NAAC]: "IQAC / NAAC",
  [SystemRole.SCHOLARSHIP_CELL]: "Scholarship Cell",
  [SystemRole.LIBRARY_STAFF]: "Library Staff",
  [SystemRole.HOSTEL_WARDEN]: "Hostel Warden",
  [SystemRole.PLACEMENT_CELL]: "Training & Placement",
  [SystemRole.HR_DEPARTMENT]: "HR Department",
  [SystemRole.ACCOUNTS_DEPARTMENT]: "Accounts Department",
  [SystemRole.TRANSPORTATION]: "Transportation",
  [SystemRole.RESEARCH_DEVELOPMENT]: "Research & Development",
  [SystemRole.CLUB_HEAD]: "Club Head",
  [SystemRole.IIC]: "IIC",
  [SystemRole.STORE]: "Store",
  [SystemRole.ADMISSION_INCHARGE]: "Admission Incharge",
  [SystemRole.ADMISSION_COUNSELOR]: "Admission Counselor",
};
