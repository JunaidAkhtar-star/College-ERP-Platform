import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080/api/v1'
).replace(/\/$/, '');

type THttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface IMutationOptions {
  method?: THttpMethod;
  isFormData?: boolean;
  baseUrl?: string;
  body?: unknown;
  isAlert?: boolean;
  dedupe?: boolean;
  suppressErrorToast?: boolean;
  onError?: (message: string) => void;
}

interface IErrorPayload {
  message?: string;
  error?: string | { message?: string; details?: string; title?: string };
  success?: boolean;
  data?: object;
}

const useMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const pendingRequests = useRef(new Set<string>());

  const mutation = useCallback(async (path: string, options: IMutationOptions = {}) => {
    const method = options.method || 'POST';
    const requestKey = `${method}:${path}:${JSON.stringify(options.body)}`;
    if (options.dedupe !== false && pendingRequests.current.has(requestKey)) return undefined;

    pendingRequests.current.add(requestKey);
    setIsLoading(true);

    try {
      const baseUrl = (options.baseUrl || API_BASE_URL).replace(/\/$/, '');
      const headers: HeadersInit = options.isFormData
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' };
      const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
        method,
        headers,
        credentials: 'omit',
        body:
          method === 'GET'
            ? undefined
            : options.isFormData
              ? (options.body as BodyInit)
              : JSON.stringify(options.body),
      });
      const results = (
        response.status === 204 ? undefined : await response.json().catch(() => undefined)
      ) as IErrorPayload | undefined;

      if (!response.ok) {
        const message =
          results?.message ||
          (typeof results?.error === 'string'
            ? results.error
            : results?.error?.details || results?.error?.message || results?.error?.title) ||
          'The request could not be completed.';
        options.onError?.(message);
        if (!options.suppressErrorToast) toast.error(message);
        return undefined;
      }

      if (options.isAlert && results?.message) toast.success(results.message);
      return { results, status: response.status };
    } catch (error) {
      const message =
        error instanceof TypeError
          ? 'Cannot connect to the server. Please try again shortly.'
          : 'Something went wrong while sending your request.';
      options.onError?.(message);
      if (!options.suppressErrorToast) toast.error(message);
      return undefined;
    } finally {
      pendingRequests.current.delete(requestKey);
      setIsLoading(false);
    }
  }, []);

  return { mutation, isLoading };
};

export default useMutation;
