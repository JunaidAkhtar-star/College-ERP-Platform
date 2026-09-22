/**
 * @file Navbar.tsx
 * @description Contextual operator header with global search, real alerts and account actions.
 * @module features/super-admin/components
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import { Bell, ChevronDown, LogOut, Menu, Search, Settings2, UserCog } from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useAuthStore } from '@/shared/store/authStore';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { ILead, ITenant, TActiveTab } from '../types/super-admin.types';
import { getAdminPushDeviceId } from '@/shared/hooks/useFcm';

interface INavbarProps {
  activeTab: TActiveTab;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tenants: ITenant[];
  leads: ILead[];
  onOpenSidebar: () => void;
}

const titles: Record<TActiveTab, { title: string; description: string }> = {
  dashboard: {
    title: 'Operations overview',
    description: 'Monitor growth, onboarding and platform risk.',
  },
  tenants: {
    title: 'Tenant operations',
    description: 'Provision and govern isolated college workspaces.',
  },
  leads: {
    title: 'CRM pipeline',
    description: 'Qualify and convert incoming institution inquiries.',
  },
  licenses: {
    title: 'Subscriptions',
    description: 'Review limits, renewals and commercial status.',
  },
  products: {
    title: 'Product catalogue',
    description: 'Register ERP modules, features and route mappings.',
  },
  plans: {
    title: 'Plans and packaging',
    description: 'Bundle product modules into subscription offerings.',
  },
  billing: {
    title: 'Billing & payments',
    description: 'Reconcile successful, failed and refunded platform transactions.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Review platform alerts and open the related operational work.',
  },
  'public-site': {
    title: 'Public website',
    description: 'Publish company, contact and social profile values.',
  },
  settings: {
    title: 'Platform & Integration Center',
    description: 'Configure, test and govern platform providers and administrator access.',
  },
  'customer-operations': {
    title: 'Implementation & support',
    description: 'Coordinate tenant go-lives and operate support against visible SLAs.',
  },
  profile: { title: 'My account', description: 'Manage the authenticated product-owner account.' },
};

const REFERENCE_TIME = Date.now();

export default function Navbar(props: INavbarProps) {
  const { activeTab, searchQuery, setSearchQuery, tenants, leads, onOpenSidebar } = props;
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.clearAuth);
  const { mutation: notificationMutation } = useMutation();
  const { data: platformNotificationResponse, mutate: refreshNotifications } = useSwr<{
    success: boolean;
    data: Array<{
      _id: string;
      title: string;
      body?: string;
      message?: string;
      actionUrl?: string;
      isRead?: boolean;
      createdAt: string;
    }>;
  }>('notification/my?limit=20', { refreshInterval: 15000 });
  const platformNotifications = platformNotificationResponse?.data ?? [];
  const alerts = [
    ...(platformNotifications ?? []).map((notification) => ({
      id: notification._id,
      title: notification.title,
      detail: notification.body || notification.message || 'Platform notification',
      actionUrl: notification.actionUrl,
      persisted: true,
      unread: notification.isRead !== true,
    })),
    ...tenants
      .filter((tenant) => tenant.status === 'provisioning_failed')
      .map((tenant) => ({
        id: tenant._id,
        title: `${tenant.name} provisioning failed`,
        detail: 'Review backend provisioning logs.',
        actionUrl: '/tenants',
        persisted: false,
        unread: true,
      })),
    ...tenants
      .filter(
        (tenant) =>
          new Date(tenant.subscriptionExpiresAt).getTime() < REFERENCE_TIME + 30 * 86_400_000,
      )
      .map((tenant) => ({
        id: `expiry-${tenant._id}`,
        title: `${tenant.name} renewal approaching`,
        detail: `Expires ${new Date(tenant.subscriptionExpiresAt).toLocaleDateString('en-IN')}`,
        actionUrl: '/licenses',
        persisted: false,
        unread: true,
      })),
    ...leads
      .filter((lead) => lead.status === 'pending')
      .slice(0, 4)
      .map((lead) => ({
        id: lead._id,
        title: `New inquiry from ${lead.collegeName}`,
        detail: `${lead.name} is awaiting follow-up.`,
        actionUrl: '/leads',
        persisted: false,
        unread: true,
      })),
  ];
  const unreadCount = alerts.filter((alert) => alert.unread).length;
  const searchable = activeTab === 'tenants' || activeTab === 'leads';

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
        setAlertsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeMenus);
    return () => document.removeEventListener('pointerdown', closeMenus);
  }, []);

  const handleAlertClick = async (alert: (typeof alerts)[number]) => {
    if (alert.persisted && alert.unread) {
      const response = await notificationMutation(`notification/${alert.id}/read`, {
        method: 'POST',
        isAlert: false,
      });
      if (response?.results?.success) await refreshNotifications();
    }
    setAlertsOpen(false);
    if (alert.actionUrl) router.push(alert.actionUrl);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onOpenSidebar}
          className="cursor-pointer rounded-lg bg-slate-100 p-2.5 text-slate-600 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
            {titles[activeTab].title}
          </h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            {titles[activeTab].description}
          </p>
        </div>

        {searchable && (
          <label className="relative hidden w-72 lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search records</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full rounded-xl bg-slate-100 py-2.5 pl-10 pr-4 text-sm outline-none ring-primary focus:ring-2"
            />
          </label>
        )}

        <div ref={controlsRef} className="flex items-center gap-2">
          <div className="relative">
            <button
              aria-label="Operational alerts"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'default'
                ) {
                  window.dispatchEvent(new Event('admin:enable-web-push'));
                }
                setAlertsOpen((value) => !value);
                setProfileOpen(false);
              }}
              className="relative cursor-pointer rounded-lg bg-slate-100 p-2.5 text-slate-600 hover:text-primary"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-[9px] font-bold text-white">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>
            <AnimatePresence>
              {alertsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-3 ring-1 ring-slate-200"
                >
                  <div className="px-2 pb-2">
                    <p className="text-sm font-bold text-slate-800">Operational alerts</p>
                    <p className="text-xs text-slate-500">
                      Generated from current tenant and lead records.
                    </p>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-auto">
                    {alerts.length ? (
                      alerts.slice(0, 8).map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => void handleAlertClick(alert)}
                          className={`relative w-full cursor-pointer rounded-xl p-3 text-left transition-colors hover:bg-primary-50 ${
                            alert.unread ? 'bg-slate-50' : 'bg-white'
                          }`}
                        >
                          <p className="pr-3 text-xs font-semibold text-slate-800">{alert.title}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{alert.detail}</p>
                          {alert.unread && (
                            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-700">
                        No current operational alerts.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAlertsOpen(false);
                      router.push('/notifications');
                    }}
                    className="mt-2 w-full cursor-pointer rounded-xl bg-primary-50 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary-100"
                  >
                    View all notifications
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen((value) => !value);
                setAlertsOpen(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 p-1.5 pr-2.5"
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-xs font-bold text-white">
                {user?.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name || 'Administrator profile'}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  user?.name?.slice(0, 2).toUpperCase() || 'SA'
                )}
              </span>
              <span className="hidden max-w-44 text-left md:block">
                <span className="block truncate text-xs font-semibold text-slate-700">
                  {user?.name || 'SaaS administrator'}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {user?.email || 'Authenticated account'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-3 w-64 rounded-2xl bg-white p-2 ring-1 ring-slate-200"
                >
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-xs font-bold text-white">
                      {user?.avatar ? (
                        <Image
                          src={user.avatar}
                          alt={user.name || 'Administrator profile'}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        user?.name?.slice(0, 2).toUpperCase() || 'SA'
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {user?.name || 'SaaS administrator'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user?.email || 'Authenticated account'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      router.push('/profile');
                      setProfileOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <UserCog className="h-4 w-4" />
                    My account
                  </button>
                  <button
                    onClick={() => {
                      router.push('/settings');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Settings2 className="h-4 w-4" />
                    Platform settings
                  </button>
                  <button
                    onClick={() => {
                      notificationMutation('super-admin/fcm-token', {
                        method: 'DELETE',
                        body: { platform: 'web', deviceId: getAdminPushDeviceId() },
                        isAlert: false,
                      }).catch(() => undefined);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {searchable && (
        <label className="relative mt-3 block lg:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search records</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full rounded-xl bg-slate-100 py-2.5 pl-10 pr-4 text-sm outline-none ring-primary focus:ring-2"
          />
        </label>
      )}
    </header>
  );
}
