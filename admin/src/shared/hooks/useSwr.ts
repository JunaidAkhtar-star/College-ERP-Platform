import useSWR, { SWRConfiguration } from 'swr';
import { BASE_URL, getFromLocalStorage } from '../utils';
import { refreshSession } from '../utils/refreshSession';
import { useAuthStore } from '../store/authStore';

interface SwrCustomOptions extends SWRConfiguration {
  version?: string;
  chatUrl?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useSwr = <TData = any>(path: string | null, options?: SwrCustomOptions) => {
  const fetcher = async (url: string): Promise<{ data: TData | undefined; res: Response }> => {
    const buildHeaders = (token?: string | null) => {
      const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Range: '1',
        'Content-Length': '1',
        'ngrok-skip-browser-warning': '69420',
      };
      if (token) {
        h['Authorization'] = `Bearer ${token}`;
      }
      h['X-Platform-Context'] = 'true';
      return h;
    };

    const accessToken = getFromLocalStorage('accessToken') || undefined;
    let res = await fetch(url, { method: 'GET', headers: buildHeaders(accessToken) });

    // Transparent refresh-and-retry on 401 (access token expired)
    if (res.status === 401) {
      const fresh = await refreshSession(accessToken);
      if (fresh) {
        res = await fetch(url, { method: 'GET', headers: buildHeaders(fresh) });
      }
      if (res.status === 401) {
        useAuthStore.getState().markSessionExpired();
        return { data: undefined, res };
      }
    }

    let data: TData | undefined;
    try {
      data = (await res.json()) as TData;
    } catch {
      data = undefined;
    }
    if (!res.ok) {
      const payload = data as
        | { message?: string; error?: string | { message?: string } }
        | undefined;
      const message =
        payload?.message ||
        (typeof payload?.error === 'string' ? payload.error : payload?.error?.message) ||
        `Request failed with status ${res.status}`;
      throw new Error(message);
    }
    return { data, res };
  };

  const { data, error, mutate, isValidating, isLoading } = useSWR(
    path ? [`${BASE_URL}/${path}`] : null,
    fetcher,
    {
      ...options,
      revalidateOnFocus: false,
    },
  );

  return {
    data: data?.data,
    error,
    isValidating,
    isLoading,
    mutate,
    pagination: (data?.data as { pagination?: unknown } | undefined)?.pagination,
  };
};

export default useSwr;
