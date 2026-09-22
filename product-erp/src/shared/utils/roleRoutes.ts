/**
 * @file roleRoutes.ts
 * @description Maps each system role to its default dashboard/home path.
 *  Used after login to redirect the user to the correct panel.
 * @module shared/utils
 */

import { TSystemRole } from '@/shared/types';

/** Maps every system role to its post-login landing path */
export const ROLE_HOME_MAP: Record<TSystemRole, string> = {
  super_admin: '/super_admin/dashboard',
  admin: '/admin/dashboard',
  principal: '/principal/dashboard',
  dean_academic: '/dean_academic/dashboard',
  administration_office: '/administration_office/dashboard',
  assistant_administration_officer: '/assistant_administration_officer/dashboard',
  hod: '/hod/dashboard',
  faculty: '/faculty/dashboard',
  student: '/student/dashboard',
  parent: '/parent/dashboard',
  examination_cell: '/examination_cell/dashboard',
  iqac_team: '/iqac_team/dashboard',
  iqac_naac: '/iqac_naac/dashboard',
  scholarship_cell: '/scholarship_cell/dashboard',
  library_staff: '/library_staff/dashboard',
  hostel_warden: '/hostel',
  placement_cell: '/placement_cell/dashboard',
  hr_department: '/hr_department/dashboard',
  accounts_department: '/accounts_department/dashboard',
  transportation: '/transportation/dashboard',
  research_development: '/research_development/dashboard',
  club_head: '/club_head/dashboard',
  iic: '/iic/dashboard',
  store: '/store/dashboard',
  admission_incharge: '/admission_incharge/dashboard',
  admission_counselor: '/admission_counselor/dashboard',
};

/**
 * Returns the home/dashboard path for a given system role.
 * Falls back to '/dashboard' if the role is not found.
 */
export function getRoleHomePath(role: TSystemRole): string {
  return ROLE_HOME_MAP[role] ?? '/dashboard';
}
