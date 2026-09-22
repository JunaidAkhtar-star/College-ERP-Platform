/**
 * System-wide user role definitions.
 * Maps directly to the organizational hierarchy defined in the SRS §2.
 */

export enum SystemRole {
  // ── Tier 1: System-level ──────────────────────────────────────────────────
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",

  // ── Tier 2: Institution-level ─────────────────────────────────────────────
  PRINCIPAL = "principal",

  // ── Tier 3: Academic governance ───────────────────────────────────────────
  DEAN_ACADEMIC = "dean_academic",

  // ── Administration office (monitors finance/HR/admission/scholarship/transport/store) ─
  ADMINISTRATION_OFFICE = "administration_office",
  ASSISTANT_ADMINISTRATION_OFFICER = "assistant_administration_officer",

  // ── Tier 4: Department-level ──────────────────────────────────────────────
  HOD = "hod",

  // ── Tier 5: Teaching staff ────────────────────────────────────────────────
  FACULTY = "faculty",

  // ── Tier 6: Students ──────────────────────────────────────────────────────
  STUDENT = "student",

  // ── Tier 7: Parents / Guardians ───────────────────────────────────────────
  PARENT = "parent",

  // ── Operational roles ─────────────────────────────────────────────────────
  EXAMINATION_CELL = "examination_cell",
  IQAC_NAAC = "iqac_naac",
  IQAC_TEAM = "iqac_team", // legacy alias; still mapped in defaults
  SCHOLARSHIP_CELL = "scholarship_cell",
  LIBRARY_STAFF = "library_staff",
  HOSTEL_WARDEN = "hostel_warden",
  PLACEMENT_CELL = "placement_cell",
  HR_DEPARTMENT = "hr_department",
  ACCOUNTS_DEPARTMENT = "accounts_department",
  TRANSPORTATION = "transportation",
  RESEARCH_DEVELOPMENT = "research_development",
  CLUB_HEAD = "club_head",
  IIC = "iic",
  STORE = "store",
  ADMISSION_INCHARGE = "admission_incharge",
  /** Mandatory system role; kept for backward compatibility with existing data. */
  ADMISSION_COUNSELOR = "admission_counselor",
}

/** Roles that have institution-wide read/write access. */
export const ADMIN_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
];

/** Roles that have department-level access. */
export const DEPARTMENT_ROLES: SystemRole[] = [SystemRole.HOD, SystemRole.FACULTY];

/** Authenticated institution employees eligible for HR and leave self-service. */
export const EMPLOYEE_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.HOD,
  SystemRole.FACULTY,
  SystemRole.EXAMINATION_CELL,
  SystemRole.IQAC_NAAC,
  SystemRole.IQAC_TEAM,
  SystemRole.SCHOLARSHIP_CELL,
  SystemRole.LIBRARY_STAFF,
  SystemRole.HOSTEL_WARDEN,
  SystemRole.PLACEMENT_CELL,
  SystemRole.HR_DEPARTMENT,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.TRANSPORTATION,
  SystemRole.RESEARCH_DEVELOPMENT,
  SystemRole.CLUB_HEAD,
  SystemRole.IIC,
  SystemRole.STORE,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.ADMISSION_COUNSELOR,
];

/** Roles involved in the admission workflow (can act on applications). */
export const ADMISSION_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.ADMISSION_COUNSELOR,
  SystemRole.HOSTEL_WARDEN,
];

/**
 * Modules the Administration Office (AO) monitors in read-only mode.
 * AO sees data across these modules but cannot edit or delete.
 */
export const AO_MONITORED_ROLES: SystemRole[] = [
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.HR_DEPARTMENT,
  SystemRole.TRANSPORTATION,
  SystemRole.SCHOLARSHIP_CELL,
  SystemRole.STORE,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
];

/**
 * System roles that must always exist and cannot be deleted from the Role collection.
 * Super Admin can edit their permissions/menu but not remove the role.
 */
export const MANDATORY_SYSTEM_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.HOD,
  SystemRole.FACULTY,
  SystemRole.STUDENT,
  SystemRole.PARENT,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.HR_DEPARTMENT,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.ADMISSION_COUNSELOR,
];

/** All valid role values (useful for Mongoose enums). */
export const ALL_ROLES = Object.values(SystemRole);
