/* global self, importScripts, firebase */
/**
 * Firebase Messaging Service Worker
 * --------------------------------------------------------------------------
 * Receives background pushes when the admin console tab is closed / unfocused.
 * Dynamic icon fallback: uses payload's icon / tenant logo / user avatar if provided.
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Notification payloads are displayed automatically by Firebase. Showing
    // them again here would create a duplicate browser notification.
    if (payload.notification) return;
    const title =
      (payload.notification && payload.notification.title) ||
      (payload.data && payload.data.title) ||
      'Notification';
    const body =
      (payload.notification && payload.notification.body) ||
      (payload.data && payload.data.body) ||
      '';
    const icon =
      (payload.data && (payload.data.icon || payload.data.tenantLogo || payload.data.avatar)) ||
      (payload.notification && (payload.notification.icon || payload.notification.imageUrl)) ||
      '/devvelocitylogo.webp';

    const options = {
      body,
      icon,
      data: payload.data || {},
    };
    self.registration.showNotification(title, options);
  });
}

// Focus or open the app when a push notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url =
    (event.notification.data &&
      (event.notification.data.actionUrl || event.notification.data.url)) ||
    '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
