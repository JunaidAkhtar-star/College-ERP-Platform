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

import { BASE_URL, getFromLocalStorage, saveToLocalStorage } from './index';
import { useAuthStore } from '../store/authStore';

let pendingRefresh: Promise<string | null> | null = null;

async function doRefresh(originalToken?: string | null): Promise<string | null> {
  const currentToken = getFromLocalStorage('accessToken');
  if (currentToken && originalToken && currentToken !== originalToken) {
    return currentToken;
  }

  const refreshToken = getFromLocalStorage('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Context': 'true',
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { accessToken?: string; refreshToken?: string };
    };
    const next = json?.data;
    if (!next?.accessToken || !next?.refreshToken) return null;

    saveToLocalStorage('accessToken', next.accessToken);
    saveToLocalStorage('refreshToken', next.refreshToken);
    useAuthStore.getState().setAccessToken(next.accessToken);
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
