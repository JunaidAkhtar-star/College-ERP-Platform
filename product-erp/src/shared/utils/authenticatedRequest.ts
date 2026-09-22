import { BASE_URL, getFromLocalStorage, getTenantId } from './index';
import { refreshSession } from './refreshSession';
import { useAuthStore } from '../store/authStore';

export async function authenticatedRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const originalToken = getFromLocalStorage('accessToken');
  const tenantId = getTenantId();
  const request = (token?: string | null) =>
    fetch(`${BASE_URL}/${path.replace(/^\//, '')}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      },
    });

  let response = await request(originalToken);
  if (response.status === 401 && originalToken) {
    const refreshed = await refreshSession(originalToken);
    if (refreshed) response = await request(refreshed);
  }
  if (response.status === 401 && originalToken) useAuthStore.getState().markSessionExpired();
  return response;
}
