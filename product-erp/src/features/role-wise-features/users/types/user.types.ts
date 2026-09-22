/**
 * @file user.types.ts
 * @description User module TypeScript interfaces.
 * @module features/role-wise-features/users/types
 */

import { TSystemRole } from '@/shared/types';

export type TUserStatus = 'pending_verification' | 'active' | 'inactive' | 'suspended' | 'blocked';

export interface IUserDirectorySummary {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  suspended: number;
  blocked: number;
  withoutDepartment: number;
  mfaEnabled: number;
  dormant: number;
  mfaAdoptionPercent: number;
}

export interface IDirectoryUser {
  _id: string;
  name: string;
  email: string;
  /** Multi-role union — backend always returns an array. */
  roles: TSystemRole[];
  /** Legacy single-role mirror; some older entries may only have this. */
  role?: TSystemRole;
  phone?: string;
  facultyId?: string;
  studentId?: string;
  employeeId?: string;
  avatar?: string;
  status: TUserStatus;
  isEmailVerified?: boolean;
  mustChangePassword?: boolean;
  department?:
    | string
    | {
        _id: string;
        name: string;
        code: string;
      };
  createdAt: string;
  updatedAt: string;
}

// Legacy aliases (kept so existing imports don't break)
export type IUser = IDirectoryUser;
export interface ICreateUserDto {
  name: string;
  email: string;
  password: string;
  roles: TSystemRole[];
  phone?: string;
  department?: string;
}
