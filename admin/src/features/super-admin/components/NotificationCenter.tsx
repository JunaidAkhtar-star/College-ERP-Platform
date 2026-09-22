/**
 * @file NotificationCenter.tsx
 * @description Actionable platform notification inbox for super administrators.
 * @module features/super-admin/components
 */
'use client';

import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';

interface IPlatformNotification {
  _id: string;
  title: string;
  body?: string;
  message?: string;
  actionUrl?: string;
  createdAt: string;
  isRead: boolean;
}

interface INotificationResponse {
  success: boolean;
  data: IPlatformNotification[];
  total: number;
}

function destination(actionUrl?: string): string | null {
  if (!actionUrl || actionUrl === '/notification') return null;
  return actionUrl;
}

export default function NotificationCenter() {
  const router = useRouter();
  const { mutation, isLoading: updating } = useMutation();
  const { data, isLoading, error, mutate } = useSwr<INotificationResponse>(
    'notification/my?limit=100',
    { refreshInterval: 15000 },
  );
  const notifications = data?.data ?? [];
  const unread = notifications.filter((notification) => !notification.isRead).length;

  const markRead = async (notification: IPlatformNotification) => {
    if (!notification.isRead) {
      const response = await mutation(`notification/${notification._id}/read`, {
        method: 'POST',
        isAlert: false,
      });
      if (!response?.results?.success) {
        toast.error('Notification could not be marked as read');
        return;
      }
      await mutate();
    }
    const target = destination(notification.actionUrl);
    if (target) router.push(target);
  };

  const markAllRead = async () => {
    const response = await mutation('notification/read-all', {
      method: 'POST',
      isAlert: false,
    });
    if (!response?.results?.success) {
      toast.error('Notifications could not be updated');
      return;
    }
    await mutate();
    toast.success('All notifications marked as read');
  };

  if (isLoading) return <div className="h-72 animate-pulse rounded-3xl bg-white" />;
  if (error) {
    return (
      <section className="rounded-3xl bg-rose-50 p-8 text-center">
        <p className="text-sm font-semibold text-rose-700">Notifications could not be loaded.</p>
        <CustomButton className="mt-4" onClick={() => void mutate()}>
          Try again
        </CustomButton>
      </section>
    );
  }

  return (
    <section className="admin-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Platform notifications</h2>
          <p className="mt-1 text-sm text-slate-500">
            {unread
              ? `${unread} unread notification${unread === 1 ? '' : 's'}`
              : 'You are up to date'}
          </p>
        </div>
        <CustomButton
          variant="secondary"
          loading={updating}
          disabled={!unread}
          onClick={() => void markAllRead()}
          startIcon={<CheckCheck className="h-4 w-4" />}
        >
          Mark all read
        </CustomButton>
      </div>

      <div className="mt-6 space-y-2">
        {notifications.length ? (
          notifications.map((notification) => (
            <button
              key={notification._id}
              type="button"
              onClick={() => void markRead(notification)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-primary-50 ${
                notification.isRead ? 'bg-slate-50/50' : 'bg-slate-50'
              }`}
            >
              <span className="mt-0.5 rounded-xl bg-primary-50 p-2 text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {notification.title}
                  </span>
                  {!notification.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {notification.body || notification.message || 'Platform notification'}
                </span>
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  {new Date(notification.createdAt).toLocaleString('en-IN')}
                </span>
              </span>
              {destination(notification.actionUrl) && (
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
              )}
            </button>
          ))
        ) : (
          <div className="rounded-2xl bg-emerald-50 p-8 text-center text-sm text-emerald-700">
            No platform notifications yet.
          </div>
        )}
      </div>
    </section>
  );
}
