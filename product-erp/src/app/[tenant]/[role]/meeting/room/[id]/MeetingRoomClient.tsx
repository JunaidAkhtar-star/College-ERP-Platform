/**
 * @file MeetingRoomClient.tsx
 * @description Client-side wrapper for dynamically importing MeetingRoomPage with SSR disabled.
 * @module app/[role]/meeting/room/[id]
 */

'use client';

import dynamic from 'next/dynamic';

export const MeetingRoomClient = dynamic(
  () => import('@/features/role-wise-features/meeting/components/MeetingRoomPage'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-primary" />
          <p className="text-sm font-semibold text-slate-600">Preparing your meeting room…</p>
        </div>
      </div>
    ),
  },
);
