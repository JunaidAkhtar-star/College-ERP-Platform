/**
 * @file useHasRole.ts
 * @description Active-portal role hooks. Page data, actions and modes must be
 *   derived from the role selected for the current session, never from another
 *   role that merely exists in the user's assignment list.
 */

'use client';

import { useAuthStore } from '@/shared/store/authStore';
import { TSystemRole } from '@/shared/types';

const selectedRole = (state: ReturnType<typeof useAuthStore.getState>): string =>
  state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '';

/** True when the selected portal role is the requested role. */
export function useHasRole(role: TSystemRole): boolean {
  return useAuthStore((state) => selectedRole(state) === role);
}

/** True when the selected portal role is one of the requested roles. */
export function useHasAnyRole(roles: TSystemRole[]): boolean {
  return useAuthStore((state) => roles.some((role) => selectedRole(state) === role));
}
