'use client';

import { type ComponentType, useEffect, useRef } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { Clock, LogIn } from 'lucide-react';
import { useAuthStore } from '@/shared/store/authStore';
import { refreshSession } from '@/shared/utils/refreshSession';
import { getFromLocalStorage } from '@/shared/utils';
import { motion } from '@/shared/utils/motion';
import type { TSystemRole } from '@/shared/types';

function isJwtExpired(token: string): boolean {
  try {
    const [, encodedPayload] = token.split('.');
    if (!encodedPayload) return true;
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function AuthSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#0178d7]" />
        <p className="text-sm text-slate-500">Verifying administrator session…</p>
      </div>
    </div>
  );
}

function SessionExpired({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-5 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white p-8 text-center"
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
          <Clock size={26} />
        </span>
        <h2 className="mt-5 text-xl font-bold text-slate-900">Session ended</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your administrator session expired. Sign in again to continue securely.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0178d7] px-5 py-3 text-sm font-semibold text-white"
        >
          <LogIn size={17} /> Sign in again
        </button>
      </motion.div>
    </div>
  );
}

export default function UseProtectedRoutes<P extends object>(
  PassedComponent: ComponentType<P>,
  allowedRoles: TSystemRole[] = ['super_admin'],
) {
  function ProtectedRoute(props: P) {
    const router = useRouter();
    const hydrated = useAuthStore((state) => state.hydrated);
    const accessToken = useAuthStore((state) => state.accessToken);
    const role = useAuthStore((state) => state.role);
    const sessionExpired = useAuthStore((state) => state.sessionExpired);
    const hydrate = useAuthStore((state) => state.hydrate);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const clearSessionExpired = useAuthStore((state) => state.clearSessionExpired);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
      if (!hydrated) hydrate();
    }, [hydrate, hydrated]);

    useEffect(() => {
      if (!hydrated) return;
      const currentToken = useAuthStore.getState().accessToken;
      const storedRefresh = getFromLocalStorage('refreshToken');

      if ((!currentToken || isJwtExpired(currentToken as string)) && storedRefresh) {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        refreshSession(currentToken)
          .then((fresh) => {
            if (!fresh) clearAuth();
          })
          .catch(() => clearAuth())
          .finally(() => {
            isRefreshingRef.current = false;
          });
      }
    }, [accessToken, clearAuth, hydrated]);

    const hasRefreshToken =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('refreshToken'));
    const isTokenValid = Boolean(accessToken) && !isJwtExpired(accessToken as string);

    const authorized =
      hydrated &&
      (isTokenValid || hasRefreshToken) &&
      role === 'super_admin' &&
      allowedRoles.includes('super_admin');

    useEffect(() => {
      if (!hydrated || authorized) return;
      clearAuth();
      router.replace('/auth/signin');
    }, [authorized, clearAuth, hydrated, router]);

    if (sessionExpired) {
      return (
        <SessionExpired
          onSignIn={() => {
            clearSessionExpired();
            clearAuth();
            router.replace('/auth/signin');
          }}
        />
      );
    }

    if (!authorized || !isTokenValid) return <AuthSkeleton />;
    return <PassedComponent {...props} />;
  }

  ProtectedRoute.displayName = `AdminProtected(${PassedComponent.displayName || PassedComponent.name || 'Component'})`;
  return ProtectedRoute;
}
