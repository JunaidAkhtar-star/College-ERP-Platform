/**
 * @file firebase.ts
 * @description Firebase Web SDK initialisation for FCM browser push.
 * Config is supplied dynamically by the authenticated tenant integration API.
 *
 * @module shared/utils/firebase
 */
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

export interface IFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

function getFirebaseApp(config: IFirebaseConfig): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (_app) return _app;
  _app = getApps().length ? getApps()[0]! : initializeApp(config);
  return _app;
}

/**
 * Returns a Messaging instance, or null if Firebase is unconfigured, the
 * browser does not support FCM, or this is running on the server.
 */
export async function getMessagingClient(config: IFirebaseConfig): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (_messaging) return _messaging;
  const app = getFirebaseApp(config);
  if (!app) return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}
