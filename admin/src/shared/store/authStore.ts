/**
 * @file authStore.ts
 * @description Zustand auth store for the multi-tenant ERP application.
 *
 *  Responsibilities:
 *  - Hold authenticated user, access token, and active role in memory.
 *  - Persist tokens + user to localStorage on login.
 *  - Hydrate state from localStorage on app boot (so page refresh keeps session).
 *  - Clear all auth state + localStorage on logout.
 *  - Expose a simple token-expiry check so protected routes can react immediately.
 *
 * @module shared/store
 */

import { create } from 'zustand';
import { IActiveRole, IAuthUser, TSystemRole } from '@/shared/types';

import {
  getFromLocalStorage,
  getLocalStorageItem,
  saveToLocalStorage,
  setLocalStorageItem,
  removeFromLocalStorage,
} from '@/shared/utils';

// ─── localStorage keys ────────────────────────────────────────────────────────
const KEY_ACCESS_TOKEN = 'accessToken';
const KEY_REFRESH_TOKEN = 'refreshToken';
const KEY_USER = 'erp_user';
const KEY_ROLE = 'activeRole';
const KEY_ROLE_DOC = 'activeRoleDoc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a JWT and check whether the `exp` claim has passed.
 * Returns `true` (expired) on any parse error — treat malformed tokens as invalid.
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 < Date.now() : true;
  } catch {
    return true;
  }
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface IAuthState {
  /** Full user object returned from login. Null when not authenticated. */
  user: IAuthUser | null;
  /** Raw JWT access token. Null when not authenticated. */
  accessToken: string | null;
  /** Raw JWT refresh token. Null when not authenticated. */
  refreshToken: string | null;
  /** The role the user is currently operating under (selected at login). */
  role: TSystemRole | null;
  /**
   * Active role doc (permissions + allowedNavItems). Null until backend Role
   * docs are seeded — in which case the legacy hardcoded role guards apply.
   */
  activeRole: IActiveRole | null;
  /**
   * Whether the store has been hydrated from localStorage.
   * `false` on the very first render — protected routes should show a skeleton
   * until this becomes `true`.
   */
  hydrated: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Called after a successful login API response.
   * Saves all auth data to state AND to localStorage.
   */
  setAuth: (
    user: IAuthUser,
    accessToken: string,
    refreshToken: string,
    role: TSystemRole,
    activeRole?: IActiveRole | null,
  ) => void;

  /**
   * Called on logout or token expiry.
   * Clears all auth data from state AND from localStorage.
   */
  clearAuth: () => void;

  /**
   * Called once on app boot (inside UseProtectedRoutes).
   * Reads localStorage, validates the access token, and populates the store.
   * Sets `hydrated = true` when done regardless of outcome.
   */
  hydrate: () => void;

  /**
   * Update the access token only (used after a token refresh).
   */
  setAccessToken: (token: string) => void;

  /**
   * Switch the active portal role without re-login. Only succeeds when the
   * target role is one of `user.roles`. Used by the topbar role switcher and
   * by URL synchronisation (cross-portal link clicks).
   */
  setActiveRole: (role: TSystemRole) => void;

  /**
   * Whether the session ended unexpectedly (token expired mid-session or 401 from API).
   * UseProtectedRoutes listens to this and shows a session-expired overlay.
   */
  sessionExpired: boolean;

  /**
   * Marks the session as expired — called from useSwr/useMutation on 401 responses.
   * Also clears stored auth so the next hydrate() finds nothing.
   */
  markSessionExpired: () => void;

  /**
   * Clears the sessionExpired flag (called after user acknowledges and signs in again).
   */
  clearSessionExpired: () => void;

  // ── Permission helpers ─────────────────────────────────────────────────────

  /**
   * Returns true if the active role grants the given module:action.
   * Returns `true` if no role doc is loaded yet (legacy fallback — page-level
   * role guard still applies). Pages that want strict denial can also call
   * `hasLoadedPermissions()` first.
   */
  hasPermission: (module: string, action: string) => boolean;

  /** Returns true if the backend has provided a role doc with permissions. */
  hasLoadedPermissions: () => boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<IAuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  role: null,
  activeRole: null,
  hydrated: false,
  sessionExpired: false,

  setAuth(user, accessToken, refreshToken, role, activeRole = null) {
    // Persist to localStorage
    saveToLocalStorage(KEY_ACCESS_TOKEN, accessToken);
    saveToLocalStorage(KEY_REFRESH_TOKEN, refreshToken);
    setLocalStorageItem(KEY_USER, user);
    saveToLocalStorage(KEY_ROLE, role);
    if (activeRole) setLocalStorageItem(KEY_ROLE_DOC, activeRole);
    else removeFromLocalStorage(KEY_ROLE_DOC);

    set({
      user,
      accessToken,
      refreshToken,
      role,
      activeRole,
      hydrated: true,
      sessionExpired: false,
    });
  },

  clearAuth() {
    removeFromLocalStorage(KEY_ACCESS_TOKEN);
    removeFromLocalStorage(KEY_REFRESH_TOKEN);
    removeFromLocalStorage(KEY_USER);
    removeFromLocalStorage(KEY_ROLE);
    removeFromLocalStorage(KEY_ROLE_DOC);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      activeRole: null,
      hydrated: true,
      sessionExpired: false,
    });
  },

  hydrate() {
    const accessToken = getFromLocalStorage(KEY_ACCESS_TOKEN);
    const refreshToken = getFromLocalStorage(KEY_REFRESH_TOKEN);
    const user = getLocalStorageItem(KEY_USER) as IAuthUser | null;
    const role = getFromLocalStorage(KEY_ROLE) as TSystemRole | null;
    const activeRole = getLocalStorageItem(KEY_ROLE_DOC) as IActiveRole | null;

    // Access token still valid → hydrate immediately.
    if (accessToken && !isTokenExpired(accessToken)) {
      set({ user, accessToken, refreshToken, role, activeRole, hydrated: true });
      return;
    }

    // Access token missing/expired but refresh token present → try to refresh
    // silently so the user stays logged in across browser restarts. Keep
    // hydrated:false while the refresh is in flight so route guards show a
    // loading state instead of bouncing to /login.
    if (refreshToken) {
      // Lazy import to avoid a circular dependency between store ↔ refreshSession.
      import('@/shared/utils/refreshSession')
        .then(({ refreshSession }) => refreshSession())
        .then((newAccessToken) => {
          if (newAccessToken) {
            set({
              user,
              accessToken: newAccessToken,
              refreshToken: getFromLocalStorage(KEY_REFRESH_TOKEN),
              role,
              activeRole,
              hydrated: true,
            });
          } else {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              role: null,
              activeRole: null,
              hydrated: true,
            });
          }
        })
        .catch(() => {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            role: null,
            activeRole: null,
            hydrated: true,
          });
        });
      return;
    }

    // No tokens at all → unauthenticated.
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      activeRole: null,
      hydrated: true,
    });
  },

  setAccessToken(token) {
    saveToLocalStorage(KEY_ACCESS_TOKEN, token);
    set({ accessToken: token });
  },

  setActiveRole(role) {
    const { user } = get();
    if (!user?.roles?.includes(role)) return;
    saveToLocalStorage(KEY_ROLE, role);
    set({ role });
  },

  markSessionExpired() {
    // Clear stored tokens so next boot treats user as logged out
    removeFromLocalStorage(KEY_ACCESS_TOKEN);
    removeFromLocalStorage(KEY_REFRESH_TOKEN);
    removeFromLocalStorage(KEY_USER);
    removeFromLocalStorage(KEY_ROLE);
    removeFromLocalStorage(KEY_ROLE_DOC);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      activeRole: null,
      hydrated: true,
      sessionExpired: true,
    });
  },

  clearSessionExpired() {
    set({ sessionExpired: false });
  },

  hasPermission(module: string, action: string) {
    const ar = get().activeRole;
    if (!ar) return true; // legacy fallback — role-name guard still gates
    const perms = ar.permissions ?? [];
    return perms.some((p) => p.module === module && p.actions.includes(action));
  },

  hasLoadedPermissions() {
    const ar = get().activeRole;
    return !!ar && Array.isArray(ar.permissions) && ar.permissions.length > 0;
  },
}));
