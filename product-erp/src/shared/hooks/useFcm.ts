/**
 * @file useFcm.ts
 * @description Browser FCM (push) integration hook.
 * Responsibilities:
 *  - Register the firebase-messaging service worker (if Firebase is configured).
 *  - Request Notification permission if it is still "default".
 *  - Acquire the FCM registration token and POST it to the backend so the
 *    server can target this device with admin.messaging().send(...).
 *  - Listen for foreground push messages and forward them to a caller-supplied
 *    handler (typically: show a toast + revalidate the notification SWR).
 *
 * Silently no-ops when:
 *  - Running on the server (SSR).
 *  - Firebase Web config env vars are missing.
 *  - The browser does not support FCM (e.g. Safari < 16, in-app webviews).
 *  - The user has explicitly denied notifications.
 *
 * Call once at the app shell level (Header) — the singleton-style guards
 * prevent duplicate token registrations on React StrictMode re-mounts.
 *
 * @module shared/hooks
 */
'use client';

import { useEffect, useRef } from 'react';
import { deleteToken, onMessage, getToken, MessagePayload } from 'firebase/messaging';
import { getMessagingClient, type IFirebaseConfig } from '@/shared/utils/firebase';
import useMutation from './useMutation';
import useSwr from './useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { getFromLocalStorage, saveToLocalStorage } from '@/shared/utils';

let _registeredToken: string | null = null;
let _pushDisabledCleaned = false;
export const PUSH_MANUAL_OPTOUT_KEY = 'devvelocity.push-manual-opt-out';
const PUSH_DEVICE_ID_KEY = 'devvelocity.push-device-id';

export function getPushDeviceId(): string {
  const current = getFromLocalStorage(PUSH_DEVICE_ID_KEY);
  if (current) return current;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  saveToLocalStorage(PUSH_DEVICE_ID_KEY, generated);
  return generated;
}

interface IUseFcmOptions {
  enabled?: boolean;
  /** Called whenever a push arrives while the page is in the foreground. */
  onForegroundMessage?: (payload: MessagePayload) => void;
}

export function useFcm(options: IUseFcmOptions = {}): void {
  const isEnabled = options.enabled ?? true;
  const accessToken = useAuthStore((s) => s.accessToken);
  const { mutation } = useMutation();
  const { data: preferenceResponse, mutate: refreshPreferences } = useSwr<{
    success: boolean;
    data: { email?: boolean; inApp?: boolean; push?: boolean; sms?: boolean };
  }>(accessToken && isEnabled ? 'notification/preferences' : null);
  const pushEnabled = preferenceResponse?.data?.push === true;
  const { data: firebaseResponse } = useSwr<{
    success: boolean;
    data: IFirebaseConfig & {
      vapidKey: string;
      institutionName?: string;
      institutionLogoUrl?: string;
    };
  }>(accessToken && isEnabled ? 'tenant-integrations/firebase/client-config' : null);
  const firebaseConfig = firebaseResponse?.data;
  const onForegroundRef = useRef(options.onForegroundMessage);
  useEffect(() => {
    onForegroundRef.current = options.onForegroundMessage;
  }, [options.onForegroundMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!accessToken || !isEnabled) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      if (!firebaseConfig) return;
      const { vapidKey, institutionName, institutionLogoUrl, ...clientConfig } = firebaseConfig;
      const messaging = await getMessagingClient(clientConfig);
      if (!messaging || cancelled) return;

      if (!pushEnabled) {
        const manuallyDisabled = getFromLocalStorage(PUSH_MANUAL_OPTOUT_KEY) === 'true';
        if (!manuallyDisabled) {
          let permission = Notification.permission;
          if (permission === 'default') {
            try {
              permission = await Notification.requestPermission();
            } catch {
              permission = 'denied';
            }
          }
          if (permission === 'granted') {
            const response = await mutation('notification/preferences', {
              method: 'PUT',
              body: { ...(preferenceResponse?.data ?? {}), push: true },
            });
            if (response?.results?.success) {
              _pushDisabledCleaned = false;
              await refreshPreferences();
            }
            return;
          }
        }
        if (_pushDisabledCleaned) return;
        try {
          const currentToken = await getToken(messaging, { vapidKey }).catch(() => null);
          await mutation('notification/fcm-token', {
            method: 'DELETE',
            body: {
              platform: 'web',
              deviceId: getPushDeviceId(),
              ...(currentToken ? { token: currentToken } : {}),
            },
          });
          await deleteToken(messaging);
          _registeredToken = null;
          _pushDisabledCleaned = true;
        } catch {
          // Best effort. The backend preference still prevents push delivery.
        }
        return;
      }
      _pushDisabledCleaned = false;

      // Permission prompts must only follow an explicit user gesture in the
      // preferences screen. The app shell never prompts automatically.
      if (Notification.permission !== 'granted') return;

      // Register service worker
      let registration: ServiceWorkerRegistration | undefined;
      try {
        const query = new URLSearchParams({
          ...Object.fromEntries(
            Object.entries(clientConfig).filter((entry): entry is [string, string] =>
              Boolean(entry[1]),
            ),
          ),
          institutionName: institutionName || 'Your institution',
          institutionLogoUrl: institutionLogoUrl || '',
        }).toString();
        await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
        registration = await navigator.serviceWorker.ready;
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[FCM] Service worker registration failed:', err);
        }
        return;
      }

      // Get token & register to backend (only once per page load + token)
      let token: string | null = null;
      try {
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[FCM] getToken failed:', err);
        }
        return;
      }
      if (!token || cancelled) return;

      if (_registeredToken !== token) {
        try {
          const response = await mutation('notification/fcm-token', {
            method: 'POST',
            body: { token, platform: 'web', deviceId: getPushDeviceId() },
          });
          if (!response?.results?.success) return;
          _registeredToken = token;
        } catch {
          // best-effort — push will retry on next mount
        }
      }

      // Foreground listener
      const off = onMessage(messaging, (payload) => {
        onForegroundRef.current?.(payload);
      });
      unsubscribe = off;
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [
    accessToken,
    firebaseConfig,
    isEnabled,
    mutation,
    preferenceResponse?.data,
    pushEnabled,
    refreshPreferences,
  ]);
}
