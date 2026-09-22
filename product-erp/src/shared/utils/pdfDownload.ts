/**
 * @file pdfDownload.ts
 * @description Helpers for fetching binary PDF responses from the backend
 *   and triggering a browser download. Backend PDF routes stream
 *   `application/pdf` and require a Bearer token, so `<a href>` links won't
 *   work — use these helpers instead of `useMutation` (which parses JSON).
 */

import { BASE_URL, getFromLocalStorage, getTenantId } from './index';
import { refreshSession } from './refreshSession';
import { useAuthStore } from '../store/authStore';

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchProtectedBlob(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<Blob | null> {
  const token = getFromLocalStorage('accessToken');
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  const tenantId = getTenantId();
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const request = (accessToken: string | null) =>
    fetch(`${BASE_URL}/${path}`, {
      method,
      headers: {
        ...headers,
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  let res = await request(token);
  if (res.status === 401 && token) {
    const freshToken = await refreshSession(token);
    if (freshToken) res = await request(freshToken);
  }
  if (res.status === 401 && token) {
    useAuthStore.getState().markSessionExpired();
    return null;
  }
  if (!res.ok) return null;
  return res.blob();
}

export const fetchPdf = fetchProtectedBlob;

/** Fetch a public storage object without leaking tenant credentials to its host. */
export async function fetchExternalBlob(url: string, signal?: AbortSignal): Promise<Blob | null> {
  const response = await fetch(url, { signal, mode: 'cors' });
  if (!response.ok) return null;
  const blob = await response.blob();
  return blob.size ? blob : null;
}

export async function downloadPdf(
  path: string,
  filename: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<boolean> {
  const blob = await fetchPdf(path, init);
  if (!blob) return false;
  downloadPdfBlob(blob, filename);
  return true;
}
