# React migration plan

Status legend: ⬜ not started · 🟨 in progress · ✅ ported & verified · 🗑️ legacy deleted

## Phase −1 — Repo hygiene (before any React code)

- ✅ Untrack build/deps that are committed despite `.gitignore`: `node_modules/` (1152 files),
  `dist/`, `frontend-react/dist/` — `git rm -r --cached`, own commit. Add `dist/` to `.gitignore`.
- ✅ Review `frontend-react/` before deleting — it is **not** empty (src, docs,
  `MOBILE-APP-READINESS.md`). Done: its docs were 1–2KB stubs of the fuller root `docs/`; the 3 unique files moved to `docs/`, the rest (React 18 JS skeleton, HTML copies) deleted.
- ✅ `docs/react-migration/HOUSE-STYLE.md`: a ≤2-page digest of `../pwa-1/clients/web` conventions
  (folder layout, ui-kit component APIs, query/mutation hooks, forms, i18n, test style), so sessions
  read the digest instead of the reference repo.

- ✅ Dev environment (`dev/`): isolated Postgres in podman + seeded accounts + `dev/dev.env`; real-backend
  tests via `VITE_LIVE_API`. See `dev/README.md`. Schema grows with each page.

## Phase 0 — Foundation (no pages yet)

- ✅ Scaffold `web/` (Vite React-TS).
- ✅ Tooling: Tailwind 4, ESLint, Prettier, Vitest + Testing Library, `typecheck` script.
  Keep checks fast: `typecheck` = `tsc -b` (incremental), `lint` = `eslint --cache .`.
- ✅ Error boundary, 404 route, `Spinner`/`Toaster` (per-query error UI is part of each page's DoD).
- ✅ Env config: `import.meta.env` only for public values; no secrets in `web/` ever.
- ✅ `vite.config.ts` dev proxy: `/api`, `/geoserver-proxy`, `/socket.io` (ws) → `http://localhost:3000`.
- ✅ `api/client.ts` (token from auth store, 401 → logout, `X-New-Token` header → replace token).
- ✅ Auth store (Zustand; persisted in the legacy `map_user` format so sessions survive the cut-over), `ProtectedRoute`, `RoleRoute`, `SessionVerifier` (fail-open like legacy).
- ✅ i18n (ar default + en), `dir` switch on `<html>`.
- ✅ Shared UI kit in `components/ui/` modelled on Enterprise-APP: Button, TextInput, Select,
  Modal, ConfirmDialog, DataTable, Spinner, Toast, PageHeader, EmptyState.
- ✅ App shell + router with every route below registered (placeholder pages).
- ✅ Socket provider (`useSocket`, typed events).
- ⬜ Server: serve `web/dist` in production (own commit, logged under "Server changes"). Design: legacy
  and React coexist until cut-over, so `server.js` serves `web/dist/index.html` only for the routes in
  `web/src/routes/routes.ts` that have been switched, and `web/dist/assets/*`; everything else stays legacy.
  Do it together with the first real page (Phase 1) so it can be verified end-to-end.

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

## Phase 3 — The map (`/`) — **priority** (user, 2026-09-29: map → UI/UX → security & performance)

Split `index.html` into features, in this order:

1. ✅ Map core: `config.js`, `layers.js`, `layer-manager.js`, `main.js` → `features/map/`
   Parity: EPSG:28191 view, default centre (Al-Manara) z19, basemaps Esri/OSM/aerial-2023/none, WFS layers
   ApartRent/ApartSale/LandSale + service_all by `discriminator` (68 types, 3 visibility tiers, road-barrier
   status icon + label), layer panel (per type, show/hide all), GPS tracking (10 s throttle, blue dot),
   pointer grid coordinates, `?x=&y=` share link, 60 s refresh of visible layers.
   UX changes (functionality kept): no blocking "choose start location" modal — map opens at Al-Manara, GPS
   is the locate button, "search without map" is in the top bar; overlapping labels decluttered (icons
   always drawn); layer panel has a type filter and is a bottom sheet on phones; failed WFS extents retry.
   Deferred to their own items: popup (2), search (3), measure/share tools (4), editing (5).
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

## Definition of done (every page / feature)

- Parity checklist below is complete and every item works against the real backend.
- Ar (RTL) + En (LTR), desktop + mobile width (375px), keyboard reachable.
- Loading, empty and error states for every query; mutations disable their button while pending.
- `npm run typecheck && npm run lint && npm test` green; at least one test per page (render + main
  action with a mocked API).
- No `console.log`, no hard-coded UI text, no `any` without a comment.

## Security baseline (frontend — applies to every page)

- Render user content via JSX only; no `innerHTML`, no `eval`/`new Function`, no inline `<script>`.
  URLs from data (links, images) go through a `safeUrl()` helper (http/https/relative only).
- Token: kept in the auth store; sent only by `api/client.ts`; cleared on 401 and on logout
  (also disconnect the socket). Never put tokens in URLs or logs.
- Role checks in the UI are for UX only — the server is the authority. Never hide a security gap
  behind a hidden button; log it under "Backend asks".
- No GeoServer credentials in `web/`; WFS-T stays behind the server (see Backend asks).
- Production build must work under the current Helmet CSP (`script-src 'self'` + CDNs, no
  `unsafe-eval`): no CDN scripts in the React app — everything bundled.
- `npm audit --omit=dev` clean (high/critical) before cut-over.

## Parity checklist (fill per page before porting)

For each page, list from the legacy code — not from memory:
- Every API call (method, URL, body, which fields of the response are used).
- Every socket event listened to / emitted.
- Every user action (buttons, forms, keyboard shortcuts) and every role difference.
- `localStorage`/`sessionStorage` keys it reads or writes.
- Mobile-specific behaviour.

## Decisions for the user

- **Login wall before the map.** Legacy shows the map only after login (welcome → login → start modal). The
  React route keeps that for parity. But the WFS data (names, phones, prices) is public on GeoServer anyway,
  so the wall protects nothing and costs users. Recommend: public map, login only for actions (request,
  chat, provider panel). Flip `access` of `/` in `web/src/routes/routes.ts`.

## Server changes (allowed: functionality-preserving improvements, one commit each)

Rule: URLs, methods, auth rules and response shapes stay identical; legacy pages keep working.
Log each change here: **what · why · how to verify · commit**.

_(none yet)_

## Backend asks (needs the user's decision — behaviour-changing or larger)

- Sessions never expire by design (`requireAuth` uses `ignoreExpiration: true`); revocation is via `token_version` / `is_active` / `force_logout_flag` (checked on every request, cached). Not a hole by itself, but a stolen token stays valid until an admin force-logout or a password change — consider `expiresIn` + refresh, and a self-service "log out everywhere". Needs the user's decision.
- WFS-T editing sends GeoServer credentials from the browser (`js/edit-wfs.js`); should move server-side.
- `/api/search-features*` are public and return `SELECT *` — review exposed columns.
- CSP `connectSrc` allows any `https:`/`ws:`/`wss:` — tighten to own origin once the app is on React.
