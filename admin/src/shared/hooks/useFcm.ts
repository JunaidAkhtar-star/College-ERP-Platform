/**
 * @file useFcm.ts
 * @description Browser FCM (push) integration hook for Admin Panel.
 * Responsibilities:
 *  - Register the firebase-messaging service worker (if Firebase is configured).
 *  - Request Notification permission if it is still "default".
 *  - Acquire the FCM registration token and POST it to super-admin/fcm-token.
 *  - Listen for foreground push messages and forward them to a caller-supplied handler.
 *
 * @module shared/hooks
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { onMessage, getToken, MessagePayload } from 'firebase/messaging';
import { getMessagingClient, type IFirebaseConfig } from '@/shared/utils/firebase';
import useMutation from './useMutation';
import useSwr from './useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { getFromLocalStorage, saveToLocalStorage } from '@/shared/utils';

let _registeredToken: string | null = null;
const ADMIN_PUSH_DEVICE_ID_KEY = 'devvelocity.admin-push-device-id';

export function getAdminPushDeviceId(): string {
  const current = getFromLocalStorage(ADMIN_PUSH_DEVICE_ID_KEY);
  if (current) return current;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `admin-web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  saveToLocalStorage(ADMIN_PUSH_DEVICE_ID_KEY, generated);
  return generated;
}

interface IUseFcmOptions {
  /** Called whenever a push arrives while the page is in the foreground. */
  onForegroundMessage?: (payload: MessagePayload) => void;
}

export function useFcm(options: IUseFcmOptions = {}): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { mutation } = useMutation();
  const { data: firebaseResponse } = useSwr<{
    success: boolean;
    data: IFirebaseConfig & { vapidKey: string };
  }>(accessToken ? 'super-admin/integrations/firebase/client-config' : null);
  const firebaseConfig = firebaseResponse?.data;
  const [registrationAttempt, setRegistrationAttempt] = useState(0);
  const onForegroundRef = useRef(options.onForegroundMessage);
  useEffect(() => {
    onForegroundRef.current = options.onForegroundMessage;
  }, [options.onForegroundMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!accessToken) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      if (!firebaseConfig) return;
      const { vapidKey, ...clientConfig } = firebaseConfig;
      const messaging = await getMessagingClient(clientConfig);
      if (!messaging || cancelled) return;

      // Permission flow — prompt if still at default
      let permission = Notification.permission;
      if (permission === 'default' && registrationAttempt === 0) {
        try {
          permission = await Notification.requestPermission();
        } catch {
          return;
        }
      }
      if (permission !== 'granted') return;

      // Register service worker and wait until active
      let registration: ServiceWorkerRegistration | undefined;
      try {
        const query = new URLSearchParams(Object.entries(clientConfig)).toString();
        await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
        registration = await navigator.serviceWorker.ready;
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Admin FCM] Service worker registration failed:', err);
        }
        return;
      }

      // Get token & register to backend
      let token: string | null = null;
      try {
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Admin FCM] getToken failed:', err);
        }
        return;
      }
      if (!token || cancelled) return;

      if (_registeredToken !== token) {
        try {
          const tokenResponse = await mutation('super-admin/fcm-token', {
            method: 'POST',
            body: { token, platform: 'web', deviceId: getAdminPushDeviceId() },
          });
          if (!tokenResponse?.results?.success) return;
          const preferenceResponse = await mutation('notification/preferences', {
            method: 'PUT',
            body: { push: true, inApp: true },
          });
          if (!preferenceResponse?.results?.success) return;
          _registeredToken = token;
        } catch {
          // best-effort
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
  }, [accessToken, firebaseConfig, mutation, registrationAttempt]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const enableWebPush = () => {
      if (Notification.permission !== 'default') {
        setRegistrationAttempt((attempt) => attempt + 1);
        return;
      }
      void Notification.requestPermission().then((permission) => {
        if (permission === 'granted') setRegistrationAttempt((attempt) => attempt + 1);
      });
    };
    window.addEventListener('admin:enable-web-push', enableWebPush);
    return () => window.removeEventListener('admin:enable-web-push', enableWebPush);
  }, []);
}
