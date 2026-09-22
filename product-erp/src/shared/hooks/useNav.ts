/**
 * @file useNav.ts
 * @description Fetches the current user's role-filtered sidebar nav tree
 *   from the backend. Replaces the hardcoded `navConfig.ts`. Gates such as
 *   chat access are resolved server-side before items are returned, so the
 *   Sidebar component does not need to know about them.
 */

import useSwr from './useSwr';

export interface INavLinkDto {
  _id: string;
  label: string;
  href: string;
  icon?: string;
  requiredRoles: string[];
  gate?: 'chat';
  sortOrder: number;
}

export interface INavGroupDto {
  _id: string;
  group: string;
  sortOrder: number;
  items: INavLinkDto[];
}

export function useNav(enabled = true) {
  const { data, isLoading, error, mutate } = useSwr<{ data?: INavGroupDto[] }>(
    enabled ? 'nav/me' : null,
  );
  return {
    groups: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export default useNav;
