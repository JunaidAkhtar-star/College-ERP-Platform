'use client';

import { createContext, useContext } from 'react';

interface IAdminPageContext {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

const AdminPageContext = createContext<IAdminPageContext | null>(null);

export const AdminPageProvider = AdminPageContext.Provider;

export function useAdminPageContext(): IAdminPageContext {
  const context = useContext(AdminPageContext);
  if (!context) throw new Error('useAdminPageContext must be used inside the admin layout.');
  return context;
}
