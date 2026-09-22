/**
 * @file index.tsx
 * @description DefaultLayout — fixed sidebar + sticky header shell with global calling features.
 * @module shared/layouts
 */

'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import UseProtectedRoutes from '../hooks/UseProtectedRoutes';
import { useSocket } from '../hooks/useSocket';
import { useCallStore } from '../store/callStore';
import Header from './Header';
import Sidebar from './Sidebar';
import useSwr from '../hooks/useSwr';
import { useAuthStore } from '../store/authStore';
import { getTenantRolePath } from '../utils';
import WorkspaceSkeleton from '../core/WorkspaceSkeleton';

const CallOverlay = dynamic(
  () => import('@/features/role-wise-features/chat/components/CallOverlay'),
  { ssr: false },
);

interface IDefaultLayoutProps {
  children: React.ReactNode;
}

const DefaultLayout = ({ children }: IDefaultLayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const isInstitutionOwner = role === 'super_admin' || role === 'admin';
  const isOnboarding = pathname?.includes('/onboarding');
  const {
    data: institutionSettings,
    error: institutionError,
    isLoading: isLoadingInstitution,
    mutate: retryInstitutionSettings,
  } = useSwr<{
    data?: { onboardingStatus?: 'pending' | 'completed' };
  }>(isInstitutionOwner ? 'institution-setting' : null);
  const onboardingStatus = institutionSettings?.data?.onboardingStatus;
  const { socket } = useSocket();
  const { callState, setCallState, resetCallState } = useCallStore();

  const isMeetingRoom = pathname?.includes('/meeting/room/');

  useEffect(() => {
    if (!isInstitutionOwner || isLoadingInstitution || institutionError) return;
    if (onboardingStatus !== 'completed' && !isOnboarding) {
      router.replace(getTenantRolePath(role, '/onboarding'));
    } else if (onboardingStatus === 'completed' && isOnboarding) {
      router.replace(getTenantRolePath(role, '/dashboard'));
    }
  }, [
    institutionError,
    isInstitutionOwner,
    isLoadingInstitution,
    isOnboarding,
    onboardingStatus,
    role,
    router,
  ]);

  // ── Global Socket Listeners for Video/Voice Calling ───────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncomingCall = (payload: {
      callerId: string;
      callerName: string;
      callerAvatar: string;
      signalData: unknown;
      type: 'audio' | 'video';
      conversationId: string;
    }) => {
      // If already on a call or ringing, we reply with busy signaling
      if (
        callState.isActive ||
        callState.isIncoming ||
        callState.callerId ||
        callState.targetUserId
      ) {
        socket.emit('call_busy', { targetUserId: payload.callerId });
        return;
      }

      setCallState({
        isActive: false,
        isIncoming: true,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        type: payload.type,
        conversationId: payload.conversationId,
        signalData: payload.signalData,
      });
    };

    const onIncomingCallWaiting = (payload: {
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      type: 'audio' | 'video';
      conversationId: string;
      signalData?: unknown;
    }) => {
      setCallState({
        waitingCall: {
          callerId: payload.callerId,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar,
          type: payload.type,
          conversationId: payload.conversationId,
          signalData: payload.signalData,
        },
      });
    };

    const onCallWaiting = () => {
      setCallState({ isCallWaiting: true });
    };

    const onCallWaitingRejected = () => {
      resetCallState();
    };

    const onJoinExistingChannel = (payload: { conversationId: string }) => {
      setCallState({
        isActive: true,
        isCallWaiting: false,
        conversationId: payload.conversationId,
        callStartTime: Date.now(),
      });
      socket.emit('accept_call', {
        callerId: callState.targetUserId || callState.callerId,
        conversationId: payload.conversationId,
        callType: callState.type,
        signalData: {},
      });
    };

    const onCallAccepted = (payload: { signalData: unknown }) => {
      setCallState({ isActive: true, signalData: payload.signalData, callStartTime: Date.now() });
    };

    const onCallRejected = () => {
      resetCallState();
    };

    const onCallEnded = () => {
      resetCallState();
    };

    socket.on('incoming_call', onIncomingCall);
    socket.on('incoming_call_waiting', onIncomingCallWaiting);
    socket.on('call_waiting', onCallWaiting);
    socket.on('call_waiting_rejected', onCallWaitingRejected);
    socket.on('join_existing_channel', onJoinExistingChannel);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('incoming_call_waiting', onIncomingCallWaiting);
      socket.off('call_waiting', onCallWaiting);
      socket.off('call_waiting_rejected', onCallWaitingRejected);
      socket.off('join_existing_channel', onJoinExistingChannel);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
    };
  }, [socket, setCallState, resetCallState, callState]);

  // ── Call Actions ───────────────────────────────────────────────────────────
  const handleAcceptCall = useCallback(() => {
    if (!socket || !callState.callerId) return;
    setCallState({ isActive: true, callStartTime: Date.now() });
    socket.emit('accept_call', {
      callerId: callState.callerId,
      conversationId: callState.conversationId,
      callType: callState.type,
      signalData: {},
    });
  }, [socket, callState.callerId, callState.conversationId, callState.type, setCallState]);

  const handleRejectCall = useCallback(() => {
    if (!socket || !callState.callerId) return;
    resetCallState();
    socket.emit('reject_call', {
      callerId: callState.callerId,
      conversationId: callState.conversationId,
      callType: callState.type,
    });
  }, [socket, callState.callerId, callState.conversationId, callState.type, resetCallState]);

  const handleHangUp = useCallback(() => {
    if (!socket) return;
    const peerId = callState.targetUserId || callState.callerId;
    if (peerId) {
      socket.emit('end_call', {
        targetUserId: peerId,
        conversationId: callState.conversationId,
        callType: callState.type,
        wasActive: callState.isActive,
      });
    }
    resetCallState();
  }, [socket, callState, resetCallState]);

  const handleEndAndAcceptCall = useCallback(() => {
    if (!socket || !callState.waitingCall) return;
    const currentPeerId = callState.targetUserId || callState.callerId;
    if (currentPeerId) {
      socket.emit('end_call', {
        targetUserId: currentPeerId,
        conversationId: callState.conversationId,
        callType: callState.type,
        wasActive: callState.isActive,
      });
    }
    const waiting = callState.waitingCall;
    setCallState({
      isActive: true,
      isIncoming: false,
      callerId: waiting.callerId,
      callerName: waiting.callerName,
      callerAvatar: waiting.callerAvatar,
      type: waiting.type,
      conversationId: waiting.conversationId,
      signalData: waiting.signalData,
      callStartTime: Date.now(),
      waitingCall: null,
    });
    socket.emit('accept_call', {
      callerId: waiting.callerId,
      conversationId: waiting.conversationId,
      callType: waiting.type,
      signalData: {},
    });
  }, [socket, callState, setCallState]);

  const handleRejectWaitingCall = useCallback(() => {
    if (!socket || !callState.waitingCall) return;
    socket.emit('reject_waiting_call', { callerId: callState.waitingCall.callerId });
    setCallState({ waitingCall: null });
  }, [socket, callState.waitingCall, setCallState]);

  const handleMergeCall = useCallback(() => {
    if (!socket || !callState.waitingCall || !callState.conversationId) return;
    socket.emit('merge_call', {
      targetUserId: callState.waitingCall.callerId,
      conversationId: callState.conversationId,
    });
    setCallState({ waitingCall: null });
  }, [socket, callState.waitingCall, callState.conversationId, setCallState]);

  // ── Ringing Timeout (60 seconds) ───────────────────────────────────────────
  useEffect(() => {
    const isRinging =
      (callState.isIncoming || callState.targetUserId || callState.callerId) && !callState.isActive;
    if (!isRinging) return;

    const timeoutId = setTimeout(() => {
      if (callState.isIncoming) {
        handleRejectCall();
      } else {
        handleHangUp();
      }
    }, 60000); // 60 seconds (1 minute)

    return () => clearTimeout(timeoutId);
  }, [
    callState.isIncoming,
    callState.isActive,
    callState.targetUserId,
    callState.callerId,
    handleRejectCall,
    handleHangUp,
  ]);

  if (isMeetingRoom) {
    return <div className="min-h-dvh bg-slate-50 text-slate-900">{children}</div>;
  }

  if (isInstitutionOwner && institutionError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Workspace setup could not load</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {institutionError instanceof Error
              ? institutionError.message
              : 'Please check your connection and try again.'}
          </p>
          <button
            type="button"
            onClick={() => void retryInstitutionSettings()}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isInstitutionOwner && (isLoadingInstitution || onboardingStatus !== 'completed')) {
    if (isOnboarding && !isLoadingInstitution) {
      return <div className="min-h-dvh bg-slate-50">{children}</div>;
    }
    return (
      <div className="min-h-dvh bg-slate-50 px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <WorkspaceSkeleton label="Loading institution workspace" />
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-workspace min-h-dvh bg-slate-50/70">
      <Sidebar />

      <div className="flex min-h-dvh flex-col [margin-left:var(--sidebar-w,0px)] transition-[margin-left] duration-260 ease-in-out">
        <Header />

        {/* Page canvas */}
        <main className="tenant-page-canvas flex-1">
          <div className="tenant-page-content mx-auto w-full max-w-[1920px] p-4 sm:p-5 2xl:px-7">
            {children}
          </div>
        </main>

        {/* Subtle page footer */}
        <footer className="shrink-0 border-t  w-full border-slate-100 bg-slate-50 px-6 py-3">
          <p className="select-none text-[10px] text-slate-600">
            © {new Date().getFullYear()} Institution ERP — All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Global Call Overlay ──────────────────────────────────────────────── */}
      {(callState.isActive ||
        callState.isIncoming ||
        (!callState.isIncoming && (callState.targetUserId || callState.callerId))) && (
        <CallOverlay
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onHangUp={handleHangUp}
          onAcceptWaiting={handleEndAndAcceptCall}
          onRejectWaiting={handleRejectWaitingCall}
          onMergeWaiting={handleMergeCall}
        />
      )}
    </div>
  );
};

export default UseProtectedRoutes(DefaultLayout);
