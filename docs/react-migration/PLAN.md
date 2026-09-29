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
2. ✅ Popup / feature details: `popup.js` → `features/map/popup/`
   Parity: click a marker → card with type/name/id, open-now + hours, ratings (avg + comments), fuel
   availability, road-barrier inbound/outbound, real-estate price+currency/area, description, pictures /
   YouTube / video / details links, call + WhatsApp (10 s cooldown, quota check fail-open, `log-contact-click`
   + `save-stat`), copy/share location link, `?x=&y=` shared-location card, `log-map-event` on click.
   XSS fix: ratings comments/user names and all feature text are JSX text (legacy injected raw HTML);
   media URLs must be https (`safeMediaUrl`), javascript:/data: dropped.
   UX changes: no hover popups (touch-unfriendly, flicker) — click only, pointer cursor on markers; empty fields
   hidden; 8 px hit tolerance; bottom sheet on phones with auto-pan; contact buttons stacked; highlight ring;
   Esc closes; a provider with only a phone (no WhatsApp) can now be called (legacy showed nothing).
   NOT yet: "طلب الخدمة" for provider-linked features is shown disabled — comes with item 7 (service requests).
3. ✅ Search on map: `search.js`, `global-search.js`, `location-search.js`, `quick-search.js`, `results-share.js`
   → `features/map/search/`. Rules were read from the code AND `server.js` (a 6-agent inventory was cross-checked by a
   second verifier pass — all six inventories had errors; the server code is the source of truth).
   **Kept (parity):** global keyword search (Arabic letter folding, ranked suggestions, "closed checkpoint" / "diesel"
   keywords); quick search (a type inside the current map view); smart search (type + field/operator/value
   conditions, cascading governorate→town→place lists from `get-unique-values`, custom typed value, price + currency,
   fixed lists for checkpoint status / fuel); search by location (my location or tap on the map, radius rules: empty =
   closest, 0 = contains the point, N = within N m; checkpoint status; fuel filters AND-ed); results list with fly-to +
   details card; yellow highlight on the map; radius circle; copy results link + replay from `?resultsShare=`; print;
   per-user search quota (`log-map-event`, 429 message, fail-open); rating-desc ranking; map refresh button.
   **Changed on purpose (better, documented):**
   - Result rows are compact (name, type, place, rating, open/closed, price/area, distance) with call/WhatsApp buttons;
     the full details open in the card on tap. Legacy rendered the whole popup HTML inside every row.
   - Nearby results are sorted nearest-first and show the distance (legacy: by rating).
   - Nearby extra filters apply BEFORE choosing the closest (legacy fixed this too); radius validated 0–50 000 m.
   - Global search: the three real-estate queries run in parallel; keyword hits need one request per direction
     (same-field conditions are OR-ed by the server) instead of up to ten; the LONGEST matching keyword wins
     ("أزمة خانقة" = heavy only — legacy let the shorter "أزمة" override it); rows are ranked by type-name match →
     number of typed words matched (the server ORs the words) → rating; one row per feature.
   - Operator labels say ≥ / ≤ because the server's `>` / `<` are inclusive.
   - A newer search cancels the older one (legacy: last response wins, races); errors show a message.
   - Share link = new clean format (`?resultsShare=` base64url JSON, validated on read). **Old links do not open** —
     acceptable in the test phase (decision: no legacy-compat layers).
   - One search panel with 3 tabs + a search box floating on the map; bottom sheets on phones (one at a time).
   **Removed:** the local fallback that searched the features already loaded in the browser when the API failed (it
   returned partial, stale data silently) — now a clear error; the WFS/CQL fallback of global search; the 71-button
   quick-search bar (now a filterable chip grid in the panel).
   **XSS / bug fixes:** 5 `innerHTML` sinks with server data (search.js ×2, quick-search, location-search,
   global-search) → JSX; global-search highlight built HTML and its regex crashed on `(`; print report built HTML
   strings and printed the literal text `${new Date()}` instead of the date; media shown twice when two fields hold
   the same video.
4. ✅ Tools: `measure.js`, `share-location.js` → `features/map/tools/`
   **Inventory (read from `js/measure.js`, `js/share-location.js`, `index.html`, `main.js`, `shared-utils.js`):**
   - Two top-bar buttons (`measure-tools-toggle-btn`, `share-location-btn`) open `#measurePanel` / `#shareLocationPanel`
     (draggable, minimisable, closable; on phones tabs from `mobile-tabs.js`). `rolePermissions` says canMeasure/canShare
     for every role, so nothing is role-gated.
   - Measure: own vector layer (yellow `#ffcc33` 3 px line, 20 % fill, dot r7 with white ring); buttons 📏 distance (m),
     📐 area (m²), 📍 draw point — each starts ONE `ol/interaction/Draw` (removed on `drawend`); 🧹 clear (empties the layer,
     removes the interaction, text "تم مسح النتائج"); ✕ closes the panel and removes the interaction (drawn shapes stay).
     While drawing, `DoubleClickZoom` is switched off and switched back on in a `setTimeout(0)` after end/abort/clear/close
     (a double click both ends a shape and zooms). Results: planar `getLength()` / `getArea()` in metres of EPSG:28191
     (no geodesic), `toFixed(3)`: "المسافة: X متر طولي", "المساحة: X متر مربع", point → "E: … N: …" (EPSG:28191, 3 dp);
     on `drawstart` the box shows "جاري الحساب بدقة...". Only the last result is shown.
   - Share: panel open ⇒ `singleclick` listener + crosshair cursor (panel closed ⇒ removed; the `MutationObserver` on the
     panel's `hidden` class and `window.toggleShareLocationTool` are the DOM glue). A tap replaces the single red pin
     (layer zIndex 10000, PNG from a CDN) and shows: Palestine Grid `E: x , N: y` (3 dp), WGS84 `Lat: … , Lon: …` (6 dp,
     `ol/proj.transform` 28191→4326), and the link `origin+pathname?x=<3 dp>&y=<3 dp>&z=<zoom 0 dp>`; status line "تم تحديد الموقع
     بنجاح:". Buttons: copy link (phones: `navigator.share({title,url})` only; desktop: `clipboard.writeText`, fallback
     `execCommand('copy')`, success = button turns green "تم النسخ!" for 2 s, failure/empty = toast), copy grid coords as
     `E,N` (ArcGIS Pro), copy WGS as `lat,lon` (Google Maps), open `https://www.google.com/maps?q=lat,lon` in a new tab,
     🧹 clear (pin, link, both coordinate texts back to `---`, hint text).
   - On page load `?x=&y=[&z=]` centres the map, sets zoom `z`, drops the pin and fills the coordinate texts ("عرض الموقع
     المستلم من الرابط:") — the link box stayed empty. (The details card for that point is item 2; `MapView` centres.)
   **Kept (parity):** all three draw modes with the same numbers/precision/units; clear; one-shape-per-press; drawn shapes
   survive closing the panel; double-click-zoom suppression while drawing; share pin by tap, link format
   `?x=&y=&z=` (built by the existing `locationShareLink`, now with an optional zoom), grid + WGS coordinates with their
   copy formats, Google Maps button, native share sheet on phones / clipboard elsewhere with 2 s "copied" feedback,
   clear; the pin survives closing the panel; opening a `?x=&y=&z=` link zooms to `z`, shows the pin and the coordinates in
   the share panel; crosshair cursor while a tool is active.
   **Changed on purpose (better, documented):**
   - While a tool is open, map taps no longer select features / open the details card / pick a nearby-search point
     (`activeTool` flag in `store.ts`, honoured by `SelectionController` and `ResultsLayer`). Legacy let a tap both drop a
     pin and open a popup.
   - One end-side panel at a time: opening measure/share closes the layer and search panels and vice versa (legacy
     stacked several `panel-right` panels on top of each other). On phones a tool also closes the details card.
   - Measure: the result is live while a line/polygon is being drawn (legacy: "calculating…" until the end); a Finish and an
     "Undo last point" button appear while drawing (a double tap is hard on phones); pressing the active mode again or Esc
     cancels the shape; a hint line says how to draw.
   - Share: copy/Google/clear buttons are disabled until a location exists (legacy showed a warning toast); the pin is an
     inline SVG (no CDN request); Google Maps opens with `noopener,noreferrer`; the link box now also shows the link of an
     opened shared link (legacy left it empty); the phone button says "Share link".
   - The panels use the shared `MapSheet` (side card / bottom sheet) instead of draggable/minimisable floating panels; the
     tool buttons are round map buttons in the end-side column (ruler, share) instead of top-bar pills.
   **Not ported:** panel drag/minimise (replaced by the sheet), `alert()` fallbacks when `window.toast` is missing.
   Tests: `tools/*.test.ts(x)` — geometry math, number/coordinate/link formats and their round trip through the map's own
   `?x=&y=&z=` reader, clipboard helper, panel exclusivity, and that layers / interactions / click listeners / cursor /
   double-click zoom are restored on close (real `ol/Map` in jsdom).
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
- `/api/search-features?ignore_status=1` bypasses the `status=0 AND auto_status=0` filter with no auth check — anyone can list
  inactive/expired records.
- Search returns at most 2000 rows with no offset/pagination; a text search ORs its words (broadens instead of narrowing).
- `/api/log-map-event` ignores the `service` field for search events (only `provider` and `event_type` are stored), so the
  dashboard can't tell WHAT was searched.
- Results are filtered client-side for nearby search (whole layer fetched, up to 2000 rows) — a server-side distance filter
  would scale better.
- CSP `connectSrc` allows any `https:`/`ws:`/`wss:` — tighten to own origin once the app is on React.
