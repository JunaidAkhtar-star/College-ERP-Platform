/**
 * @file useHasPermission.ts
 * @description Convenience hooks that read permission state from the auth
 *   store. Use these in UI to conditionally render action buttons or sections
 *   based on the active role's permission grid.
 *
 * @example
 *   const canCreate = useHasPermission(Module.STUDENT_PROFILE, PermissionAction.CREATE);
 *   {canCreate && <CustomButton>Add Student</CustomButton>}
 */

'use client';

import { useAuthStore } from '@/shared/store/authStore';

/** Single module:action check. Fails closed until the active policy is loaded. */
export function useHasPermission(module: string, action: string): boolean {
  return useAuthStore((s) => s.hasPermission(module, action));
}

/** Returns true when ANY of the given module:action pairs is granted. */
export function useHasAnyPermission(checks: [string, string][]): boolean {
  return useAuthStore((s) => checks.some(([m, a]) => s.hasPermission(m, a)));
}

/** Returns true when ALL of the given module:action pairs are granted. */
export function useHasAllPermissions(checks: [string, string][]): boolean {
  return useAuthStore((s) => checks.every(([m, a]) => s.hasPermission(m, a)));
}

/** True once the backend has provided a role doc with a non-empty grid. */
export function usePermissionsLoaded(): boolean {
  return useAuthStore((s) => s.hasLoadedPermissions());
}
