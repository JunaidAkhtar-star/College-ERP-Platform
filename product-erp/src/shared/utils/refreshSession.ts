/**
 * @file refreshSession.ts
 * @description Singleton refresh-token helper. Calls `POST /auth/refresh-token`
 *   with the stored refresh token and atomically updates the auth store +
 *   localStorage with the new access/refresh pair.
 *
 *   Multiple 401s in flight all await the SAME pending refresh promise so we
 *   only hit the refresh endpoint once per token expiry.
 *
 *   Returns the new access token on success, or `null` if refresh failed (in
 *   which case the caller should let the session terminate).
 */

import { BASE_URL, getFromLocalStorage, getTenantId } from './index';
import { useAuthStore } from '../store/authStore';
import type { IActiveRole } from '@/shared/types';

let pendingRefresh: Promise<string | null> | null = null;

function isUsableAccessToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5_000;
  } catch {
    return false;
  }
}

const retryDelay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

async function doRefresh(originalToken?: string | null): Promise<string | null> {
  const currentToken = getFromLocalStorage('accessToken');
  if (currentToken && isUsableAccessToken(currentToken)) return currentToken;
  if (currentToken && originalToken && currentToken !== originalToken) {
    return currentToken;
  }

  const refreshToken = getFromLocalStorage('refreshToken');
  if (!refreshToken) return null;

  try {
    const tenantId = getTenantId();
    const request = () =>
      fetch(`${BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
          ...(!tenantId ? { 'X-Platform-Context': 'true' } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    let res = await request();
    if (res.status === 429 || res.status >= 500) {
      await retryDelay(500);
      const tokenFromAnotherRequest = getFromLocalStorage('accessToken');
      if (tokenFromAnotherRequest && isUsableAccessToken(tokenFromAnotherRequest)) {
        return tokenFromAnotherRequest;
      }
      res = await request();
    }
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { accessToken?: string; refreshToken?: string; role?: IActiveRole | null };
    };
    const next = json?.data;
    if (!next?.accessToken || !next?.refreshToken) return null;

    useAuthStore
      .getState()
      .setRefreshedSession(next.accessToken, next.refreshToken, next.role ?? undefined);
    return next.accessToken;
  } catch {
    return null;
  }
}

/**
 * Refresh the access token. Concurrent callers share a single in-flight refresh.
 */
export function refreshSession(originalToken?: string | null): Promise<string | null> {
  if (!pendingRefresh) {
    pendingRefresh = doRefresh(originalToken).finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}
