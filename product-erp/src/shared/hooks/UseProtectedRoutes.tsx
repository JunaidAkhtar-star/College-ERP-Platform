/**
 * @file UseProtectedRoutes.tsx
 * @description Higher-order component (HOC) that enforces authentication and
 *              role-based access control on every dashboard page.
 *
 *  Protection layers (in order):
 *  1. Hydrates Zustand auth store from localStorage on mount — no content flash.
 *  2. Skeleton loader while hydration is in progress.
 *  3. Session-expired overlay when:
 *       a) API returns 401 mid-session (useSwr / useMutation call markSessionExpired)
 *       b) Token is found expired during the real-time poll (every 60 s)
 *       c) Tab becomes visible again and token is expired
 *     — Shows a modal with countdown (10 s) then auto-redirects to /auth/signin.
 *  4. Unauthenticated redirect → /auth/signin with toast.
 *  5. Corrupted auth state (no role) → clears store, redirects, shows toast.
 *  6. URL role mismatch (e.g. /student/dashboard for a faculty user) → redirects
 *     to correct portal with toast.
 *  7. Explicit `allowedRoles` check → 403 view.
 *  8. Nav-driven route check — cross-references the current pathname against
 *     the user's role-filtered nav tree (`nav/me`). If the module isn't in
 *     their nav (and isn't in the personal-page allowlist), shows 403. This
 *     stops manual URL entry from bypassing menu-level RBAC.
 *  9. Otherwise renders the wrapped component normally.
 *
 * @module shared/hooks
 */

'use client';

import React, { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'react-toastify';
import { ShieldOff, AlertTriangle, Clock, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { TSystemRole } from '@/shared/types';

import { useAuthStore } from '@/shared/store/authStore';
import { useNav } from '@/shared/hooks/useNav';
import { disconnectSocket } from '@/shared/hooks/useSocket';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { refreshSession } from '@/shared/utils/refreshSession';
import { getFromLocalStorage, getTenantRolePath } from '@/shared/utils';
import type { IActiveRole, ILoginResponse } from '@/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 < Date.now() : true;
  } catch {
    return true;
  }
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  principal: 'Principal',
  dean_academic: 'Dean Academic',
  hod: 'Head of Department',
  faculty: 'Faculty',
  student: 'Student',
  parent: 'Parent',
  examination_cell: 'Examination Cell',
  iqac_team: 'IQAC Team',
  scholarship_cell: 'Scholarship Cell',
  library_staff: 'Library Staff',
  placement_cell: 'Placement Cell',
  hr_department: 'HR Department',
  accounts_department: 'Accounts Department',
  admission_counselor: 'Admission Counselor',
};

// ─── Full-page skeleton ───────────────────────────────────────────────────────

function AuthSkeleton() {
  return (
    <div
      className="min-h-dvh w-full bg-slate-50 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Verifying your session"
    >
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="space-y-2">
            <div className="h-4 w-36 rounded-full bg-slate-200" />
            <div className="h-3 w-52 rounded-full bg-slate-100" />
          </div>
          <div className="size-10 rounded-full bg-blue-50" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="h-3 w-24 rounded-full bg-slate-100" />
              <div className="mt-5 h-8 w-16 rounded-lg bg-slate-200" />
              <div className="mt-4 h-3 w-full rounded-full bg-blue-50" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
        </div>
        <span className="sr-only">Verifying session…</span>
      </div>
    </div>
  );
}

// ─── Session Expired Modal ─────────────────────────────────────────────────────

function SessionExpiredModal({ onSignIn }: { onSignIn: () => void }) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown <= 0) {
      onSignIn();
      return;
    }
    const t = setTimeout(() => setCountdown((c: number) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onSignIn]);

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-100/90 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white p-8 text-center"
      >
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>

        <h2 className="text-xl font-bold text-slate-900">Session Ended</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your session has expired or you were signed out from another device. You will be
          redirected to the sign-in page.
        </p>

        {/* Countdown ring */}
        <div className="mx-auto my-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <span className="text-xl font-bold text-primary">{countdown}</span>
        </div>

        <button
          onClick={onSignIn}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <LogIn className="h-4 w-4" />
          Sign In Again
        </button>
        <p className="mt-2 text-xs text-slate-600">Auto-redirecting in {countdown}s</p>
      </motion.div>
    </div>
  );
}

// ─── Unauthorized / 403 view ──────────────────────────────────────────────────

function UnauthorizedView({ role, allowedRoles }: { role: string; allowedRoles?: TSystemRole[] }) {
  const router = useRouter();

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-5 bg-slate-50 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
        <ShieldOff className="h-10 w-10 text-red-400" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-sm text-slate-500">
          Your role (
          <span className="font-semibold text-slate-700">{ROLE_LABELS[role] ?? role}</span>) does
          not have permission to access this page.
        </p>
        {allowedRoles && allowedRoles.length > 0 && (
          <p className="mt-1 text-xs text-slate-600">
            Accessible by: {allowedRoles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
          </p>
        )}
      </div>
      <button
        onClick={() => router.replace(getTenantRolePath(role, '/dashboard'))}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Go to My Dashboard
      </button>
    </div>
  );
}

// ─── Role Mismatch view (shown briefly while redirecting) ─────────────────────

function RoleMismatchScreen() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <p className="text-sm text-slate-500">Redirecting to your portal…</p>
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
    </div>
  );
}

function AccessPolicyError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-5 bg-slate-50 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold text-slate-800">Access policy unavailable</h1>
        <p className="text-sm leading-6 text-slate-500">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

const KNOWN_ROLES: string[] = [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'administration_office',
  'assistant_administration_officer',
  'hod',
  'faculty',
  'student',
  'parent',
  'examination_cell',
  'iqac_naac',
  'iqac_team',
  'scholarship_cell',
  'library_staff',
  'placement_cell',
  'hr_department',
  'accounts_department',
  'admission_counselor',
  'admission_incharge',
  'hostel_warden',
  'transportation',
  'research_development',
  'club_head',
  'iic',
  'store',
];

// Personal pages every authenticated user can reach regardless of nav config.
// These are user-owned views (own profile, own security, own notifications)
// or universal entry points that should never be RBAC-gated.
const PERSONAL_PAGE_SEGMENTS: string[] = [
  'dashboard',
  'profile',
  'settings',
  'notification',
  'onboarding',
  'chat',
];

/**
 * Strips the optional tenant prefix and the role prefix from the pathname.
 * E.g. /mit/student/dashboard -> /dashboard
 * E.g. /student/dashboard -> /dashboard
 */
function getCleanRelativePath(pathname: string, role: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '/';

  // If the first segment is not a known role, it's a tenantId prefix (e.g. "mit")
  if (!KNOWN_ROLES.includes(segments[0])) {
    segments.shift(); // Remove the tenant segment
  }

  // If the next segment matches the user's role (normalising hyphens/underscores), remove it
  const normalizedSegment = segments[0]?.replace(/-/g, '_');
  if (normalizedSegment === role) {
    segments.shift();
  }

  return '/' + segments.join('/');
}

/**
 * Returns true when the user is permitted to view this URL based on their
 * role-filtered nav. A match is any nav href that is a prefix of the path
 * (so detail / nested routes inherit access from their parent module).
 */
function isPathInUserNav(relPath: string, navHrefs: string[]): boolean {
  if (!navHrefs.length) return false;
  return navHrefs.some((href) => relPath === href || relPath.startsWith(`${href}/`));
}

// ─── HOC ──────────────────────────────────────────────────────────────────────

/**
 * Wraps any component with full auth + RBAC protection.
 *
 * @example
 * // Any authenticated user may access
 * export default UseProtectedRoutes(MyPage);
 *
 * @example
 * // Only super_admin and principal
 * export default UseProtectedRoutes(MyPage, ['super_admin', 'principal']);
 */
const UseProtectedRoutes = <P extends object>(
  PassedComponent: ComponentType<P>,
  allowedRoles?: TSystemRole[],
  /**
   * Optional permission gate. When provided, the active role must grant AT
   * LEAST ONE of the listed `[module, action]` pairs. Evaluated only after
   * the role doc with permissions has loaded — otherwise we fall back to
   * the role-name guard above.
   */
  allowedPermissions?: [string, string][],
) => {
  type GuardState =
    | 'loading'
    | 'ok'
    | 'unauthenticated'
    | 'invalid-session'
    | 'wrong-portal'
    | 'switching-role'
    | 'onboarding-required'
    | 'access-error'
    | 'forbidden'
    | 'pending-applicant';

  function ProtectedRouteComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();

    const hydrated = useAuthStore((s) => s.hydrated);
    const accessToken = useAuthStore((s) => s.accessToken);
    const role = useAuthStore((s) => s.role);
    const user = useAuthStore((s) => s.user);
    const activeRoleDoc = useAuthStore((s) => s.activeRole);
    const roleTransitionTarget = useAuthStore((s) => s.roleTransitionTarget);
    const setAuth = useAuthStore((s) => s.setAuth);
    const setRoleContext = useAuthStore((s) => s.setRoleContext);
    const sessionExpired = useAuthStore((s) => s.sessionExpired);
    const hydrate = useAuthStore((s) => s.hydrate);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const markExpired = useAuthStore((s) => s.markSessionExpired);
    const clearExpired = useAuthStore((s) => s.clearSessionExpired);
    const { mutation: switchRole } = useMutation();
    const switchingRoleRef = useRef<string | null>(null);
    const isRefreshingRef = useRef(false);
    const { data: contextResponse } = useSwr<{
      data?: { role?: IActiveRole | null };
    }>(hydrated && accessToken ? 'auth/context' : null);

    useEffect(() => {
      const authoritativeRole = contextResponse?.data?.role;
      if (authoritativeRole) setRoleContext(authoritativeRole);
    }, [contextResponse, setRoleContext]);

    // Pull the user's allowed nav so we can verify the current URL is one of
    // the modules they're permitted to see. SWR caches this across pages.
    // Institution onboarding is deliberately available before the tenant nav
    // policy exists. Fetching nav/me here creates a circular dependency because
    // the backend blocks ERP modules until onboarding has been completed.
    const requiresTenantNavigation = !pathname?.includes('/onboarding');
    const {
      groups: navGroups,
      isLoading: navLoading,
      error: navError,
      mutate: refreshNav,
    } = useNav(requiresTenantNavigation);
    const allowedNavHrefs = useMemo(
      () => navGroups.flatMap((g) => g.items.map((i) => i.href)),
      [navGroups],
    );

    // ── 1. Hydrate on mount ────────────────────────────────────────────────
    useEffect(() => {
      if (!hydrated) hydrate();
    }, [hydrated, hydrate]);

    // ── 2. Derive guard state synchronously during render ─────────────────
    const guardState = useMemo((): GuardState => {
      if (!hydrated) return 'loading';
      if (!accessToken) {
        const storedRefresh = getFromLocalStorage('refreshToken');
        if (storedRefresh) return 'loading';
        return 'unauthenticated';
      }
      if (isJwtExpired(accessToken)) {
        const storedRefresh = getFromLocalStorage('refreshToken');
        if (storedRefresh) return 'loading';
        return 'unauthenticated';
      }
      if (!role) return 'invalid-session';
      // The header already owns this role change. Suppress the URL-sync switch
      // while its new token, role policy and destination are being committed.
      if (roleTransitionTarget) {
        const transitionSegments = pathname?.split('/').filter(Boolean) ?? [];
        const transitionUrlRole = KNOWN_ROLES.includes(transitionSegments[0])
          ? transitionSegments[0]
          : transitionSegments[1];
        if (role !== roleTransitionTarget || transitionUrlRole !== roleTransitionTarget) {
          return 'loading';
        }
      }
      if (
        ['super_admin', 'admin'].includes(role) &&
        navError instanceof Error &&
        /institution setup|onboarding/i.test(navError.message)
      ) {
        return 'onboarding-required';
      }
      if (navError) return 'access-error';

      // Pending-applicant lock: a logged-in student whose admission application
      // is not yet enrolled is restricted to the standalone /admission-portal.
      const appStatus = (user as { applicationStatus?: string } | null)?.applicationStatus;
      if (appStatus && appStatus !== 'enrolled') {
        return 'pending-applicant';
      }
      const segments = pathname?.split('/').filter(Boolean) ?? [];
      let urlRole = segments[0];
      if (urlRole && !KNOWN_ROLES.includes(urlRole) && segments[1]) {
        urlRole = segments[1];
      }

      // Multi-role: allow visiting ANY portal segment the user is assigned to.
      // Only block when the URL role isn't one of theirs.
      const userRoles = (user?.roles ?? []) as string[];
      if (
        urlRole &&
        KNOWN_ROLES.includes(urlRole) &&
        userRoles.length > 0 &&
        !userRoles.includes(urlRole)
      ) {
        return 'wrong-portal';
      }
      if (urlRole && KNOWN_ROLES.includes(urlRole) && urlRole !== role) {
        return 'switching-role';
      }
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role))
        return 'forbidden';

      // Permission-based gate (when supplied). Skipped until role doc has
      // loaded so we don't deny access before the grid is available.
      if (allowedPermissions && allowedPermissions.length > 0) {
        const perms = activeRoleDoc?.permissions ?? [];
        const ok = allowedPermissions.some(([m, a]) =>
          perms.some((p) => p.module === m && p.actions.includes(a)),
        );
        if (!ok) return 'forbidden';
      }

      // Nav-driven route check. Role allowlists and permission gates are
      // additional constraints; neither may bypass the tenant's role-filtered
      // navigation and commercial module policy.
      // Personal pages (dashboard, profile, settings, notification, onboarding)
      // do not depend on nav policies — render them immediately without flashing
      // a redundant session verification loader on login.
      const relPath = getCleanRelativePath(pathname ?? '', role);
      const firstSegment = relPath.split('/').filter(Boolean)[0] ?? '';
      if (firstSegment && !PERSONAL_PAGE_SEGMENTS.includes(firstSegment)) {
        if (navLoading) return 'loading';
        if (!isPathInUserNav(relPath, allowedNavHrefs)) return 'forbidden';
      }

      return 'ok';
    }, [
      hydrated,
      accessToken,
      role,
      navError,
      user,
      pathname,
      navLoading,
      allowedNavHrefs,
      activeRoleDoc,
      roleTransitionTarget,
    ]);

    // ── Securely rotate tokens when navigating to another assigned role ──
    useEffect(() => {
      if (!hydrated || !role || roleTransitionTarget || guardState !== 'switching-role' || !user)
        return;
      const segments = pathname?.split('/').filter(Boolean) ?? [];
      let urlRole = segments[0];
      if (urlRole && !KNOWN_ROLES.includes(urlRole) && segments[1]) {
        urlRole = segments[1];
      }
      if (!urlRole || switchingRoleRef.current === urlRole) return;
      switchingRoleRef.current = urlRole;

      void switchRole('auth/switch-role', {
        method: 'POST',
        body: { role: urlRole },
        dedupe: true,
        isAlert: false,
      }).then((response) => {
        const data = response?.results?.data as
          | (Pick<ILoginResponse, 'accessToken' | 'refreshToken'> & {
              role: IActiveRole;
              activeRole: TSystemRole;
            })
          | undefined;
        if (data?.accessToken && data.refreshToken && data.role && data.activeRole) {
          setAuth(
            { ...user, role: data.activeRole },
            data.accessToken,
            data.refreshToken,
            data.activeRole,
            data.role,
          );
          switchingRoleRef.current = null;
          return;
        }
        switchingRoleRef.current = null;
        router.replace(getTenantRolePath(role, '/dashboard'));
      });
    }, [
      guardState,
      hydrated,
      pathname,
      role,
      roleTransitionTarget,
      router,
      setAuth,
      switchRole,
      user,
    ]);

    // ── 3. Side-effects ────────────────────────────────────────────────────
    useEffect(() => {
      if (!hydrated) return;
      const currentToken = useAuthStore.getState().accessToken;
      const storedRefresh = getFromLocalStorage('refreshToken');

      if ((!currentToken || isJwtExpired(currentToken)) && storedRefresh) {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        refreshSession(currentToken)
          .then((fresh) => {
            if (!fresh) markExpired();
          })
          .catch(() => markExpired())
          .finally(() => {
            isRefreshingRef.current = false;
          });
      } else if (currentToken && isJwtExpired(currentToken) && !storedRefresh) {
        markExpired();
      }
    }, [hydrated, accessToken, markExpired]);

    useEffect(() => {
      if (guardState === 'unauthenticated') {
        toast.info('Please sign in to continue.', { toastId: 'auth-required' });
        disconnectSocket();
        router.replace('/auth/signin');
      }
    }, [guardState, router]);

    useEffect(() => {
      if (guardState === 'invalid-session') {
        toast.error('Invalid session. Please sign in again.', { toastId: 'invalid-role' });
        disconnectSocket();
        clearAuth();
        router.replace('/auth/signin');
      }
    }, [guardState, clearAuth, router]);

    useEffect(() => {
      if (guardState === 'wrong-portal' && role) {
        toast.warning(
          `You are logged in as ${ROLE_LABELS[role] ?? role}. Redirecting to your portal.`,
          { toastId: 'role-mismatch', autoClose: 3500 },
        );
        router.replace(getTenantRolePath(role, '/dashboard'));
      }
    }, [guardState, role, router]);

    useEffect(() => {
      if (guardState === 'onboarding-required' && role) {
        router.replace(getTenantRolePath(role, '/onboarding'));
      }
    }, [guardState, role, router]);

    useEffect(() => {
      if (guardState === 'forbidden') {
        toast.error('You do not have permission to access this page.', { toastId: 'forbidden' });
      }
    }, [guardState]);

    useEffect(() => {
      if (guardState === 'pending-applicant') {
        toast.info('Please complete your application to continue.', {
          toastId: 'pending-applicant',
        });
        router.replace('/admission-portal');
      }
    }, [guardState, router]);

    // ── 4. Real-time token expiry polling and proactive refresh ───────────
    useEffect(() => {
      if (!hydrated) return;

      const checkAndRefresh = async () => {
        const currentToken = useAuthStore.getState().accessToken;
        const currentRefresh = getFromLocalStorage('refreshToken');

        if (!currentToken || isJwtExpired(currentToken)) {
          if (currentRefresh) {
            if (isRefreshingRef.current) return;
            isRefreshingRef.current = true;
            try {
              const fresh = await refreshSession(currentToken);
              if (!fresh) markExpired();
            } catch {
              markExpired();
            } finally {
              isRefreshingRef.current = false;
            }
          } else if (currentToken) {
            markExpired();
          }
        }
      };

      const interval = setInterval(checkAndRefresh, 60_000);
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') void checkAndRefresh();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }, [hydrated, markExpired]);

    // ── 5. Session expired overlay ────────────────────────────────────────
    if (sessionExpired) {
      return (
        <>
          <AuthSkeleton />
          <AnimatePresence>
            <SessionExpiredModal
              key="session-expired"
              onSignIn={() => {
                clearExpired();
                router.replace('/auth/signin');
              }}
            />
          </AnimatePresence>
        </>
      );
    }

    // ── 6. Render based on guard state ───────────────────────────────────
    if (guardState === 'loading') return <AuthSkeleton />;
    if (guardState === 'unauthenticated') return <AuthSkeleton />;
    if (guardState === 'invalid-session') return <AuthSkeleton />;
    if (guardState === 'wrong-portal') return <RoleMismatchScreen />;
    if (guardState === 'switching-role') return <RoleMismatchScreen />;
    if (guardState === 'onboarding-required') return <AuthSkeleton />;
    if (guardState === 'access-error')
      return (
        <AccessPolicyError
          message={
            navError instanceof Error
              ? navError.message
              : 'Your role and subscription policy could not be loaded. Please try again.'
          }
          onRetry={() => void refreshNav()}
        />
      );
    if (guardState === 'pending-applicant') return <AuthSkeleton />;
    if (guardState === 'forbidden')
      return <UnauthorizedView role={role!} allowedRoles={allowedRoles} />;

    return <PassedComponent {...props} />;
  }

  const displayName = PassedComponent.displayName || PassedComponent.name || 'Component';
  ProtectedRouteComponent.displayName = `Protected(${displayName})`;

  return ProtectedRouteComponent;
};

export default UseProtectedRoutes;
