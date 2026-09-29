// Minimal service worker: it exists so the app is installable and so system notifications work on Android
// (`new Notification()` throws there; only `registration.showNotification()` is allowed).
// It deliberately caches nothing — the map and every list are live data, and the server already sets
// long-lived caching on the hashed build files.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Tapping a notification brings the open app to the front, or opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/home', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      if (open) return open.focus();
      return self.clients.openWindow(target);
    }),
  );
});
