import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_URL, getLocalStorageItem, getFromLocalStorage, getTenantId } from '../utils';
import { refreshSession } from '../utils/refreshSession';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
interface IPInfo {
  ip: string;
}

type MutationOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  isFormData?: boolean;
  baseUrl?: string;
  body?: unknown;
  isAlert?: boolean;
  onProgress?: (progress: number) => void;
  type?: string; // Optional type key
  version?: string;
  dedupe?: boolean;
  platformContext?: boolean;
  silentError?: boolean;
  returnError?: boolean;
};

type ValidationDetail = { field?: string; message?: string };

const readableErrorDetails = (details: unknown): string | undefined => {
  if (typeof details === 'string') return details;
  if (!Array.isArray(details)) return undefined;

  const messages = details
    .map((detail) => {
      if (!detail || typeof detail !== 'object') return null;
      const { field, message } = detail as ValidationDetail;
      if (!message) return null;
      return field ? `${field}: ${message}` : message;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length ? messages.join(' · ') : undefined;
};

const useMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  // Use a ref for ipAddress to avoid re-creating the callback when it changes
  const ipAddressRef = useRef<IPInfo | null>(getLocalStorageItem('IPINFO') as IPInfo | null);

  // Update the ref if ipAddress changes
  useEffect(() => {
    ipAddressRef.current = getLocalStorageItem('IPINFO') as IPInfo | null;
  }, []);

  // Track ongoing requests to prevent duplicate calls
  const pendingRequestsRef = useRef<Map<string, boolean>>(new Map());

  const mutation = useCallback(
    async (path: string, options?: MutationOptions) => {
      const shouldDedupe = options?.dedupe !== false;
      // Create a unique key for this request to track duplicates
      const requestKey = `${path}-${JSON.stringify(options?.body)}`;

      // Skip if this exact request is already in progress
      if (shouldDedupe && pendingRequestsRef.current.get(requestKey)) {
        return undefined;
      }

      // Mark this request as pending
      if (shouldDedupe) {
        pendingRequestsRef.current.set(requestKey, true);
      }
      setIsLoading(true);

      try {
        // Access token is stored as plain string, not JSON
        const accessToken = getFromLocalStorage('accessToken');

        const method = options?.method || 'POST';
        const body =
          method === 'GET'
            ? undefined
            : options?.isFormData
              ? options.body
              : JSON.stringify(options?.body);
        const headers: Record<string, string> = options?.isFormData
          ? {}
          : { 'Content-Type': 'application/json' };

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        if (options?.type) {
          headers['Type'] = options.type;
        }
        const tenantId = getTenantId();
        if (tenantId) {
          headers['X-Tenant-ID'] = tenantId;
        }
        if (options?.platformContext) {
          headers['X-Platform-Context'] = 'true';
        }
        // Always use the current ref value
        headers['ipv4'] = ipAddressRef.current?.ip || '0.0.0.0';

        const url = `${BASE_URL}/${path}`;

        let response = await fetch(url, {
          method,
          headers,
          body: body as BodyInit,
        });

        // Transparent refresh-and-retry on 401 (access token expired).
        // Only attempt when the request was authenticated to begin with —
        // otherwise endpoints like auth/login that legitimately return 401
        // for wrong credentials would be swallowed as "session expired".
        if (response.status === 401 && accessToken) {
          const fresh = await refreshSession(accessToken);
          if (fresh) {
            headers['Authorization'] = `Bearer ${fresh}`;
            response = await fetch(url, {
              method,
              headers,
              body: body as BodyInit,
            });
          }
        }

        const status = response.status;
        const results = status !== 204 ? await response.json() : undefined;

        if (!response.ok) {
          if (status === 401 && accessToken) {
            useAuthStore.getState().markSessionExpired();
            return undefined;
          }

          const errorData = results?.error;
          const detailedMessage = readableErrorDetails(errorData?.details);
          let errorMessage = 'Something went wrong !!';

          if (options?.version === 'v2' && errorData) {
            errorMessage =
              detailedMessage ||
              errorData?.title ||
              errorData?.message ||
              'Something went wrong !!';
          } else {
            errorMessage =
              results?.message ||
              (typeof errorData === 'string'
                ? errorData
                : errorData?.title || detailedMessage || errorData?.message) ||
              'Something went wrong !!';
          }

          if (!options?.silentError) toast.error(errorMessage);
          if (options?.returnError) return { results, status };
          return undefined;
        }

        if (options?.isAlert) {
          if (results?.success) {
            toast.success(results?.message);
          } else {
            toast.error(results?.error?.message);
          }
        }

        return { results, status };
      } catch (error) {
        console.error('Mutation error:', error);
        console.error('Request details:', {
          url: `${BASE_URL}/${path}`,
          method: options?.method || 'POST',
          hasBody: !!options?.body,
        });

        // More descriptive error messages
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          if (!options?.silentError)
            toast.error('Cannot connect to server. Please check if backend is running.');
        } else if (error instanceof Error) {
          if (!options?.silentError) toast.error(`Network error: ${error.message}`);
        } else {
          if (!options?.silentError) toast.error('Something went wrong');
        }
        return undefined;
      } finally {
        // Clear this request from pending
        if (shouldDedupe) {
          pendingRequestsRef.current.delete(requestKey);
        }
        setIsLoading(false);
      }
    },
    [], // No dependencies needed
  );

  return { mutation, isLoading };
};

export default useMutation;
