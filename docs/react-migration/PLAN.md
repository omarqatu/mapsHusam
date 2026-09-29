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
| `/notifications` | `notifications-panel.html` (socket.io) | ✅ |
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
   Merge review (main session): verified in the browser against real data — length 119.3 m, area 2001 m², share pin
   with grid + WGS84, map taps don't select features while a tool is open and do again after closing. Fixed on merge:
   one `toLonLat` (both sides had added one), one Palestine-grid formatter (`formatGrid(coord, decimals)`), clipboard
   helper moved to `lib/clipboard.ts` and reused by the details card and the results link, landscape phones: the tool
   column scrolls and refresh/zoom hide below 560 px height (gestures + auto refresh cover them).
5. ⬜ Editing (admin): `edit-core.js`, `edit-wfs.js`, `editLines.js`, `editPolygons.js`
6. ✅ Provider panel: `provider-panel.js`, `services-bridge.js` → `features/map/provider/`

   **Inventory (read from `js/provider-panel.js`, `js/services-bridge.js`, `index.html` #provider-mini-panel, `css/provider-panel.css`,
   `js/mobile-tabs.js`, `js/main.js`, `js/auth-core-functions.js`, and the handlers in `server.js`, which are the source of truth).**
   - *Who:* `role = 'provider'` (or `account_type`), read from `map_user` (localStorage → sessionStorage → `user`). The provider's account is
     linked to ONE feature by two `users` columns, `service_layer` (a service `discriminator` such as `plumber`, or a real-estate layer name;
     the server also accepts the old `services:plumberLayer` spelling and returns the clean form) and `feature_id`. An admin sets them with
     `POST /api/admin/users/update { user_id, service_layer, feature_id }` (no validation that the layer/feature exists).
   - *What the panel is:* a fixed panel bottom-left ("🛠️ لوحة إدارة الخدمة الحية"; draggable, minimisable, position kept in
     `localStorage.provider_panel_pos`; on phones/tablets a tab "🛠️ إدارة الخدمة" of `mobile-tabs.js`, drag disabled). Welcome badge
     ("مرحباً، {full_name}"), a status sentence, buttons **🟢 متوفر (موقعي)**, **🟢 متوفر (السابق)**, **🔴 غير متوفر**,
     **📍 تتبع مباشر (كل 10 ثوانٍ)**, **📍 الانتقال إلى موقعي على الخريطة**, and one indicator line (checking / cooldown / error / status).
   - *What a provider can do — only this:* set the linked feature's **status** (0 = available = visible on the map and in search, 1 = busy =
     hidden: search filters `status = 0 AND auto_status = 0`) and **move the feature's point** to the phone's GPS position. Nothing else:
     no editing of name / description / hours / pictures, no WFS-T, no GeoServer write. (`auto_status` = closed by work hours, set by a DB
     trigger; a provider cannot change it, so "available" during closed hours is still hidden.)
   - *Button rules (legacy):* "available (my location)" = GPS fix (`requestGeolocationPosition`: high accuracy, 15 s timeout, no cache) →
     EPSG:4326→28191 (`proj4`) → 2-decimals → send status 0 + x/y; on a GPS error a warning toast ("previous location will be used") and it
     sends status 0 without coordinates. "available (previous)" = status 0, no coordinates. "busy" = status 1, no coordinates.
     After every **successful** update all four buttons lock for **10 s** ("⏳ يرجى الانتظار N ثانية…", client-side only) and the map
     layer is cleared + refreshed. A failed update unlocks at once and shows the server message in the indicator + a toast.
   - *Live tracking:* the toggle calls "available (my location)" immediately and then every **10 s** (`setInterval`, no in-flight guard) until
     pressed again (button text swaps). Ticks bypass the cooldown. Never stopped by logout / busy / errors: pressing "busy" while tracking
     is impossible (locked by the cooldown the ticks keep restarting) — but after a 10 s gap it would be flipped back to available by the next
     tick.
   - *Fly to my location:* uses the coordinates from the last `get-provider-service` (or the last update); only when `x > 100000`; puts a red
     circle (r 12, white ring, layer `providerFlyToLayer`, kept until the next fly) and animates to zoom 19 (1.2 s). Otherwise only a
     `console.warn`.
   - *Account states (from `get-provider-service`):* `success:false` (not linked) OR `user_status !== 0` (account frozen) OR no `service` →
     one red sentence "ليس لديك صلاحية تعديل حالة أي معلم جاري حالياً." and the buttons locked (`isAccountFrozen`). A network failure of that
     call unlocks the buttons with a stale status (but then a click says "no service layer linked").
   - *API calls (every one; nothing goes to GeoServer — the "line ~151 fetch" is `get-provider-service`):*
     - `GET /api/get-provider-service?user_id=<id>` (`requireAuth`; the legacy page sends the token through `auth-fetch.js`). The server
       **ignores** `user_id` and uses the token's uid. Response: not linked `{ success:false, show_panel:false, message }`; linked
       `{ success:true, show_panel:true, user_status (users.status: 0 active / other frozen), service:{ service_layer (clean discriminator),
       feature_id, id, status (0/1 of the feature row), x_coord, y_coord (Palestine Grid; **strings** from Postgres numeric), x_global,
       y_global (always undefined) } }`. 403 = layer not whitelisted, 404 = user missing, 500. Side effect on a GET: copies the feature's
       coordinates into `users.x_coord/y_coord` when those are null.
     - `POST /api/update-service-status` (`requireAuth`) body used by the server: `{ user_id (must equal the token uid), service_layer, feature_id|id,
       status (0|1 else 400), x_coord?, y_coord? }` (legacy also sent `account_status`, `layer_status`, a duplicate `id` — ignored).
       Server checks: caller is an active provider whose `users.service_layer/feature_id` equal the body (else **403** "هذا المعلم غير
       مرتبط بحسابك"); layer whitelisted (403); if `x_coord > 100000` and `y_coord` set → `status, x_coord, y_coord, geom =
       ST_SetSRID(ST_MakePoint(x,y),28191)` (real-estate polygons: only the two columns) else `status` only; also copies x/y to `users`.
       Response `{ success:true, status, message }`; 404 if no row; 500 with `error`.
     - `services-bridge.js` calls `/api/provider-linked-features`, `/api/service-ratings…`, `/api/platform-stats`, `/api/search-features` but
       **none of it is used** (see below), and the provider panel itself never calls it.
   - *Socket events:* none (neither emitted nor listened to; the server does not broadcast a status change either).
   - *Storage:* reads `map_user` / `user`; **writes** `map_user` (overwrites `status` — the ACCOUNT status — with the feature status, and
     `x_coord`, `y_coord`, `service_layer`, `feature_id`); `provider_panel_pos` (drag position); `provider_status_{uid}` is only *removed* at
     logout (`auth-core-functions.js`) — nothing ever writes it (dead key).
   - *Mobile:* the panel is a tab of `mobile-tabs.js` (only for providers), drag/saved position ignored, `max-width: 90vw`.
   - *XSS sinks:* none in `provider-panel.js` (only `innerText` / `textContent`, the welcome name included). `services-bridge.js` has the
     safe helpers `sanitizeHTML` (textContent → innerHTML) / `escapeForAttribute`; no caller.
   - *`services-bridge.js`:* a 450-line `window.AppServices` facade of fallbacks for a `window.CoreService` that no script defines. Nothing in
     `js/` or any HTML reads `AppServices` (`grep` = only its own file); its `providerLinkedFeaturesCache` is re-implemented in
     `shared-utils.js`. **Dead code — nothing to port.** The React equivalents already exist (`api/mapEvents.ts` `providerLinked`,
     `lib/format.ts`, `lib/clipboard.ts`, `featureModel.ts` time/URL helpers); it is deleted with the legacy `index.html` at cut-over.
   **Ported (checklist):** ✅ linked-feature lookup (`get-provider-service`) with the three account states (not linked / frozen / ready) ·
   ✅ available (my location) with GPS→28191 and the GPS-error fallback · ✅ available (previous) · ✅ busy · ✅ 10 s cooldown after a
   success, none after a failure · ✅ live tracking every 10 s (timer lives in `ProviderTracker`, so it runs with the panel closed) ·
   ✅ fly to my location (red circle, zoom 19) · ✅ layer refresh after an update · ✅ `provider_status_<id>` removed on logout (`authStore.logout`).
   Tests: `provider.model.test`, `provider.test.tsx`, and real-backend `provider.live.test.ts` (run against a server started from this branch).
   **Changed on purpose:**
   - The floating draggable panel is a normal map panel opened by a tool button (`ProviderButton`, providers only); on wide screens it opens by
     itself once, on phones it stays closed so it does not cover the map. No drag, no saved position (`provider_panel_pos` is not written).
   - Requests are sent one at a time (in-flight guard); legacy live tracking could overlap requests. Tracking stops when the account can
     no longer update or the user leaves the map, instead of running forever after logout.
   - The legacy code overwrote `map_user.status` (the ACCOUNT status) with the feature status and copied coordinates into `map_user`; React
     keeps the session untouched and reads the feature status from the server (TanStack Query, refetched after each update).
   - Live-tracking ticks are silent (no success toast); a failed tick shows the error in the panel.
   - The "no service layer linked" click error of legacy is impossible: the buttons stay locked until the account has loaded.
   **Not ported:** `services-bridge.js` (dead code, see above); dragging/minimising the panel.
7. 🟨 (typecheck, lint, live tests pass; browser walk pending) Service requests & chat: `service-chat.js` (1.7k lines), `notifications.js`
   **Done (`features/requests/`, `features/notifications/`, `api/{requests,notifications,socket}.ts`):**
   - "Request service" on the details card and on search / featured rows (was disabled) → confirm dialog → `POST /api/service-requests`; an open pending request is not duplicated, an accepted one reopens its chat.
   - "My requests" list (status, accept/reject for the provider, cancel with a mandatory reason, open chat / archive, rate, write comment), chat (messages, polling + socket push, "agreed" confirmation from both sides, then call / WhatsApp with the legacy greeting), star rating + later comment, provider's incoming banner with ring and queue counter.
   - Live: `service_request_new/response/message/completed/cancelled` refresh the query cache; unseen-activity marks per user in localStorage (`svc_unseen_<uid>`).
   - Notifications over socket.io only (`get_unread_notifications`, `mark_notification_read`, `new_notification`): bell with unread badge, list, mark read / all, refresh, toast + system notification when the tab is hidden.
   - Entry points: bell and "My requests" icon in `UserMenu` (map bar and shell).
   - `dev/seed-users.mjs`: the dev provider is now linked to plumber #900001 so the live test can create requests.
   Tests: `requests/model.test.ts` (rules, numbers, notification list, unseen marks), `requests/requests.live.test.ts` (real backend: create, duplicate 409, accept, chat, both agree, rating, comment, reject, cancel).
   **Changed on purpose:**
   - Popups built with `innerHTML` (chat, list, rating, banner) are dialogs / a banner in JSX; all user text (names, messages, reasons, comments) is plain text.
   - Browser notification permission is asked from the bell menu ("enable browser notifications"), not on page load.
   - Notification badge counts only unread rows (legacy counted the list, read rows included).
   - The "My requests" button lives in the top bar next to the bell (legacy: under the notifications button in the profile area); a green dot marks new activity.
   - Rating and comment prompts are plain dialogs with clickable stars (keyboard accessible); the star labels are unchanged.
   - Some Arabic toast texts lost their leading emoji; error texts from the server are still shown as is.
   **Not ported / open:** `notifications-panel.html` (standalone page, route `/notifications` stays a placeholder: the bell list covers it; decision below); legacy `js/service-chat.js` and `js/notifications.js` are still loaded by the legacy pages and stay until the map page switch; layout-level mobile placement of the bell (item 9). Not verified: real-time socket flows between two browsers (covered by unit/live REST tests only), visual pass at 390 px.
8. ✅ Auth UI: `auth-core-functions.js`, `auth-app-events.js`, `auth-fetch.js`, `legal-content.js`
   **Parity checklist (from the legacy code).**
   - ✅ Promo splash → `/welcome` (pitch, 6 feature cards, "create account" / "log in", terms + privacy links).
   - ✅ Terms gate → first step of `/register`: terms list, "I agree" box, Facebook page link + "I liked it" box; the continue button stays disabled until both are ticked.
   - ✅ Register (`POST /api/auth/register`): name, WhatsApp prefix 970/972, local mobile `^05\d{8}$`, password. Sends `whatsapp_number = +<prefix><phone without 0>`, `email: ''`. Role is always `user` (server forces it). Account is created inactive: no session, toast "contact us on Facebook to activate", then `/login`.
   - ✅ Login (`POST /api/auth/login`): phone regex check, server error message shown, welcome toast, redirect to the page the user came from (`state.from`) or `/`. Session stays in `map_user` (shared with the legacy pages; `authStore.ts`).
   - ✅ Change password (`POST /api/auth/change-password`): current password required, new one at least 6 chars, server message on failure, rotated `X-New-Token` stored by `api/client.ts`. Opened from the key icon in `UserMenu`.
   - ✅ Session check on start (`verify-session`, fails open) with the legacy per-reason messages (force logout / inactive / not found). Was a single generic message before.
   - ✅ `auth-fetch.js` (Bearer header, `X-New-Token`, 401 handling) is `api/client.ts` since Phase 0.
   - ✅ Legal texts (`legal-content.js`): guide, search guide, provider guide, subscription guide, interactive-map guide, about, terms, privacy, contact → `features/legal/content.ts` as structured data (no HTML strings), shown by `LegalDocView` in a dialog (`LegalModal`/`LegalLinks`) and as pages `/legal/:key`. The Arabic wording is unchanged.
   - ✅ Merge review (main session): /welcome, /register, /login, /legal/terms opened at desktop and 390 px against the dev server — layout fine, no console errors. Form submit flows are covered by the live-API tests.
   **Changed on purpose (better, documented):**
   - The promo splash, welcome/terms, login and register overlays (stacked over the map, toggled with `hidden`) are separate routes `/welcome`, `/register`, `/login`, so the back button and links work. Same texts and same steps.
   - The login page did not check the phone format in the React skeleton; it now does (`05` + 8 digits, as legacy).
   - The register form has no "account type" select (its only option was "user"; the server ignores the field). Client-side password length check (min 6) added before the request; the server already enforced it.
   - The 3-second submit cooldown is gone: the button is disabled while a request is in flight and the server rate-limits (`authLimiter`).
   - Terms/privacy/guide open in a dialog over the current page (as legacy) and also have their own URL `/legal/terms` etc.
   - Legal texts: the duplicate `guideMap` entry (byte-identical to `guide`) is one entry; links to `/original-index.html` and `/no-map-search.html` point to `/` and `/search`; a corrupted emoji in the "search tips" heading became a light bulb. Arabic only for now (English needs the owner's review).
   - The promo slideshow (16 photos rotating every 4 s), the floating words and the Facebook-styled buttons are not ported: the welcome page is a static pitch. Add the photos back if the owner wants them.
   - Login/registration error and success messages are toasts/inline alerts instead of `alert()` fallbacks.
   **Not ported:** the top-of-map user badge and the `enterPlatform` bootstrap (map init, edit-panel hiding, notification init): they belong to the map page / layout (item 9) and the notifications item (7). The legacy `logoutPlatform` also removes `provider_status_<id>` from localStorage: do that when the provider panel (item 6) is ported.
   **Routing kept as is:** `/` still requires a login and sends anonymous visitors to `/login` (not `/welcome`); see "Decisions for the user". `/welcome` is reachable by URL and from the header logo on the auth screens.
   Tests: `features/auth/{phone,RegisterPage,LoginPage}.test`, `features/legal/legal.test.tsx`, and the real-backend `features/auth/auth.live.test.ts` (register, duplicate phone, inactive account cannot log in, change password and back).
9. ⬜ Layout: `mobile-tabs.js`, `desktop-panels.js`, `resizable-panels.js`, `panel-controls.js`,
   `ui-collapse.js`, `viewport-guard.js`, `mobile-app-bridge.js`
10. 🟨 Extras: `platform-stats.js`, `featured-services-portal.js`, the "road status" / "fuel status" buttons, widgets ticker on the map
   ✅ **Done here (`features/map/extras/`):** the featured-services portal, the road-status and fuel-status lists and the
   platform statistics. ⬜ **Not in this item (own items):** the widgets ticker strip + the full widgets portal (`widgets-ticker.js`,
   `widgets-portal.html`), and the mobile "home" tab (`mobile-tabs.js`, item 9) — it can open the panel with
   `useExtrasUi.getState().openPanel('roads' | 'fuel' | 'stats' | 'featured')` (`extras/store.ts`), as can the footer links.

   **Inventory (read from the code; `server.js` is the source of truth).**

   *What the legacy map shows.* Top-left, four pills: "الانتقال إلى البحث بدون خريطة" (already in the React top bar),
   **خدمات مميزة** (`#open-featured-services-desktop`, green), **حالة الطرق** (`#btn-open-road-status`, orange), **حالة محطات
   الوقود** (`#btn-open-fuel-status`, blue); a footer bar `#platform-stats-footer` with six counters. On phones the same two
   status buttons live in the mobile "home" tab (`mobile-tabs.js` → `#mobile-btn-open-*-status`) together with the stats.

   *The two status buttons do not have their own screen.* `widgets-ticker.js` (l.1036-1063) binds them to
   `openWidgetsPortalToCard('portal-road-status-card' | 'portal-fuel-status-card')`: it opens the big widgets-portal modal
   (8 cards: currency, gold, weather, fuel prices, transport, calendar, road status, fuel status) and scrolls to that card. Only
   those two cards belong to this item; the other six are the widgets-portal item. The two cards:
   - Rows = **every** feature of the layer. `GET /api/search-features?layer=road_barriers|fuel_stations&workspace=services`
     (no other params; the server adds `status = 0 AND auto_status = 0`, orders by `display_order NULLS LAST, id`, max 2000).
     Fields used: `name`, `des` (checkpoints: shown as "name (des)"), `stop` (inbound) + `stop2` (outbound; missing = "غير محدد"),
     `diesel` / `banzen95` / `banzen98` (0 = available, else not). Status → icon/colour/label = `getRoadBarrierStopInfo`
     (already in `config.ts` `ROAD_BARRIER_STATUS`) and `getFuelAvailabilityInfo`.
   - "آخر تحديث": `GET /api/widgets-data` → `road_status_updated_at` / `fuel_status_updated_at` (MAX(`updated_at`) of the layer's
     rows in `service_all`; the other fields of that response — `groups` — are the widgets-portal item). Shown relative: under
     10 min "الآن" (green), else rounded to 5 min ("منذ ساعة و5 دقائق").
   - A search box per card filters the rendered rows client-side (words AND-ed, Arabic letter variants folded, matches the
     rendered text incl. status words). Lists and stamps refresh every 60 s while the tab is visible
     (`createVisibilityAwareInterval`); "تحديث الكل" refreshes everything. Rows are not clickable in legacy.
   - No `log-map-event`, no quota — plain reads.

   *Platform stats* (`platform-stats.js`, 150 lines): `GET /api/platform-stats` (public, cached 60 s on the server, retried
   3× with 1 s / 2 s back-off, then "تعذر تحميل الإحصائيات حالياً"). Response `{ success, data }`; used fields: `usersTotal`
   (+ breakdown `usersAdmin` مشرف / `usersUser` مستخدم / `usersProvider` مزود), `viewsMap`, `viewsQuickSearch`, `viewsTotal`,
   `servicesCount`, `featuresCount` (labelled "عدد مزودي الخدمات": every real-estate + service row). Six cards, numbers with
   `toLocaleString()`. Targets: the map footer, the mobile home tab, and `no-map-search.html` (that page is the search item).
   No user action. (`pstats-*` CSS is only the styling of those cards.)

   *Featured services portal* (`featured-services-portal.js`, 720 lines): the green button opens `#featured-services-panel`
   (side panel; closes other panels via `closeAllPanels`; on phones it is the mobile "featured" tab). Content is built once, on
   first open, from these calls (all public, no auth):
   - `GET /api/search-features?layer=service_all&workspace=services&field_0=rating&operator_0==&value_0=10&conditions_count=1`,
     and the same with `layer=ApartRent|ApartSale|LandSale&workspace=realestate` (real-estate rows get `discriminator = layer`);
     repeated with `value_0=9.9`. → sections "المميزين" (10) and "موصى بهم" (9.9). A failed request contributes nothing.
   - `GET /api/top-rated-providers?limit=15` → `items[]` `{ service_layer, feature_id, avg_rating, total_ratings }` (real
     customer ratings). Kept when `service_layer` is a known service type; grouped by layer; per layer
     `POST /api/search-features-batch { layer, workspace: 'services', ids }` → FeatureCollection, matched back by `properties.id`.
     → section "الأعلى تقييماً" (avg/total are carried but not displayed in legacy).
   - Sections "صور" / "فيديوهات" / "قبل وبعد" are filtered from the featured + recommended rows: has `pic`-like field / `video`-like
     field / both `details_link_1` and `details_link_2` (the "before" and "after" media).
   - Each section shows at most 10 cards; the first of each real-estate layer (rent, sale, land) is always included.
   - "خدمات قريبة من موقعي": button "تحديد موقعي" (geolocation → EPSG:28191, blue marker + fly to z18), shortcuts "حواجز الطرق" /
     "محطات الوقود" (locate + only that type). Then `GET /api/search-features?layer=service_all&workspace=services` plus the three
     real-estate layers (whole layers, ≤ 2000 rows each), the 10 closest by `getClosestPoint` distance, optional type filter
     (13 groups, `SERVICE_GROUP_BY_LAYER`, per-group "select all", a filter box, "تطبيق الاختيارات" / "عرض الكل").
   - A card: media (video → YouTube facade that turns into an iframe on click / `<video>` / link; images; before-after pair),
     badge "label · type (رقم: id)", name, place, open/closed + `work_hours`, town, governorate, price + currency + area (real
     estate), fuel availability (stations), inbound/outbound (checkpoints), description; actions: linked provider → "طلب الخدمة"
     else call / WhatsApp (`handlePhoneCall` / `handleServiceRequest`: cooldown, quota, contact log), and "الانتقال إلى الخريطة"
     (yellow highlight + fit to z19 + `log-map-event map_click`).
   - Storage: none. Socket: none.

   **Parity (all ✅ unless noted).**
   - ✅ Road status list: every checkpoint, inbound + outbound status, "name (des)", "not set" for a missing `stop2`, search box,
     "last updated" (relative, green when fresh), auto-refresh every 60 s, manual refresh, empty / loading / error states.
   - ✅ Fuel status list: every station, diesel / 95 / 98 availability, search, last updated, refresh, same states.
   - ✅ Platform stats: users (+ admin / user / provider), providers, services, map visits, quick-search visits, total visits;
     loading / error; retried 3× like legacy.
   - ✅ Featured portal: featured (10), top rated, recommended (9.9), photos, videos, before / after sections; ≤ 10 cards each with the
     three real-estate kinds guaranteed; near-me (locate, road / fuel shortcuts, type filter with groups + select-all + filter box,
     10 closest by distance); cards with media, facts, status, fuel / barrier status, call / WhatsApp (shared cooldown + quota + log),
     "show on map" (+ `map_click` log); linked providers show the disabled "طلب الخدمة" (comes with item 7).
   - ✅ Escape / phone bottom-sheet behaviour like the other panels (one sheet at a time; Escape closes the card first).

   **Placement (UX).** The four coloured pills and the footer bar are replaced by **one round map button** (✦, end column, under
   layers) that opens **one panel with four tabs**: مميزة · الطرق · الوقود · إحصائيات. Bottom sheet on phones. Tabs load their data
   the first time they are shown and stay mounted (inputs survive tab switches). The map stays uncluttered: nothing floats over it
   at rest. Road / fuel status are still two taps away (button → tab) and reachable in one call by `openPanel('roads' | 'fuel')`.

   **Changed on purpose (better, documented):**
   - Status rows are tappable: fly to the feature and open its details card (legacy rows were dead text). Road / fuel lists
     therefore did not need the search `ResultsPanel` (it would also have counted against the search quota and shown neither
     inbound/outbound nor fuel availability).
   - "Last updated" shows one unit ("منذ ساعتين") through `Intl.RelativeTimeFormat`, not two ("منذ ساعتين و5 دقائق").
   - Stats load when their tab is opened, not at page load (legacy fetched for the footer on every visit).
   - Near me: the type filter applies as you tick (no "apply" button); the location marker is the same blue dot as
     "search near a location" (one `nearbyCenter`), and the panel shares one geolocation helper (`geolocate.ts`) with that tab.
   - Map UX pass: on phones the map view is padded above the bottom sheet, so the selected marker stays visible after a
     search pick or tap (before it hid under the card); the +/- zoom buttons are hidden on phones (pinch / double-tap
     work, and the tool column no longer covers half the screen). A lone `0` in `work_hours` (placeholder) is not shown
     as a schedule.
   - Map UX pass 2: the search box is centred over the map (legacy: a bar stretched inside the header); on phones it is
     a full-width bar with the tool column below it. A selected marker is centred in the *visible* map — beside the
     side card on desktop, above the sheet on phones (view padding in `SelectionController`). Focus state of the box
     uses the legacy `.global-search-wrapper` look (brand border + soft ring).
   - One shared top bar (`components/AppHeader`) for the map and every other page (legacy: each page its own header); on
     phones the page links fold into a menu button. `/notifications` is a real page (legacy `notifications-panel.html`):
     the bell's list (`NotificationList`, shared) with an all / unread filter; the bell keeps a "view all" link.
   - Tidy pass: one account menu in the top bar (avatar → name, role, change password, log out) instead of a name plus
     four loose buttons; the coordinates bar is centred; status emoji (🟢🔴⚪✔️❌📍) are `StatusDot` / lucide icons
     (service-type emoji on the map stay: they are the type's identity); the card's fuel list is the shared `FuelBadges`;
     a parcel label "0 م²" (missing area) is no longer drawn.
   - Panels are draggable on desktop (`hooks/useDraggablePanel`, wired once in `MapSheet`): drag by the header, kept inside
     the map, position remembered per panel in `localStorage`, double-click the header to reset. Not on phones (bottom
     sheets). Legacy also let panels be resized and minimised — not ported (the panels are content-sized now).
   - Feature card re-ordered: status + rating on one line, contact / request button first, one location line (place ·
     village · governorate) instead of four fields, no name repeated under the header, only filled-in fields shown,
     media folded into a section (open when there is a single item), share link + coordinates in one footer row. A URL
     in the image field that is not an image (e.g. a Facebook page) shows as a plain link with an external-link icon.
   - Readability pass on every map panel: hints are 14 px `slate-600` (were 12 px `slate-500`), nothing below 12 px, no
     `slate-400` text; panels are 22 rem wide; quick-search types are an equal two-column grid (were ragged pills);
     layer section headings 14 px bold; featured cards use 14 px for the data lines.
   - Side panels are as tall as their content (max: the map minus the header), not stretched top to bottom; the card hides
     an area of 0 (missing data), joins place names without repeating one another contains ("رام الله" inside "رام الله
     وسط البلد"), and says so when a feature has no contact details instead of ending without an action.
   - Live tests run file by file (`fileParallelism` off when `VITE_LIVE_API` is set): they share the seeded accounts.
   - Media sections show only their own kind (photos section = pictures, videos section = videos); everything is still in the
     details card. Cards use the shared `MediaGallery` (enlarge on click, https-only URLs via `safeMediaUrl`) instead of the
     YouTube facade; a top-rated card shows the real average and the number of ratings (legacy carried but hid them).
   - Fuel search matches the fuel names, not the words "available / not available" ("available" is a substring of "not
     available"); checkpoint search matches the status words ("مغلق", "مفتوح", "أزمة").
   - XSS: legacy built every card and row with `innerHTML` and did not escape `name` in the ticker rows (`${name}` in
     `buildPortalFuelStatusItemsHtml`, `renderFuelStationsStatusTicker`); all of it is JSX text now.
   - Shared code introduced/extracted while doing this (no duplicates left): `components/ui/StatCard` (water-platform API) and
     `Tabs` (SearchPanel uses it too); `search/ResultContact` (the call / WhatsApp block of a result row, now also used by
     the cards); `popup/logMapClick`, `geolocate.ts`, `nearby.formatDistance` / `distanceToResult`, `featureModel`
     `hoursLabel` / `priceLabel` / `labelMedia` / `detailLinks` (FeatureCard uses them too); `SearchInput` with `debounceMs={0}`
     no longer drops letters typed fast (it had a stale-echo race).

   Files: `web/src/features/map/extras/*`, `web/src/api/{platform,liveStatus,featured}.ts`, `search.ts` (`batch`). Tests:
   `extras.logic.test.ts` (pure), `extras.test.tsx` (render, mocked fetch), `extras.live.test.ts` (real backend, `VITE_LIVE_API`).

   Merge review (main session): all four tabs checked in the browser on desktop + phone against real data (admin),
   no errors. Fixed on merge: `ResultContact` (session) now renders the shared `ContactButtons` (one look, one
   component for card / rows / featured cards); `priceLabel` and the stats tab format through `lib/format.ts`
   (a second locale helper `numberLocale` removed); checkpoint/fuel checks use `isRoadBarrier`/`isFuelStation`.
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
  Related: with a login wall, should anonymous visitors land on `/welcome` (the legacy promo) instead of `/login`? Not decided; today `ProtectedRoute` redirects to `/login`.

## Server changes (allowed: functionality-preserving improvements, one commit each)

Rule: URLs, methods, auth rules and response shapes stay identical; legacy pages keep working.
Log each change here: **what · why · how to verify · commit**.

- **`POST /api/update-service-status`: cast `x_coord`/`y_coord` to `float8`.** The same `$2`/`$3` were used as column values and as
  `ST_MakePoint` arguments; PostgreSQL deduced conflicting types (numeric vs double) and the update failed with 500 "فشل تحديث قاعدة
  البيانات الخلفية" whenever a provider sent coordinates. Response and request unchanged. Verify: `web/src/features/map/provider/provider.live.test.ts`
  (moves the point and reads it back). Commit: `fix(server): cast provider coords to float8…`.

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
- **Extras (item 10):** `/api/platform-stats` calls every row of `map_service_stats` a "visit" — those rows are events (map clicks,
  searches, contact clicks; `source_page` only distinguishes `quick_search`), so "visits" over-counts a busy user; and
  `featuresCount` is labelled "service providers" but counts every real-estate + service row (also inactive ones). Decide the
  intended definitions (a real visit counter, active rows only) — the UI only shows what the server returns.
- **Extras:** `/api/search-features-batch` has no cap on `ids` (unbounded `ANY($1)`) and ignores `status` / `auto_status`, so
  "top rated" can show inactive or closed features. Cap the list (e.g. 50) and apply the same active filter as search.
- **Extras:** "services near me" downloads four whole layers (`service_all` + 3 real-estate, ≤ 2000 rows each) to find the 10
  closest; a `GET /api/nearest?x=&y=&types=&limit=` would make that one small request (same ask as the nearby search above).
- **Extras:** `/api/widgets-data` `road_status_updated_at` / `fuel_status_updated_at` are `MAX(updated_at)` over all rows of the
  layer, including inactive ones the list itself hides (`status = 0 AND auto_status = 0`), so the stamp can be newer than any row
  shown. Also `/api/top-rated-providers` never checks that the rated feature still exists / is active (the UI drops missing ones).
