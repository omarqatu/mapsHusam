# React migration plan

Status legend: ⬜ not started · 🟨 in progress · ✅ ported & verified · 🗑️ legacy deleted

## Phase 0 — Foundation (no pages yet)

- ⬜ Scaffold `web/` (Vite React-TS). Delete the empty `frontend-react/` skeleton.
- ⬜ Tooling: Tailwind 4, ESLint, Prettier, Vitest + Testing Library, `typecheck` script.
- ⬜ `vite.config.ts` dev proxy: `/api`, `/geoserver-proxy`, `/socket.io` (ws) → `http://localhost:3000`.
- ⬜ `api/client.ts` (token from auth store, 401 → logout, `X-New-Token` header → replace token).
- ⬜ Auth store (Zustand, persisted), `ProtectedRoute`, `RoleRoute` (admin / provider / user).
- ⬜ i18n (ar default + en), `dir` switch on `<html>`.
- ⬜ Shared UI kit in `components/ui/` modelled on Enterprise-APP: Button, TextInput, Select,
  Modal, ConfirmDialog, DataTable, Spinner, Toast, PageHeader, EmptyState.
- ⬜ App shell + router with every route below registered (placeholder pages).
- ⬜ Socket provider (`useSocket`, typed events).
- ⬜ Server: serve `web/dist` in production (the only `server.js` change in this phase; own commit).

## Phase 1 — Simple pages (prove the foundation)

| Route | Legacy source | Status |
| --- | --- | --- |
| `/admin/users` | `admin-users.html` (+ `css/admin-users.css`) | ⬜ |
| `/admin/users/:id/view` | `admin-view-user.html` | ⬜ |
| `/admin/widgets` | `widgets-admin.html`, `js/widgets-config.js` | ⬜ |
| `/admin/dashboard` | `dashboard.html` | ⬜ |
| `/notifications` | `notifications-panel.html` (socket.io) | ⬜ |
| `/widgets/portal`, `/widgets/ticker` | `widgets-portal.html`, `widgets-ticker.html`, `js/widgets-ticker.js` | ⬜ |

## Phase 2 — Search without map

| Route | Legacy source | Status |
| --- | --- | --- |
| `/search` | `no-map-search.html`, `js/no-map-search.js` (2.4k lines), `no-map-mobile.js`, `market-search.js`, `global-search.js`, `search.js` | ⬜ |

## Phase 3 — The map (`/`)

Split `index.html` into features, in this order:

1. ⬜ Map core: `config.js`, `layers.js`, `layer-manager.js`, `main.js` → `features/map/`
2. ⬜ Popup / feature details: `popup.js`
3. ⬜ Search on map: `search.js`, `global-search.js`, `location-search.js`, `quick-search.js`, `results-share.js`
4. ⬜ Tools: `measure.js`, `share-location.js`
5. ⬜ Editing (admin): `edit-core.js`, `edit-wfs.js`, `editLines.js`, `editPolygons.js`
6. ⬜ Provider panel: `provider-panel.js`, `services-bridge.js`
7. ⬜ Service requests & chat: `service-chat.js` (1.7k lines), `notifications.js`
8. ⬜ Auth UI: `auth-core-functions.js`, `auth-app-events.js`, `auth-fetch.js`, `legal-content.js`
9. ⬜ Layout: `mobile-tabs.js`, `desktop-panels.js`, `resizable-panels.js`, `panel-controls.js`,
   `ui-collapse.js`, `viewport-guard.js`, `mobile-app-bridge.js`
10. ⬜ Extras: `platform-stats.js`, `featured-services-portal.js`, widgets ticker on the map

## Phase 4 — Cut-over & cleanup

- ⬜ All routes verified on desktop + mobile width.
- ⬜ Delete legacy `*.html`, `js/`, `css/`, `original-index.html`, `dist/`; untrack `node_modules/`.
- ⬜ Remove legacy static allow-list entries from `server.js`.

## Parity checklist (fill per page before porting)

For each page, list from the legacy code — not from memory:
- Every API call (method, URL, body, which fields of the response are used).
- Every socket event listened to / emitted.
- Every user action (buttons, forms, keyboard shortcuts) and every role difference.
- `localStorage`/`sessionStorage` keys it reads or writes.
- Mobile-specific behaviour.

## Backend asks (don't fix in the migration — collect here)

- Tokens are signed without `expiresIn` and verified with `ignoreExpiration: true`.
- WFS-T editing sends GeoServer credentials from the browser (`js/edit-wfs.js`); should move server-side.
- `/api/search-features*` are public and return `SELECT *` — review exposed columns.
