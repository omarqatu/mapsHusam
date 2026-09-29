# React migration plan

Status legend: ⬜ not started · 🟨 in progress · ✅ ported & verified · 🗑️ legacy deleted

## Phase −1 — Repo hygiene (before any React code)

- ⬜ Untrack build/deps that are committed despite `.gitignore`: `node_modules/` (1152 files),
  `dist/`, `frontend-react/dist/` — `git rm -r --cached`, own commit. Add `dist/` to `.gitignore`.
- ⬜ Review `frontend-react/` before deleting — it is **not** empty (src, docs,
  `MOBILE-APP-READINESS.md`). Salvage anything useful into PLAN.md/`web/`, then delete.
- ⬜ `docs/react-migration/HOUSE-STYLE.md`: a ≤2-page digest of `../pwa-1/clients/web` conventions
  (folder layout, ui-kit component APIs, query/mutation hooks, forms, i18n, test style), so sessions
  read the digest instead of the reference repo.

## Phase 0 — Foundation (no pages yet)

- ⬜ Scaffold `web/` (Vite React-TS).
- ⬜ Tooling: Tailwind 4, ESLint, Prettier, Vitest + Testing Library, `typecheck` script.
  Keep checks fast: `typecheck` = `tsc -b` (incremental), `lint` = `eslint --cache .`.
- ⬜ Error boundary + global Query error handling (toast), 404 route, loading states.
- ⬜ Env config: `import.meta.env` only for public values; no secrets in `web/` ever.
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

## Backend asks (don't fix in the migration — collect here)

- Tokens are signed without `expiresIn`, and `requireAuth` / `requireAdmin` verify with `ignoreExpiration: true` — a leaked token never expires.
- WFS-T editing sends GeoServer credentials from the browser (`js/edit-wfs.js`); should move server-side.
- `/api/search-features*` are public and return `SELECT *` — review exposed columns.
- CSP `connectSrc` allows any `https:`/`ws:`/`wss:` — tighten to own origin once the app is on React.
