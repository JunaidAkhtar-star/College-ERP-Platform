/**
 * @file layout.tsx
 * @description Minimal layout for the standalone admission portal used by
 *   applicants whose admission application is still in progress. NO sidebar,
 *   NO role-scoped nav — just a slim header with the brand and a sign-out
 *   action so the applicant can only see and complete their application.
 * @module app/admission-portal
 */
'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/shared/store/authStore';
import CustomButton from '@/shared/core/CustomButton';
import { disconnectSocket } from '@/shared/hooks/useSocket';
import useSwr from '@/shared/hooks/useSwr';

export default function AdmissionPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: settingsRes } = useSwr<{
    success: boolean;
    data: { name: string; logoUrl?: string };
  }>('institution-setting/public');
  const settings = settingsRes?.data;

  const handleSignOut = () => {
    disconnectSocket();
    clearAuth();
    router.replace('/auth/signin');
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md ">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.name || 'Institution logo'}
                width={40}
                height={40}
                priority
                className="rounded-md object-contain"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">
                ERP
              </span>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900">
                {settings?.name || 'Institution'} Admission Portal
              </p>
              <p className="text-xs text-slate-500">Complete your application to continue</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user?.name && (
              <span className="hidden text-sm text-slate-600 sm:inline">
                Hi, <span className="font-semibold text-slate-900">{user.name}</span>
              </span>
            )}
            <CustomButton
              startIcon={<LogOut className="h-4 w-4" />}
              onClick={handleSignOut}
              className="w-fit!"
            >
              Sign Out
            </CustomButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl p-4">{children}</main>
    </div>
  );
}
