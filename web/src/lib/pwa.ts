import i18n from '@/i18n';

/** Registers `/sw.js` (production builds only: in `vite dev` a worker would serve stale modules). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker → notifications fall back to `new Notification()`; nothing else depends on it.
    });
  });
}

/**
 * A system notification. Goes through the service worker when there is one (the only way on Android),
 * else the plain constructor; does nothing without permission or when the browser refuses.
 */
export async function showSystemNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, icon: '/icons/icon-192.png', lang: i18n.language, data: { url: '/home' } };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Some browsers only allow one of the two ways; a missed system notification is not worth an error.
  }
}
