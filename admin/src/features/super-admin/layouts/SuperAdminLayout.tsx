'use client';

import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { useFcm } from '@/shared/hooks/useFcm';
import useSwr from '@/shared/hooks/useSwr';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { AdminPageProvider } from '../context/AdminPageContext';
import type { ILead, IPlatformOverview, ITenant, TActiveTab } from '../types/super-admin.types';

const routeTabs: Record<string, TActiveTab> = {
  '/': 'dashboard',
  '/tenants': 'tenants',
  '/leads': 'leads',
  '/licenses': 'licenses',
  '/products': 'products',
  '/plans': 'plans',
  '/billing': 'billing',
  '/notifications': 'notifications',
  '/public-site': 'public-site',
  '/settings': 'settings',
  '/customer-operations': 'customer-operations',
  '/profile': 'profile',
};

function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isOverview = pathname === '/';

  useFcm({
    onForegroundMessage: (payload) => {
      const title =
        payload.notification?.title || payload.data?.['title'] || 'Devvelocity Notification';
      const body = payload.notification?.body || payload.data?.['body'] || '';
      const icon =
        (payload.data?.['icon'] as string | undefined) ||
        (payload.data?.['tenantLogo'] as string | undefined) ||
        (payload.data?.['avatar'] as string | undefined) ||
        payload.notification?.icon ||
        payload.notification?.image ||
        '/devvelocitylogo.webp';

      if (
        title &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification(title, {
                body,
                icon,
                badge: '/devvelocitylogo.webp',
                data: payload.data,
              });
            })
            .catch(() => {
              try {
                new Notification(title, { body, icon });
              } catch {
                // best-effort
              }
            });
        } else {
          try {
            new Notification(title, { body, icon });
          } catch {
            // best-effort
          }
        }
      }
    },
  });
  const { data: overviewRaw } = useSwr<{ data?: IPlatformOverview }>(
    isOverview ? 'super-admin/overview' : null,
  );
  const { data: tenantsRaw } = useSwr<{ data?: ITenant[] }>(
    isOverview ? null : 'super-admin/tenants',
  );
  const { data: leadsRaw } = useSwr<{ data?: ILead[] }>(isOverview ? null : 'super-admin/leads');
  const tenants = isOverview ? (overviewRaw?.data?.tenants ?? []) : (tenantsRaw?.data ?? []);
  const leads = isOverview ? (overviewRaw?.data?.leads ?? []) : (leadsRaw?.data ?? []);
  const activeTab = useMemo(() => routeTabs[pathname] ?? 'dashboard', [pathname]);

  return (
    <AdminPageProvider value={{ searchQuery, setSearchQuery }}>
      <div className="admin-shell min-h-dvh text-slate-800">
        <Sidebar
          tenantsCount={tenants.length}
          leadsCount={leads.length}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={() => setSearchQuery('')}
        />
        <div className="min-h-dvh lg:pl-64">
          <Navbar
            activeTab={activeTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            tenants={tenants}
            leads={leads}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <main className="mx-auto w-full max-w-400 p-3.5 sm:p-6">{children}</main>
        </div>
      </div>
    </AdminPageProvider>
  );
}

export default UseProtectedRoutes(SuperAdminLayout, ['super_admin']);
