/**
 * @file layoutStore.ts
 * @description Zustand store for layout UI state (mobile sidebar drawer toggle).
 * @module shared/store
 */

import { create } from 'zustand';

interface ILayoutStore {
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  calendarOpen: boolean;
  openCalendar: () => void;
  closeCalendar: () => void;
  toggleCalendar: () => void;
}

export const useLayoutStore = create<ILayoutStore>((set) => ({
  mobileSidebarOpen: false,
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  calendarOpen: false,
  openCalendar: () => set({ calendarOpen: true }),
  closeCalendar: () => set({ calendarOpen: false }),
  toggleCalendar: () => set((s) => ({ calendarOpen: !s.calendarOpen })),
}));
