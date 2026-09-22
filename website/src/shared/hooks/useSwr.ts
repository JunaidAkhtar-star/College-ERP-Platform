import useSWR, { type SWRConfiguration } from 'swr';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080/api/v1'
).replace(/\/$/, '');

interface IApiErrorPayload {
  message?: string;
  error?: string | { message?: string };
}

const readResponse = async <TData>(response: Response): Promise<TData> => {
  const payload = (await response.json().catch(() => undefined)) as TData | undefined;
  if (!response.ok) {
    const errorPayload = payload as IApiErrorPayload | undefined;
    const message =
      errorPayload?.message ||
      (typeof errorPayload?.error === 'string'
        ? errorPayload.error
        : errorPayload?.error?.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as TData;
};

const useSwr = <TData>(path: string | null, options?: SWRConfiguration<TData>) => {
  const endpoint = path ? `${API_BASE_URL}/${path.replace(/^\//, '')}` : null;
  const { data, error, mutate, isValidating, isLoading } = useSWR<TData>(
    endpoint,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      });
      return readResponse<TData>(response);
    },
    { revalidateOnFocus: false, ...options },
  );

  return {
    data,
    error,
    isValidating,
    isLoading,
    mutate,
    pagination: (data as { pagination?: unknown } | undefined)?.pagination,
  };
};

export default useSwr;
