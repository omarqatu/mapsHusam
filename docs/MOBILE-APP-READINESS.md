# Mobile readiness

**Decision (2026-09-30): no native app (React Native / Android / iOS WebView).** The site is a responsive web app that
can be installed as a PWA. The legacy `mobile-app-bridge.js` (a `postMessage` contract for a native shell) was deleted
with the legacy frontend and is **not** ported: it only did something when a native shell existed to answer it, and
in a browser it did nothing.

## What is in place (`web/`)

- Responsive layouts: the map uses bottom sheets on phones, every other page works from 375 px (see the per-page
  notes in `docs/react-migration/PLAN.md`).
- Installable: `public/manifest.webmanifest` (name, `standalone`, start URL `/home`, RTL, theme colour), icons in
  `public/icons/` (192, 512, maskable, `apple-touch-icon`; source `public/icon.svg`), and the iOS meta tags in `index.html`.
- `public/sw.js`, registered by `src/lib/pwa.ts` in production builds only. It caches **nothing** (the map and lists are
  live data); it exists for installability and for system notifications — Android refuses `new Notification()`, only
  `registration.showNotification()` works, so `showSystemNotification()` goes through the worker and falls back to the
  constructor. Tapping a notification focuses the open app or opens `/home`.
- GPS uses the browser's own permission prompt (`geolocate.ts`, `LocateButton.tsx`) and needs HTTPS. Notification
  permission is asked from the bell menu, not on page load.

## What is not there

- **No background notifications.** Notifications arrive over socket.io, which stops when the phone locks or the tab
  sleeps; a system notification is shown only while the app is open but hidden. Real push (works with the app closed)
  needs Web Push: a server change — see PLAN.md → "Backend asks".
- iOS shows web notifications only for an app added to the Home Screen (iOS 16.4+), never from a Safari tab.

## Release checklist

- `cd web && npm run build`; the server serves `web/dist` (see PLAN.md → "Server changes").
- Test the map and `/search` at phone portrait, phone landscape, tablet portrait and tablet landscape.
- On a real Android phone: install from the browser menu, open from the Home Screen, deny and allow GPS, allow
  notifications, send a request from another account while the app is hidden.
- On a real iPhone: add to Home Screen, then the same.
