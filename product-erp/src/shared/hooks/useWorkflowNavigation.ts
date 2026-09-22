'use client';

import { useMemo } from 'react';
import useNav from './useNav';

export interface IWorkflowNavigationItem {
  route: string;
}

/** Uses the server-verified RBAC + subscription nav tree as the sole authority. */
export function useWorkflowNavigation<T extends IWorkflowNavigationItem>(items: readonly T[]): T[] {
  const { groups, isLoading } = useNav();
  const allowed = useMemo(
    () => new Set(groups.flatMap((group) => group.items.map((item) => item.href))),
    [groups],
  );

  return useMemo(() => {
    if (isLoading) return [];
    return items.filter((item) => {
      const href = `/${item.route}`;
      return allowed.has(href) || [...allowed].some((parent) => href.startsWith(`${parent}/`));
    });
  }, [allowed, isLoading, items]);
}
