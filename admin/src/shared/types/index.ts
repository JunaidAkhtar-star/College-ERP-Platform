/**
 * @file index.ts
 * @description Global shared TypeScript interfaces and types used across the ERP
 *              frontend application. All feature-specific types live in their own feature/types/
 *              folder; only truly cross-cutting types belong here.
 * @module shared/types
 */

// ─── System Roles ────────────────────────────────────────────────────────────

export type TSystemRole = string;

// ─── Authenticated User ───────────────────────────────────────────────────────

export interface IAuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  avatarPublicId?: string;
  roles: TSystemRole[]; // Array of roles assigned to user
  role?: TSystemRole; // Optional: Active role selected at login (if backend provides it)
  department?: string | null;
  departmentId?: string;
  // Note: studentProfileId / facultyProfileId removed from backend User model.
  // Look up profiles via StudentProfile.findOne({ userId }) on the backend.
  mfaEnabled: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  isActive?: boolean; // Legacy compatibility
  isDeleted?: boolean;
  notificationPreferences?: {
    email: boolean;
    inApp: boolean;
    push: boolean;
  };
  lastLoginIp?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
  [key: string]: unknown; // Allow additional fields from backend
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface IApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface IPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pages?: number;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface ILoginRequest {
  email: string;
  password: string;
}

/**
 * Active role payload returned by login / refresh-token endpoints.
 * Drives client-side permission checks + dynamic sidebar.
 */
export interface IActiveRole {
  _id: string;
  name: string;
  displayName: string;
  /** Unioned across every role the user holds. */
  permissions: { module: string; actions: string[] }[];
  /** Unioned NavItem ObjectIds across every role the user holds. Empty = legacy fallback. */
  allowedNavItems: string[];
  isSystem: boolean;
  /** All role names the user is assigned. Used by the portal switcher. */
  assignedRoles?: TSystemRole[];
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IAuthUser;
  /** Optional — present once backend Role docs are seeded. */
  role?: IActiveRole | null;
  /** True when admin provisioned the account; user must change password before normal use. */
  mustChangePassword?: boolean;
  /**
   * Present for student users whose admission application is not yet enrolled.
   * When set, the frontend locks the user to the self-service application form.
   */
  applicationStatus?: string;
}

export interface IMfaLoginResponse {
  mfaRequired: true;
  mfaToken: string;
  email?: string;
}

export interface IRefreshTokenResponse {
  accessToken: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface INavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  requiredRoles: TSystemRole[];
}

export interface INavGroup {
  group: string;
  items: INavItem[];
  requiredRoles: TSystemRole[];
}
