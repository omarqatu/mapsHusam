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
- ✅ Server: serve `web/dist` in production (own commit, logged under "Server changes"). Design: legacy
  and React coexist until cut-over, so `server.js` serves `web/dist/index.html` only for the routes in
  `web/src/routes/routes.ts` that have been switched, and `web/dist/assets/*`; everything else stays legacy.
  Do it together with the first real page (Phase 1) so it can be verified end-to-end.

## Phase 1 — Simple pages (prove the foundation)

| Route | Legacy source | Status |
| --- | --- | --- |
| `/admin/users` | `admin-users.html` (+ `css/admin-users.css`) | ✅ (legacy kept until `web/dist` is served) |
| `/admin/users/:id/view` | `admin-view-user.html` | ✅ (legacy kept until `web/dist` is served) |
| `/admin/widgets` | `widgets-admin.html`, `js/widgets-config.js` | ✅ (legacy kept until `web/dist` is served) |
| `/admin/dashboard` | `dashboard.html` | ✅ (legacy kept until `web/dist` is served) |
| `/notifications` | `notifications-panel.html` (socket.io) | ✅ |
| `/widgets/portal`, `/widgets/ticker` | `widgets-portal.html`, `widgets-ticker.html`, `js/widgets-ticker.js`, `css/widgets-{portal,ticker}.css` (+ the ticker bar on the map and on `/search`) | ✅ (legacy kept until `web/dist` is served; `js/widgets-config.js` can go with it) |

### Admin pages — parity checklists (Phase 1, written before the code; ticked after verification)

All four pages: legacy guard = `map_user.role === 'admin'` else redirect; React = `RoleRoute roles={['admin']}`. Every `/api/admin/*`
call needs `Authorization: Bearer <admin token>` and the server re-checks role + `is_active` + `force_logout_flag` + `token_version`
on each request (`requireAdmin`). Errors come back as `{ success:false, error }`.

**`/admin/users`** — `admin-users.html`
- API: `GET /api/admin/users` → `{ users[], onlineUserIds[] (strings), total }`; user = `user_id, full_name, email, phone, role,
  is_active, status, service_layer, feature_id, x_coord, y_coord, created_at, request_limit, request_limit_period, is_online`
  (the server's `search` / `status_filter` / `role_filter` query params exist but legacy filters client-side; so do we).
  `GET /api/admin/online-users` → `{ onlineUserIds }` polled every 8 s (dots only). `POST /api/admin/users/update`
  `{ user_id, role?, is_active?, service_layer?, feature_id?, new_password?, request_limit?, request_limit_period? }` → `{ success, message }`
  (server: 400 when nothing to change, 404 unknown user, saving always notifies the user + emits `force_relogin`; role / active / password
  change bump `token_version` unless the admin edits himself). `POST /api/admin/users/force-logout { user_id }` → `{ message, wasOnline }`.
  `POST /api/admin/users/force-logout-all { target_type: all|online|offline|selected, user_ids? }` → `{ message, total, online, offline }`.
  `POST /api/admin/view-session { user_id }` → `{ token, expires_in, user }`.
- [x] Filters (client side): text (name / email / phone), role, active state, online, linked-to-service, created (2 days / week / month /
  exact day). [ ] Newest first. [ ] Count of shown users. [ ] "Refresh list".
- [x] Selection kept across filter changes; select-all acts on the visible rows only (tri-state); counter of all selected.
- [x] Bulk force-logout: all / online only / offline only / selected (confirm first; selection cleared after success).
- [x] Row: role badge, online dot, active badge, service layer, feature id, request quota (limit + period, or unlimited), created at.
- [x] Row actions: view read-only (new page), edit, activate / deactivate (confirm), force-logout (confirm, text differs online/offline).
- [x] Edit dialog: active, role, service layer (66 layers, none), feature id (only with a layer), request limit (empty = none) + period
  (enabled only with a limit), new password (>= 6, empty = keep). Sends the payload; success closes + reloads.
- Storage: none. Mobile: legacy is a 13-column table with sideways scroll.

- **Changed on purpose (users):**
  - One "User" cell (name, phone, email, id) and one "Service" cell (layer + feature id) instead of 13 columns; phone / email / id are all still shown. Status = active badge + online dot together. Below `md` every row is a card with the same cells and actions.
  - Native `confirm()` / `alert()` / the alert strip → confirm dialogs and toasts (5 s → 4 s / 8 s for errors). Success texts are translated locally; error texts are the server's.
  - The "view read-only" button opens the page in the same tab (`/admin/users/:id/view`, back button) instead of a new tab with the token in the URL — the token never appears in a URL any more.
  - The edit dialog sends only the fields that changed (legacy sent everything, so every save also notified the user and forced a re-login even when nothing changed) and says "nothing was changed" without a request. A new password shorter than 6 is now an error (legacy silently ignored it). Feature id / request limit are validated as whole numbers.
  - **Dropped: "force the user to change the password at next login".** The legacy checkbox was never sent and the server has no such field — it did nothing. See Backend asks.
  - Your own row can't be deactivated or force-logged-out (legacy let an admin lock himself out); editing yourself shows a warning; a bulk log-out that includes you says so.
  - Service-layer list = the map's `SERVICE_TYPES` (68 keys; legacy list had 68 — differences: none) with translated names, searchable.
  - Paging (25 per page) and sortable columns; "select all shown" applies to every filtered row (as legacy), the counter to all selected.
  - Online dots poll every 8 s only while the page is open and the tab visible.
- **Not live-tested on purpose:** bulk log-out targets `all` / `online` / `offline` (they would log out the seeded accounts and flag them); `selected` is tested on throwaway users.

**`/admin/users/:id/view`** — `admin-view-user.html`
- Legacy: opened in a new tab as `admin-view-user.html?token=<view token>` from `POST /api/admin/view-session`. Read-only, 30 min.
  `GET /api/admin/view-session/profile` → `{ user }`; `GET /api/admin/view-session/requests` → `{ requests[] }` (as requester or provider:
  `id, service_type, status, requester_name, provider_full_name, created_at …`); `GET .../requests/:id/messages` → `{ messages[] }`
  (`sender_role, message, created_at`; 403 if the request is not the viewed user's). These three take the VIEW token (401 when expired).
- [x] Read-only badge + expiry note. [ ] Profile: name, id, phone, email, role, active, service layer, feature id.
- [x] Requests list (type + #id, status, requester, provider, date); messages load on first expand, toggle hides.
- [x] Empty / error states ("invalid link" when there is no token → here: unknown user / failed session).

- **Changed on purpose (view):** the page creates its own 30-minute view session from `/admin/users/:id/view` (legacy needed a token in the URL from the users page), so the link works from bookmarks / history. Role and status are translated; messages / dates use the UI language. The view token is sent through `client.ts` with its own `Authorization` header; a 401 on it (expired) no longer ends the admin's session (`client.ts` change + test).

**`/admin/dashboard`** — `dashboard.html` (provider success stats)
- API: `GET /api/admin/provider-success-stats` → `{ stats[] }` (`id, username, provider_name, provider_phone, service_layer, service_type, status,
  contact_type, cancellation_reason, created_at, updated_at …`, newest first, no limit). `DELETE /api/admin/provider-success-stats/:id`.
- [x] Status mapping: completed/success → successful, cancelled/rejected → cancelled, anything else (accepted, pending) → pending.
- [x] Contact type: call / whatsapp / service request (default). [ ] Layer shown by its Arabic name.
- [x] Column filters: user (contains + exact), provider (contains + exact), layer, phone (contains), date (picker + typed dd/mm/yyyy,
  Arabic digits accepted), contact type, status, cancel reason (contains + exact). [ ] "Shown N of M". [ ] Reload.
- [x] Delete a record (confirm, irreversible). [ ] Shortcuts: send notification, live-info centre, users.

- **Changed on purpose (dashboard):** the header filter row is a labelled grid (a table header row cannot work on a phone); "contains" text + "exact" drop-downs for user / provider / reason are kept, the exact ones and phone / reason sit under "More filters". Four summary tiles (records in view, successful, pending, cancelled) are new. Layer names follow the UI language; contact-type emoji → icons; browser `alert` / `confirm` → toast / dialog. The three shortcut buttons are links (no new tab); "send notification" goes to `/notifications`, which for admins now has the send form (see below).
- **Redesign 2026-10-01** (user: the dashboard must work as a dashboard, not a long list). Order: the four totals, which
  are now the status filter (a tile shows only its status, "all records" clears it; they count the rows of every other
  filter, so picking one never zeroes the rest; the successful tile shows the success rate) → the last 14 days as
  stacked bars per status, and the five most requested providers and services (bar = rows, green = successful; a click
  filters the list to it) → one toolbar: a search box over user / provider / phone / reason, service, contact type, day,
  and "more filters" (the legacy contains / exact boxes and the typed day, with a count of the active ones) → the list.
  Rows: user over "to provider" and phone, service over contact type, date, status, reason (two lines), and a trash icon
  instead of a red "delete" button on every row. Phones: one compact card per row (user ← provider and status, service ·
  contact · date, reason). The three shortcut links went: the header's admin menu has them. Insights are computed in the
  browser from the same list (`model.ts`: `successRate`, `dailyCounts`, `topBy`, tested), no server change. Shared
  `DataTable` gained `table: false` (a column for the cards only). Verified at 1440 / 390, light and dark, no
  sideways scroll (the chart shows every other day label on phones).

**`/admin/widgets`** — `widgets-admin.html` + `js/widgets-config.js`
- API: `GET /api/admin/widgets-data` → `{ groups: { <key>: { data[], updated_at } } }`; `POST /api/admin/widgets-data/:key { items[] }` (keys:
  currency, gold, weather, fuel, transport_inter_city, transport_intra_city, events — else 400); `GET /api/widgets-data` (public) for the
  road / fuel "last update"; `GET /api/admin/road-fuel-features` → `{ roadBarriers[{id,name,stop,stop2,updated_at}], fuelStations[{id,name,diesel,banzen95,banzen98,updated_at}] }`
  (numbers, may be null); `POST /api/admin/update-road-barrier { id, stop?, stop2? }`, `update-fuel-station { id, diesel, banzen95, banzen98 }`,
  `bulk-update-road-barriers { ids, stop?, stop2? }`, `bulk-update-fuel-stations { ids, diesel?, banzen95?, banzen98? }`,
  `batch-update-road-barriers { items:[{id,stop?,stop2?}] }`, `batch-update-fuel-stations { items }` (one transaction), `reorder-features { layer, orderedIds }`.
  Values: road 0 open · 1 closed · 2 light jam · 3 heavy jam · 4 inspection; fuel 0 available · 1 unavailable.
- [x] 9 tabs: 7 editable groups (currency, gold, weather, fuel, transport between cities, transport in city, events) + roads + fuel stations.
- [x] Group tab: editable rows (id, label, value, unit / code / weather fields / event date + notes), add row, delete row, reorder rows,
  save (rows without id are dropped, empty fields omitted, values trimmed), "last update" stamp, refresh.
  Empty server group → the defaults of `js/widgets-config.js` (weather: three demo cities) are shown as the starting rows.
- [x] Roads tab: table (id, name, direction in / out select incl. "not set"), single-row save, save all (changed rows only, one
  transaction), unsaved-row highlight + count, bulk bar (checkboxes + select-all, in / out, confirm, "no change" keeps a direction),
  reorder + save order, last-update stamp, refresh (asks when unsaved).
- [x] Fuel tab: same with diesel / 95 / 98 availability.
- Storage: none. Legacy note: "add a checkpoint / station = use the map editing tool" (item 5, not here).
- **Changed on purpose (widgets):** 9 scrollable tabs (all panels stay mounted, so unsaved edits survive switching tabs; legacy re-rendered everything after each save and lost other tabs' edits). Rows are cards on phones. Reordering = drag handle (desktop, tables) **plus** move-up / move-down buttons everywhere (HTML5 drag & drop does not work on touch; group rows use the buttons only). Save-order is offered with an "unsaved order" badge. Road / fuel tables show a colour dot by direction; a station with a NULL fuel column shows "not set" instead of silently showing "available" (legacy) and saving keeps the NULL. Single-row saves patch the cached row (no full reload, other unsaved rows keep their edits). The saved group restarts from what the server stored; a row with data but no id is flagged (legacy dropped it silently). Unknown keys inside stored rows are kept (legacy dropped them on save). Defaults for a never-saved group are copied into `features/admin-widgets/model.ts` (`js/widgets-config.js` stays: `widgets-ticker.js` still loads it).
- **Live tests restore what they touch** (one group's rows, checkpoint / station values, manual order); afterwards only `updated_at` stamps and `display_order` (same visible order) differ.

- **Switch status:** routes are registered in `App.tsx` (`ported`) and verified against the real backend at 1440 px and 390 px (Arabic + English). The legacy `admin-users.html`, `admin-view-user.html`, `dashboard.html`, `widgets-admin.html` (+ `css/admin-users.css`) are **not deleted yet**: `server.js` still does not serve `web/dist` (Phase 0 item), so production would lose the pages, and `index.html` / other legacy pages link to them. Delete them in the commit that makes the server serve these routes. `js/widgets-config.js` must stay (ticker).
- Tests: `admin-users/model.test.ts`, `admin-dashboard/model.test.ts`, `admin-widgets/model.test.ts`, DataTable phone-cards + client 401 test, live `admin-users/admin.live.test.ts` and `admin-widgets/admin.live.test.ts` (throwaway users `LIVE-ADMIN-*`, removed from the dev DB through `web/src/test/liveDb.ts`).

### `/widgets/portal`, `/widgets/ticker` — inventory (read from `widgets-portal.html`, `widgets-ticker.html`, `js/widgets-ticker.js`, `js/widgets-config.js`, `server.js`)

Neither HTML file is a page: both are fragments that `widgets-ticker.js` injects. `widgets-ticker.html` = the ticker bar + an overlay modal;
`widgets-portal.html` = the ten cards, loaded into that modal (desktop) and cloned into a "معلومات حية" tab of `mobile-tabs.js` (phones).
The bar is the `<footer class="widgets-ticker-footer">` of `index.html` (the map) and `no-map-search.html`.

- API: `GET /api/widgets-data` (public, every 60 s while the tab is visible) → `{ success, groups: { <key>: { items[], updated_at } }, road_status_updated_at,
  fuel_status_updated_at }` (note: `items`, the admin endpoint says `data`); keys currency, gold, fuel, transport_inter_city, transport_intra_city,
  weather, events; a group nobody saved is absent. Row fields: `id, label, value, unit`, currency also `code`, weather `temp, humidity, wind, condition`,
  events `date, notes` — all free text (values like `28 - الحافلة 18.5` exist). `GET /api/search-features?layer=road_barriers|fuel_stations&workspace=services`
  (every 60 s) — already ported as `api/liveStatus.ts` + map `StatusTab`. **External, from the browser:** Open-Meteo forecast (11 West-Bank cities,
  3 days, every 30 min), Aladhan `timingsByCity` (Jerusalem, method 23 + tune, hourly) and Aladhan `gToH` (hijri date, daily). No storage keys, no socket.
- [x] 1 currency card: rows label + code + value, flag emoji by code, search by name. [x] 2 gold card: label + unit + value, medal emoji, search.
- [x] 3 weather card: per city, 3 days (today / tomorrow / day after) with icon by WMO code and max (day) / min (night) °C, search. The admin's `weather` group
  (`temp, humidity, wind, condition`) is fetched too but legacy lost it (it replaced the forecast objects that have no `days`, so the card showed empty rows until the next 30-min forecast).
- [x] 4 fuel prices card (95 / 98 / diesel / gas cylinders …, icon by id, search). [x] 5 fares between cities. [x] 6 fares inside the city (Al-Bireh). Both: bus icon, search.
- [x] 7 prayer times (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) + today's date; hard-coded fallback times when the API fails.
- [x] 8 calendar: hijri + gregorian date, "today", upcoming events from the `events` group (sorted by date, `label — notes`), hard-coded demo events when empty.
- [x] 9 road status card and [x] 10 fuel station status card: live lists (search, "last update") — **ported earlier** as `map/extras/StatusTab`, reused here.
- [x] "Last update" per card: relative (`now` under 10 min, else rounded to 5 min) from each group's `updated_at`; road / fuel from `*_status_updated_at`; prayer / calendar show today's date.
- [x] "Refresh all" button; per-card search boxes that ignore Arabic letter variants (`normalizeSearchText`); "no items yet" text for an empty group.
- [~] Ticker bar: title "تحديثات فورية", a marquee of the ten group shortcuts (icon + name, no values) — click = open the portal scrolled to that card; drag / wheel / touch scroll (replaced by pause on hover / focus / touch + a pause button, see below),
  auto-scroll pauses while the user interacts; expand button = open the portal. Footer links "مركز المعلومات الحية" (10 links, `data-widgets-card`) and the map's road / fuel buttons open the portal at a card (road / fuel done in item 10).
- [x] Mobile: the same ten cards as a tab (phones) instead of a modal. Role differences: none (public, no auth). Not used in legacy: the ticker's static
  currency / gold / weather / market items in `widgets-ticker.html` (overwritten by the ten shortcuts at start-up), `/api/currency|gold|weather|market|prayer|calendar` (do not exist on the server).

**Changed on purpose (widgets portal + ticker):**
- *Layout:* the modal (desktop) and the phone tab become one page, `/widgets/portal` (public, header link "معلومات حية" is back). Ten cards in three tabs — Prices (currency, gold,
  fuel, fares between cities, fares in the city), Today (weather, prayer, calendar + events), Roads & fuel (the two live status lists) — each card with its "last update" line under the title.
  Tabs mount when first opened and stay mounted (search boxes keep their text). `?card=<currency|gold|fuel|transport-inter|transport-intra|weather|prayer|calendar|road-status|fuel-status>` opens
  that card's tab and scrolls to it (the legacy footer links / ticker items / map buttons `openWidgetsPortalToCard`). The legacy modal's "close" button is gone (it is a page).
- *Lists:* six rows, then "show all (N)"; a card with more than six rows gets a search box (legacy: a box on every card, all rows always visible). Search ignores Arabic letter variants and needs every word, like legacy. Values are shown as typed by the admin (`28 - الحافلة 18.5`); units under the name. Currency flag emoji (blank letters on Windows) → a code tile (USD / EUR); medal / fuel emoji → icons.
- *No invented data:* legacy showed the defaults of `widgets-config.js` (sample prices) when the server had nothing, and hard-coded prayer times / demo events / a fixed hijri date while a request failed. Now an empty group says "nothing here yet", a failed prayer request says so with a retry, the hijri date is computed on the device (`Intl`, Umm al-Qura, same as Aladhan's `gToH` default — no request) and the Gregorian date is today's.
- *Weather:* the admin's weather rows (`temp / humidity / wind / condition`, on `/admin/widgets`) and the Open-Meteo forecast (11 cities, 3 days, every 30 min, day high / night low) are **merged** by city id — admin rows first with their "now" values, the other forecast cities after. Legacy overwrote one with the other (the admin rows had no `days`, so a saved weather group made the card empty for up to 30 min). If Open-Meteo is unreachable the saved rows still show, with a warning + retry. "Tomorrow / weekday name" replaces "بكرا / بعد بكرا"; WMO code → icon + text label (emoji → icons).
- *Prayer:* today's date comes from Palestine's clock (`Asia/Hebron`), the next prayer (sunrise excluded; after Isha → "Fajr, tomorrow") is highlighted and the card re-renders every minute.
- *Calendar:* events split into upcoming (with "in N days / today / tomorrow" badge) and past ones folded under "Past events (N)"; legacy listed all sorted by date, including years-old ones. `label — notes` is kept (notes under the date).
- *Status cards:* the map's `StatusTab` (ported in item 10) is reused inside a card: ten rows then "show all" (`initialCount`), its own search and refresh; the card header carries the stamp (`showUpdated={false}`). Tapping a row still shows it on the map (`/` needs a login: an anonymous visitor lands on the login page first, as everywhere).
- *Polling:* `GET /api/widgets-data` and the two status lists every 60 s, forecast 30 min, prayer 60 min — TanStack pauses intervals while the tab is hidden (legacy `createVisibilityAwareInterval`) and `refetchOnWindowFocus` catches up on return. "Refresh all" invalidates every widget query on screen.
- *"Last update":* same relative text as the status lists (`UpdatedAgo`, extracted from `StatusTab`: "just now" in green under 10 min, else rounded to 5 min, one unit instead of "1 hour and 5 minutes"). Prayer / weather-forecast cards show the fetch time; the calendar card shows the `events` stamp; legacy printed "today: <date>" there (the dates are in the card).
- *Ticker:* one slim line (40 px) at the **bottom** of the map and of `/search` — a row of the page, not an overlay, so the map, its tool buttons, sheets, coordinates and stats pill end above it (hidden on landscape phones, `max-height: 560px`; the title collapses to an icon under 640 px). Legacy items were ten group names that only opened the portal; now each item carries a value — exchange rates, first gold / fuel / fare rows, temperatures, the next prayer, the hijri date — plus the road / fuel-status links, all opening the portal at that card. CSS marquee (seamless loop, mirrored in RTL); pauses on hover, keyboard focus, touch and with a pause button; with "reduce motion" it is a static scrollable row. The legacy drag / wheel scrubbing is not kept. The duplicate copy of the loop is `aria-hidden` and out of the tab order. `/widgets/ticker` = the same bar large (for a shop screen) with a link to the portal.
- *Third-party requests* (Open-Meteo, Aladhan; legacy called them from the browser too) go through `api/external.ts` — no token, no cookies, no referrer — and are parsed defensively in `features/widgets/model.ts`. `eslint.config.js` lists the file next to `geoserver.ts` as an allowed `fetch` site. CSP `connectSrc` already allows any `https:`.
- *Shared UI touched:* `SectionCard` (`id`, `subtitle`), `Badge` (`large` = 14 px), `StatusTab` (`showUpdated`, `initialCount`; names 16 px, notes slate-600), `nav.widgets` renamed "معلومات حية / Live info".
- *Readability:* content ≥ 14 px, nothing under 12 px (audited in the browser on `/widgets/portal` and `/widgets/ticker`: no text under 14 px, no slate-400 text, no horizontal scroll at 390 px / 1440 px).

**Verified (real backend `:3000`, headless Chromium, 1440 px and 390 px, ar and en, logged out and as admin):** all ten cards render with real data (currency, gold, fuel, both fare lists of 17 and 106 rows, forecast for 11 cities, prayer times, calendar, 60+ checkpoint / station rows), deep link `?card=` opens the right tab and scrolls, the ticker on the map does not overlap tools / chips / stats pill / coordinates, `/search` shows the bar above its footer, RTL and LTR marquee both run. Tests: `widgets/model.test.ts`, `widgets/widgets.test.tsx` (mocked network: XSS text, show-all + search, deep link, weather merge, forecast down, lazy tabs, ticker links / pause / aria-hidden copy), live `widgets/widgets.live.test.ts` (public `/api/widgets-data` shape; admin saves the `events` group and the public read shows it — original rows restored in `afterAll`; Open-Meteo / Aladhan shape checks, skipped offline).
**Not verified:** the ticker on a real phone (only a 390 px viewport); Open-Meteo / Aladhan behaviour when they rate-limit; a user with a non-Palestine timezone (prayer "next" uses Palestine's clock by design); the marquee speed by feel (3 s per item, min 40 s).
**Not ported:** the legacy footer's "live info" link column (the ticker items / title link replace it); the 13 static ticker items of `widgets-ticker.html` and `/api/currency|gold|weather|market|prayer|calendar` (never existed server-side, overwritten at start-up); the drag / wheel scrubbing of the ticker.
**Legacy files** `widgets-portal.html`, `widgets-ticker.html`, `js/widgets-ticker.js`, `css/widgets-portal.css`, `css/widgets-ticker.css` are **not deleted**: `index.html`, `original-index.html` and `no-map-search.html` still load them and `server.js` does not serve `web/dist` yet. Delete them (and `js/widgets-config.js`, `widgets-admin.html`) in the commit that makes the server serve the React routes.

## Phase 2 — Search without map

| Route | Legacy source | Status |
| --- | --- | --- |
| `/search` | `no-map-search.html`, `js/no-map-search.js` (2.4k lines), `no-map-mobile.js`, `market-search.js`, `global-search.js`, `search.js` | ✅ (legacy files kept, see below) |

**Live data on `/search` and `/welcome` (UX changes):** the road / fuel pills show "updated 5 minutes ago" from `/api/widgets-data` (green dot only while the list was updated within a day, grey otherwise) and refetch at once when an admin saves (socket `status_updated`, logged-in users; visitors poll every minute). The section cards show the real number of listings (`GET /api/category-counts`) instead of the number of types, and the property tile's three kinds show theirs; nothing is shown until the numbers arrive. The featured / recommended / top-rated rows refetch when the tab is focused again after they went stale. `/welcome` shows the platform figures (providers, services, visits) from `/api/platform-stats`.

**Ratings as stars out of five, "today" strip, real numbers instead of promises (UX changes):** every rating on a card is now `★★★★☆ 4.5 (12)` (`RatingSummary` over `StarRating`, which fills fractions). Customer ratings were already out of 5; the hand-set `rating` column (10 = featured) is shown as `rating / 2` (`manualStars`), where the cards used to print "10" / "9.9" next to a single star. Under the search a quiet line shows the weather (Open-Meteo, Ramallah), the next prayer (Aladhan) and, from `GET /api/market-rates`, the dollar and dinar in shekels and gold 21k per gram, each chip opening the information centre at its card; a source that is down just drops its chip. The "world price" hint says these can differ from exchange shops. "Most wanted" became "Most listed": rent and sale, then the three service types with the most listings (`/api/category-counts`; `map_service_stats.service_type` holds event names such as `map_click`, not the searched type, so real demand cannot be read from it). "Service providers" (388) is relabelled "listings", because it counts every feature on the map, not provider accounts. The welcome cards say "106 properties listed now" / "71 trades" from the API (neutral wording until the numbers arrive) instead of "thousands of properties" / "50+ trades".
**No more typed-in prices that the world moves (UX change):** the currency and gold cards of the information centre (`/widgets/portal`, the ticker on `/search` and the map) are now the live market rows (`applyMarket` in `widgets/model.ts`, applied in `useWidgetsData`): USD / EUR / JOD in shekels, gold 24 / 21 / 18 per gram, gold and silver ounce; the card's "last update" is the moment our server fetched. The admin's rows for these two groups are only the fallback when the source is unreachable (a note on `/admin/widgets` says so). The dev database still held rows nobody had refreshed (dollar 2.99, gold ounce 2450 $ against 3.07 and about 4185 $ today), which is why the site showed two different dollar rates. Weather shows today's high and low ("27°/15°" — the live forecast; an admin-typed "now" is only used when there is no forecast) on the landing and in the ticker. Still hand-kept because no public source exists: fares, events, and the admin's weather "now" values (fallback only).
**Fuel prices are read, not typed (UX change):** the fuel card of the information centre shows petrol 95 / 98, diesel, kerosene and gas 5 / 12 / 48 kg from `GET /api/fuel-prices`; the admin's rows the source does not have (2.5 kg cylinder, gas delivered to buildings) stay below them. The visitor is told one thing about the live cards (currency, gold, fuel): when they were last updated — the moment the source itself published (rates once a day, gold live, fuel the date the source says it updated its prices), not where they come from or how often we read. `/admin/widgets` says which groups no longer need typing. All live prices are read again every 7 minutes (`LIVE_REFRESH_MS`) and when the tab comes back after that long; the server caches 6.5 min so each read reaches a fresh fetch; the information centre's "refresh all" button asks the server to read the sources at once (`?fresh=1`, honoured only when the cached copy is at least a minute old, so the sources cannot be hammered). Tested: `api/liveRefresh.test.tsx` (fake timers: a second and third fetch after 7 and 14 minutes, none before; "refresh all" sends `fresh`), `widgets/model.test.ts` (`applyFuel`, source timestamps), `lib/thefuelprice.test.js`, and by hand against the dev server: a 9-minute run where the server's `fetchedAt` advanced from 23:59:03 to 00:06:16 and the gold source's own time from 23:59:11 to 00:06:11, and `?fresh=1` returning a new read after 62 s but the cached one inside 60 s. Fares and events remain admin-typed.
Left as constants on purpose: the `rating` values 10 / 9.9 that mean featured / recommended (a business rule, see Backend asks) and the promo pictures.

**Map interface as frosted glass (UX change):** the top bar on the map, every control over the imagery (tool buttons, search pill and its suggestions, chips, coordinates), all panels and sheets (`MapSheet`: layers, search, extras, provider, results, feature card) and the live-updates strip are translucent glass: the surface token at ~56 % (panels ~70 %) with the map blurred behind (`backdrop-filter`), in both themes; browsers without `backdrop-filter` get a nearly solid surface. The map canvas reaches up under the top bar (`MapView bleedTop`) while everything laid over the map still measures from below the bar. This reverses the earlier "opaque on purpose" decision for controls over the map. The signed-in user's menu shows an avatar (first letter) beside the name and, in its card, role, phone, WhatsApp and email.

### `/search` — inventory (read from the legacy files + `server.js`; the map page's search code is reused, not copied)

**Legacy behaviour that exists (parity checklist — tick when verified in the browser):**

- [x] Route is public (no login). Session, when present, only adds the account menu / contact quota. Legacy showed a profile bar
      (name, role, dashboard, notifications, change password, logout) → now the shared `AppHeader`.
- [x] Group tabs (14: all + 13 groups: roads, fuel, real estate, technicians, health, vehicles, professional, events, misc,
      landmarks, commercial, education, jobs) and the category grid (3 real-estate layers + every service type, minus
      `globalExclusions`). A group with exactly one category opens it directly (roads, fuel, landmarks, education, jobs).
      `?group=<id>` deep link (footer links of the legacy map page use it) activates the tab.
- [x] Opening a category = search over the WHOLE layer at once (`GET /api/search-features?layer&workspace`, max 2000 rows),
      then filters narrow it; results sorted by `rating` (highest first). Back button returns to the categories.
- [x] Filters per category (legacy `searchFieldsConfig`): real estate = governorate, town, location, price (currency +
      ≥/≤ + number), area (≥/≤ + number); services = governorate, town, location, name; road barriers add checkpoint status in /
      out (fixed list); fuel stations add diesel / 95 / 98 availability (fixed list). Governorate → town → location/name cascade
      through `GET /api/get-unique-values` (`filter_gov_a`, `filter_village_a`). Every change re-runs the search (debounced 300 ms
      for typed values). "Reset" clears all filters. Result count line ("عدد النتائج").
- [x] Result cards. Services: type + `#id`, open/closed badge + working hours, name, location, fuel availability (fuel stations),
      average stars + count + expandable comments (`GET /api/service-ratings`), description, first picture, video (YouTube facade /
      `<video>` / link), details links 1 and 2, contact. Real estate: type + `#fid`, place, price + currency, area, town,
      governorate, description, media, contact. Road barriers: own card — in / out status pair, name, governorate, town, location,
      notes, media, no contact.
- [~] Contact buttons (buttons render and are hidden for road barriers / linked providers as on the map; the click flow is the map's `useContactActions`, covered by its tests — NOT clicked in the browser here): call (only when `phone`), WhatsApp (needs `whatsapp`), "request service" instead when the feature belongs to
      a registered provider (`GET /api/provider-linked-features`); 10 s per-feature cooldown (`click_cooldown_*` keys),
      quota check (`POST /api/check-request-limit`, fail-open), `POST /api/log-contact-click`, `POST /save-stat` (`source: quick_search`).
- [~] "Go to map" button on a card (a link to `/?x=&y=&z=19`; rendered, not followed in the browser) → map at the feature (`?x=&y=`), in a new tab in legacy.
- [~] Quota (the event is accepted by the real server — live test; the 429 path could not be produced locally): every executed category search is logged `POST /api/log-map-event` `event_type: no_map_search`,
      `source: quick_search` (the server files it under the quick-search statistics); 429 = message + no results. Fail-open otherwise.
- [x] Market-style keyword box (header of the legacy page, `market-search.js`): ≥ 2 letters, 400 ms debounce or Enter/button,
      `search_tags contains <text>` over services + the 3 real-estate layers, road-barrier status words ("closed", "crisis",
      "checkpoint") and fuel words ("diesel", "95") add status hits, de-duplicated, ranked type-name match → rating, first 50
      shown as the same cards as above. (Legacy also had a WFS/CQL fallback — removed on the map already, same here.)
- [x] Home sections (loaded on page open): featured (`rating = 10`, side + bottom "ad" columns), top rated
      (`GET /api/top-rated-providers` + batch fetch, services only), recommended (`rating = 9.9`, max 15), photos, videos,
      before/after (from rating 10 / 9.9 with media). Cards have the same contact buttons and "go to map".
- [x] Hero block: how-to text, platform statistics (`GET /api/platform-stats`), link to the interactive map.
- [x] "Road status" and "Fuel status" buttons open the live status lists (legacy: widgets portal at that card).
- [~] Page chrome (legal texts open from the footer — same `LegalLinks` as the login page; the widgets ticker bar is now above the footer, see the widgets item): top strip with guide / about / terms / privacy links (legal modals) and a Facebook contact link; footer with
      the same legal links, group links and live-info links; widgets ticker footer bar.
- [x] Mobile (`no-map-mobile.js`): filter box as a draggable bottom sheet, layout switches at three widths, scroll-to-results when the
      keyword box is used on a phone.

**Legacy did NOT have** (the task list asked for them): sorting other than rating, pagination (it rendered every row, up to the
2000-row server cap), print, share link, near-me / distance. See "Added" below.

**Result of the port (`web/src/features/search/`, route `/search`, public, inside `AppShell`):**

- URL is the state: `?q=` keyword · `?type=<key>` a type · `?resultsShare=` a type with filters (the map's own results-link
  format, `attribute` kind) · `?group=<id>` group tab (one-type groups open at once, so the legacy footer links keep working).
  Back button, reload and copy-link all work because nothing else holds the state.
- Category results = one request for the whole type + filters (like legacy), sorted client-side, 20 cards at a time.
- Cards are the map's `FeaturedCard` (media, status, price, contact, show-on-map), used for categories, keyword hits and the
  home sections, so both pages look and behave the same. Real customer ratings + comments load per visible card.

**Changed on purpose (better, documented):**

- One card layout for every type (road barriers included: in / out status badges, no contact) instead of three hand-made templates.
- Cards are paged: 20 at a time with "show more" (legacy rendered every row, up to 2000 cards). A notice appears when the
  server's 2000-row cap is hit.
- Filters are folded behind a "Filter results" button on phones (legacy: a draggable bottom sheet whose height the user had to
  set); always open from 768 px. Same fields, same instant apply (300 ms for typed numbers). The ≤ / ≥ picker sits above the number.
- Filter values for place / name now follow the chosen governorate / town on the server (`get-unique-values` cascade, as the
  map's smart search does) instead of the legacy client-side substring matching.
- Keyword results REPLACE the category browser while a word is typed (legacy showed them above it, pushing the page down);
  clearing the box brings the browser back. Keyword search now counts against the request quota (`global_search`, source
  `quick_search`) like the map's box — legacy's market box did not count. Visitors without an account send no quota events
  (the server has no quota for guests and the endpoint needs a login).
- **Landing redesigned (2026-09-30)** after the first React version was rejected by eye ("not liked at all"): a brand card
  (the header's gradient, rounded, follows the scroll) holds one joined search control (field · clear · search) and, from
  768 px, the two platform figures; the road / fuel status buttons are neutral pills with a live dot under it (was three
  coloured chips). Categories as in legacy: a line of group tabs (icon + name, the open one underlined) with the types of
  the open tab as uniform icon tiles; "all" shows 12 (property first) and unfolds; the type filter box searches every group.
- One compact **listing card** (`search/ListingCard.tsx`) for the whole landing — picture or type icon first, badge over it,
  name, place, price / open state, contact + map icon — instead of the map's text-heavy `FeaturedCard` and its boxed
  `SectionCard`s. Tapping the picture opens the shared viewer (`MediaViewer`, split out of `MediaGallery`).
- **Compact cards + preview (2026-09-30).** Result lists (type and keyword) use the same compact card as the landing
  (picture or section illustration, name, place, price / open state, contact, map icon; on phones a row with a thumbnail,
  four results per screen instead of one). Tapping a card opens its preview (`search/ListingPreview`, a bottom sheet on
  phones): every picture / video / link, description, real customer ratings with comments, contact with the number, show
  on the map — what the full card showed inline before. Contact and map buttons act without opening it. Media links are
  small chips app-wide (`MediaGallery`); the results toolbar keeps sort, copy / print as icons and a short "Map" link.
- **Featured (paid) placements, in context.** Side "ad" columns were tried (sticky, both sides) and removed on review:
  people skip page edges (banner blindness), they squeezed the page to 736 px at 1440, repeated the featured row and
  showed a restaurant to someone looking for a plumber. Instead: on a type's result list the featured listings (rating 10)
  *of that type and inside the chosen filters* lead the list — at most two, whatever the sort, shuffled per visit so equal
  advertisers take turns (`search/sort.ts` `pinFeatured`, `search/featuredOrder.ts`, tested). They and the landing's
  "featured" row wear the legacy orange frame, quieter (`map/extras/featuredStyle.ts`: warm border, ring, warm wash) and
  the "featured" badge. The landing's rows (featured, top rated, recommended, photos, videos, before / after) are headed
  rows of the same card; an empty row is not shown.
- **Landing, third pass (2026-09-30) — the one kept.** The user preferred the legacy page over both earlier React
  versions and asked for a polished ("boutique") UI. What legacy had and the port had dropped was *pictures*: the
  platform's own isometric illustrations (`web/public/promo`, also the welcome slideshow) are now the page's identity —
  a light centred hero (promise, big search, popular types, three platform figures) on a calm animated backdrop —
  dotted map grid, two drifting brand-colour fields, a few bobbing pins; no photo there, the user found it too heavy —
  the sections as a picture mosaic (property the big tile with rent / sale / land on it, eight
  illustrated sections as tiles, the rest as small icon cards; `search/art.ts` maps section → picture), a listing without
  photos shows its section's illustration softened behind its icon. Rows of cards scroll with arrow buttons on desktop
  (`ScrollRow`), cards rise in one after another (motion-safe only). A slim search bar slides in under the header once
  the hero's search leaves the screen (results pages: always there). Road / fuel status stay two quiet pills (a
  concept that put them first — live summaries on the page — was built and dropped: they are not the main need).
- Layout shift on load fixed: the shell's loading spinner fills the screen (the footer showed mid-page, then jumped:
  CLS 0.25–0.40); the hero figures keep their space while loading. Measured CLS now: 0.001 desktop, 0.000 phone.
- Scrollbars are thin and tinted from the tokens app-wide (`index.css`; the browser default was a heavy dark bar).
- Home sections (featured, top rated, recommended, photos, videos, before / after) are horizontal scroll rows with the map
  panel's data logic; the empty "advertising space" side columns and the bottom ad strip are gone, and so is the hero slideshow
  (decorative, always loading six photos). The intro, counters and map link stay.
- "Road status" / "Fuel station status" open the live lists in a dialog (the map's `StatusTab`) — legacy opened the widgets portal.
- YouTube videos load their player only when tapped (poster + play button) everywhere `MediaGallery` is used.
- Footer reduced to the guides / about / terms / privacy dialogs and the contact link (legacy: five link columns, three of them
  duplicating the group tabs and the widgets list).
- "Go to map" opens the map in the same tab (legacy: new tab) at the feature: `/?x=&y=&z=19`. The map needs a login; logged-out
  visitors land on the login page and come back to the map afterwards.
- Readability pass shared with the map: content ≥ 14 px, badges 14 px, no slate-400 text (placeholders and input icons
  darkened in `TextInput`; ratings, status lists and cards on both pages).

**Added (not in legacy, cheap because the map's code was reused):** sort (top rated, name, nearest-to-me with distance on the cards,
price low / high when one currency is chosen); print report (map's `printResults`); copy link; "show on the map" for the
current type + filters; category filter box inside the browser; distance sort uses one GPS fix (`locateOnce`).

**Decision — way back from the map to the same search:** the AppHeader "search" link stays a plain `/search` (a map view has no
equivalent list). Where the map HAS a query that a list can express — an attribute (smart) search — its results header now has an
"open as a list" icon linking to `/search?resultsShare=<same state>`, and the search page's "show on the map" link goes the other
way with the same state (`/?resultsShare=…`, replayed by the map's `ReplayShared`). Quick (map-area) and nearby searches are
geometry-bound and have no list form, so they get no link.

**Not ported / open:** the legacy footer's "live info" link column (replaced by the ticker bar, now on this page too);
the legacy files are NOT deleted: `index.html` and `original-index.html` still load `js/no-map-search.js` + `css/no-map-search.css`,
and every legacy page links `/no-map-search.html` while the server does not serve `web/dist` yet — delete `no-map-search.html`,
`js/no-map-search.js`, `js/no-map-mobile.js`, `js/market-search.js`, `css/no-map-search.css` together with the server switch.
Not verified: real contact clicks (call / WhatsApp / request service) from this page, the 429 quota message, print output.

**Reused from the map page (`web/src/features/map/…`, not duplicated):** `targets` / `config` (type catalogue, icons, names),
`search/model.ts` (fields per type, cascade rules, operators), `search/results.ts` (API row → `SearchResult`), `search/globalSearch.ts`
(keyword fetch + ranking + highlight), `search/nearby.ts` (distance), `search/printResults.ts`, `search/shareLink.ts`,
`search/ResultContact.tsx`, `popup/*` helpers (`featureModel`, `RatingsBlock`, `ContactButtons`, `useContactActions`),
`extras/*` (featured sections, status lists, statistics). Shared search quota moved to `web/src/lib/searchQuota.ts`.

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
5. ✅ Editing (admin): `edit-core.js`, `edit-wfs.js`, `editLines.js`, `editPolygons.js` → `features/map/edit/`

   **Inventory (read in full: the four `js/edit*.js` files, `index.html` #editPanel / #polygonEditPanel / #lineEditPanel + the three
   attribute modals, `js/main.js` panel wiring, `js/mobile-tabs.js`, and the `/geoserver-proxy` block of `server.js`).**
   - *Who:* the panels open only when `currentUserRole === 'admin'` (`main.js`: `display:block !important` for admins; the panel buttons
     exist for everybody but the panel never shows). No server check: `/geoserver-proxy` is public, so the only real gate is the
     **GeoServer login typed per save** (Basic auth, `btoa(user:pass)`, never stored). See Backend asks.
   - *Three panels, three tools each, same shape:* **add**, **modify (data + geometry)**, **delete**. Every tool is a toggle button that
     first calls `deactivate…()` (removes Draw/Modify/Snap/Select, closes the modal, resets the cursor), needs a layer chosen
     (points/polygons: `<select>`; lines: fixed) and adds a `Snap` on the layer's source.
   - *Points (`edit-core.js` + `edit-wfs.js`, workspace by layer):*
     - Layer list = every vector overlay except the excluded ones → **rent** (`ApartRent`), **sale** (`ApartSale`), and one entry per service
       type (≈ 68 `discriminator`s) that all write to the single table `services:service_all`.
     - Add: `Draw Point` → attribute modal → save. A new service gets `discriminator` set at `drawend` (mandatory).
     - Modify: `Select` (features of the chosen layer; for services ANY service feature — the real type is read from the clicked
       feature's `discriminator`) → modal → **alert** "click the map for the new position or wait" → next map click moves the point
       and saves, else after **4 s** it saves in place. (No Modify interaction for points.)
     - Delete: `Select` → `confirm()` → delete.
     - Fields (modal): real estate `name, price, currency(USD/ILS/JOD), des, pic, video, area, whatsapp, phone, end_date, work_hours
       (+ "24 h" button = "متوفر 24 ساعة"), rating 0-10`; services `name, whatsapp, phone, des, pic, video, rating 0-10,
       details_link_1/2, end_date, work_hours`. Extra selects: `road_barriers` → `stop` (in) and `stop2` (out), 0 open / 1 closed /
       2 light jam / 3 heavy jam / 4 inspection; `fuel_stations` → `diesel`, `banzen95`, `banzen98` (0 available / 1 not).
     - Computed on save: `search_tags` (services: Arabic type name + name + first 40 chars of `des` + a fixed keyword list per type;
       rent/sale: a fixed sentence); `x_coord`/`y_coord` (Palestine grid, 2 dp); rent/sale `X`/`Y`, services `x_global`/`y_global`
       (WGS84, 6 dp). Insert only: `start_date` = today, `status` 0, `auto_status` 0, `rating` 5 if empty; regional
       `gov_a`/`village_a` (and `location` for rent/sale) from the `Location` polygon that contains the point (read from the already
       loaded `locationLayer`; `'غير محدد'` when none); blank defaults `price`/`area` 0, `work_hours` "متوفر 24 ساعة", `name`
       "خدمة جديدة", `currency` first option.
     - WFS-T body: Insert in the **strict column order** of the layer (per-table list in the file), `rating` as `toFixed(1)`,
       geometry `gml:Point srsName=EPSG:28191` `x,y`; Update = allowed-properties only and **only non-empty values** (so a field can
       never be cleared) + `geom` + `x_coord/y_coord/X,Y|x_global,y_global` + `ogc:FeatureId fid="<typeName>.<n>"`; Delete by FeatureId.
       Feature id: `feature.getId()` → `fid` → `id`, last segment after `.`.
   - *Lines (`editLines.js`): one layer, `realestate:RoadsTest`, MultiLineString:* fields `name` (default "طريق جديد"), `road_type`
     (int), `one_way` (int, 0 both / 1 one way); Add = `Draw LineString` (cursor crosshair, modal after 250 ms); Modify = `Select` +
     `Modify` on the selected feature + modal; Delete = `confirm()`. On save `gov_a`/`village_a` from the `Location` polygon under the
     first vertex; insert sets `source`=0, `target`=0, `cost`=0 (pgRouting columns). Geometry sent as `MultiLineString` with
     `gml:posList`. Cancel in the modal removes the drawn line.
   - *Polygons (`editPolygons.js`): `realestate:LandSale` (Polygon) and `realestate:Location` (MultiPolygon):* fields land = `name, phone,
     price, currency, des, pic, video, area, whatsapp, end_date, work_hours, rating 0-5`; location = `gov_a, village_a, location`.
     Add/Modify = `Draw Polygon` / `Select` → modal ("continue to shape") → **shape phase** with a sub-toolbar: *move points*
     (`Modify`), *reshape* (a free `Draw LineString` that is never applied to the polygon — effectively a no-op), *new drawing*
     (removes the polygon, draws another, restores properties and id) and **final save**. Land: `search_tags` from the fixed land
     sentence + `des`; insert `start_date`/`status`/`auto_status`; regional fields from the `Location` polygon under the interior
     point; no coordinate columns. Rings are closed before sending; `gml:exterior`/`gml:interior`. Double-click-zoom is off while a
     polygon tool is active. Delete = SweetAlert confirm.
   - *Transport (all three):* `POST /geoserver-proxy/wfs` (`text/xml`, WFS 1.1.0 Transaction), two SweetAlert prompts (user, then
     password), "saving…" spinner, success = `res.ok` and no `Exception` in the text, then `source.refresh()` and deactivate.
     The proxy whitelists the `typeName` found in the XML (`ALLOWED_LAYERS`) and passes the body and `Authorization` through.
   - *Storage / sockets / API:* none (no `/api/*` call, no localStorage, no socket event). Mobile: the three panels are tabs of
     `mobile-tabs.js` ("📝 تحرير نقاط", "🗺️ تحرير مضلعات", "🛣️ تحرير خطوط").
   - *Legacy defects found while reading (fixed in the port, not copied):* update never clears a field (empty = skipped); real-estate
     `location` is always "غير محدد" (the auto-fill branch is unreachable for it); a cancelled/failed point insert leaves the sketched
     point in the layer; every failure closes the tool so the typed data is lost; polygon "reshape" does nothing; the regional
     look-up only works if the `Location` layer happened to be loaded in the view; the success test is a substring search for
     "Exception"; user-supplied text is interpolated into `innerHTML` in the modals (stored XSS) and every other page reads it.

   **Built (`web/src/features/map/edit/`):**
   - `schema.ts` (per-layer fields, insert column order, update columns — data) · `geometry.ts` (rounding, OL geometry → plain
     EPSG:28191 data, validation) · `attributes.ts` (form ↔ properties, validation, `search_tags`) · `regional.ts` (region look-up)
     · `buildTx.ts` (everything the legacy `sendWFS_T` decided: defaults, computed columns, allowed columns) · `tx.ts` (`FeatureTx`,
     `SaveResult`, `featureFid`) · `wfst.ts` (WFS 1.1.0 XML + response parser) · **`transport.ts` → `saveFeature(tx)`, the only file
     that knows WFS-T** (the UI builds a `FeatureTx`, awaits a `SaveResult`; switching to a server endpoint = change that one
     function, drop `tx.credentials` and `TRANSPORT_NEEDS_CREDENTIALS`) · `EditPanel.tsx` (Draw / Modify / Snap / Select) ·
     `AttributeDialog.tsx` · `CredentialsDialog.tsx` · `EditTool.tsx` (admin gate) · `editLayers.ts`.
   - The admin *Edit* button is in the map's tool column (admins only; the panel also refuses non-admins, closes if the session is
     lost). `MapTool` gained `'edit'`, so a tap on the map never opens a details card while editing.
   - The GeoServer login is typed in `CredentialsDialog`: two inputs in that component's state, handed to the one `saveFeature` call,
     password field emptied before the request starts; no store, storage, URL, log; never in the repo. `transport.ts` refuses to
     send without it, uses `credentials: 'omit'` and does not attach the app token. (`eslint.config.js` lets `transport.ts` call
     `fetch`, next to `client.ts` and `geoserver.ts`.)

   **UX changes (each recorded, functionality kept):**
   - One panel with three tabs (points / lines / polygons) instead of three panels + a select each; a phone shows only the hint and its
     buttons while a tool is active so the map stays visible (legacy panels covered it).
   - Real attribute form (labels, number/date inputs, inline errors, rating range) in the shared `Modal`; **Save** or **Move / Edit the
     shape** (both kinds of legacy flow in one dialog). Legacy: alert + "click within 4 s or it saves in place" for points — now the
     point is dragged (`Modify`) or the next tap moves it, then an explicit **Save**; lines get the same shape phase (legacy `Modify`
     was active behind the modal), polygons keep their shape phase (move points, draw again) — and can also be saved without it.
   - "Finish" and "Undo last point" buttons while drawing lines / polygons (legacy: double click only — impossible with a thumb).
   - The login dialog stays open on a wrong password or a refusal with the reason (legacy closed the tool and lost the edit); one dialog
     with both fields instead of two SweetAlert prompts; success / failure as toasts.
   - Notices when the chosen layer is switched off (with a "Show the layer" button) or too far out to show (real estate is drawn from
     1 m/px); Escape cancels the tool in progress; an abandoned move puts the point back.
   - The edit-only layers (roads `RoadsTest`, regions `Location`) are drawn only while their target is chosen (legacy: loaded but never
     visible unless the layer manager showed them).

   **Legacy defects fixed while porting:** updating can now clear a field (empty → NULL; `name` and `rating` are never blanked); real-estate
   `location` (and services `location_name`) is filled from the region; real-estate `phone` is no longer dropped on insert; a cancelled or
   failed insert leaves no ghost point (new shapes are drawn on an overlay, not in the data layer); the region look-up asks GeoServer for
   the polygon under the point instead of relying on the `Location` layer being loaded; success = a parsed `TransactionResponse` with
   ≥ 1 feature changed (legacy: no "Exception" substring, so a stale id "succeeded"); a `Location` MultiPolygon with several parts gets
   one `polygonMember` per polygon; the feature id must belong to the layer's table (`service_all.5` cannot delete a `LandSale` row);
   user text is only ever JSX text or an escaped XML value (legacy modals: `innerHTML` with `value="${…}"`); shapes are validated (finite,
   inside the grid box, line ≥ 2 distinct points, ring ≥ 3 corners, no area / self-intersection) before anything is sent.

   **Not ported:** *polygon "reshape"* (`tool-reshape`): it drew a free line that was never applied to the polygon (a no-op). "Move points"
   and "Draw again" cover what it promised; a real split/reshape needs its own design. No mobile tab bar entry is needed (one Edit
   button). Legacy files stay until Phase 4 (like the other ported map features).

   **Parity checklist (verified against the local GeoServer through the real UI, Playwright, desktop 1440 and phone 390):**
   - [x] Admin only: button absent for `user` / `provider`; panel closes if the role is lost (unit) — the write itself is gated by GeoServer's login.
   - [x] Points — rent (`ApartRent`): add → wrong password refused, nothing written → right password saves; modify data + move; delete (UI round trip, rows checked in Postgres, all removed).
   - [x] Points — sale and every service type share the same code path; service insert / update / clear / delete, `discriminator`, tags, both coordinate systems, road-barrier (`stop`, `stop2`) and fuel (`diesel`, `banzen95`, `banzen98`) fields (live test, real GeoServer; dialog shown for `fuel_stations`). Not clicked through the UI for each of the 68 types.
   - [x] Lines (`RoadsTest`): draw with finish button, form, insert (MultiLineString, region, `source`/`target`/`cost` = 0), shape edit view, delete.
   - [x] Polygons — land (`LandSale`): draw, form, shape phase, *draw again*, save, delete; regions (`Location`, Polygon wrapped to MultiPolygon): add, delete.
   - [x] Snap added on the layer's source in every tool and double-click zoom switched off while a tool is active (same helper as measure); wired and used in the browser runs, but snapping itself and the zoom restore were not asserted separately.
   - [x] Computed columns (`search_tags`, `x_coord`/`y_coord`, `X`/`Y`, `x_global`/`y_global`, `start_date`, `status`, `auto_status`, rating 5, `price`/`area` 0, work hours default, region) — unit + live read-back.
   - [x] Confirm before delete; cancel leaves the data and the geometry untouched (browser: a moved, unsaved point returns to its place).
   - [x] Layer refresh after a save; no storage keys, no socket, no `/api` call (as legacy).
   - [ ] **Not verifiable here:** the production GeoServer's own rules — its workspace namespace (`http://localhost/<ws>` is what legacy sent and what the local
     setup now uses), whether its `fid` sequences are visible to GeoServer (locally an insert into `ApartRent`/`LandSale` answers `ApartRent.null`; the port then
     just refreshes the layer), which GeoServer users may write, and the WFS-T body against the real production schema.

   **Local dev additions (`dev/geoserver-setup.sh`, still idempotent and local-only):** each workspace's namespace URI is set to
   `http://localhost/<workspace>` (a fresh local one is `http://<workspace>` and GeoServer then rejects the Transaction), and
   `RoadsTest.id`'s default is pointed at its owned sequence (`RoadsTest_id_seq`; the copy defaulted to another one, so GeoServer
   failed with "currval … not yet defined"). Live test: `cd web && VITE_LIVE_API=http://localhost:3000 VITE_GEOSERVER_DEV_PASSWORD=… npm test -- edit.live`
   (skipped without the password; it deletes everything it creates).
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
7. ✅ (browser walk done on desktop: request → live banner at the provider → accept → chat at the user; phone not walked end to end) Service requests & chat: `service-chat.js` (1.7k lines), `notifications.js`
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
   **Not ported / open:** `notifications-panel.html` (standalone page, route `/notifications` stays a placeholder: the bell list covers it; decision below); legacy `js/service-chat.js` and `js/notifications.js` are still loaded by the legacy pages and stay until the map page switch; layout-level mobile placement of the bell (item 9). Real-time socket flows between browsers: verified 2026-10-01 by `web/e2e/flows.spec.ts` (user, provider, admin, a second session of the same user).
8. ✅ Auth UI: `auth-core-functions.js`, `auth-app-events.js`, `auth-fetch.js`, `legal-content.js`
   **Parity checklist (from the legacy code).**
   - ✅ Promo splash → `/welcome` (pitch, 6 feature cards, "create account" / "log in", terms + privacy links).
   - ✅ Terms gate → first step of `/register`: terms list, "I agree" box, Facebook page link + "I liked it" box; the continue button stays disabled until both are ticked.
   - ✅ Register (`POST /api/auth/register`): name, WhatsApp prefix 970/972, local mobile `^05\d{8}$`, password. Sends `whatsapp_number = +<prefix><phone without 0>`, `email: ''`. Role is always `user` (server forces it). Account is created inactive: no session, toast "contact us on Facebook to activate", then `/login`.
   - ✅ Login (`POST /api/auth/login`): phone regex check, server error message shown, welcome toast, redirect to the page the user came from (`state.from`) or `/`. Session stays in `map_user` (shared with the legacy pages; `authStore.ts`).
   - ✅ Change password (`POST /api/auth/change-password`): current password required, new one at least 6 chars, server message on failure, rotated `X-New-Token` stored by `api/client.ts`. Opened from the key icon in `UserMenu`.
   - ✅ Session check on start (`verify-session`, fails open) with the legacy per-reason messages (force logout / inactive / not found). Was a single generic message before.
   - ✅ `auth-fetch.js` (Bearer header, `X-New-Token`, 401 handling) is `api/client.ts` since Phase 0.
   - ✅ Legal texts (`legal-content.js`): guide, search guide, provider guide, subscription guide, interactive-map guide, about, terms, privacy, contact → structured data (no HTML strings; first `features/legal/content.ts`, now `features/legal/texts/<key>.json`, see Phase 3 "Registry"), shown by `LegalDocView` in a dialog (`LegalModal`/`LegalLinks`) and as pages `/legal/:key`. The Arabic wording is unchanged.
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
9. ✅ Layout: `mobile-tabs.js`, `desktop-panels.js`, `resizable-panels.js`, `panel-controls.js`,
   `ui-collapse.js`, `viewport-guard.js`, `mobile-app-bridge.js` (**the bridge is not ported on purpose** — it was a `postMessage`
   contract for a native app shell that does not exist and was decided against, 2026-09-30; see PWA below and `docs/dev/mobile-app.md`)
   Covered by: draggable panels (`useDraggablePanel`), and now **minimise** — every `MapSheet` has a chevron that folds it to its
   header (state is per open panel, not saved). Panel *resizing* (`resizable-panels.js`) is deliberately not ported: panels size to
   their content, and a saved width would only fight the phone bottom sheet.
   *UX changes (2026-09-29):* the live-updates ticker on the map is a slim **glass** strip (68 % see-through, blurred, top corners rounded — `.glass-bar`) **glued to the bottom edge of the page**, over the map (coordinates sit above it). Its arrow sits at the start edge and points to the corner it folds into; folded, it is a small tab on that corner whose arrow points the other way to unfold it; the choice is remembered
   (`psm-ticker-hidden`). The "N providers / N services" pill at the bottom of the map is removed (the counts stay in the stats tab of the extras panel). `.glass` is more opaque (90 %, blur 10 px) for readability. `/search` now leads with property (three doors:
   rent, sale, land) and lists services below with round icons; the "all" view shows only the 13 group cards (a group opens its types under a one-line tab row), so the page is short. The old ad-space look is gone: the intro is a title and three compact doors, no big banner.
   *Polish pass (2026-09-29):* Arabic UI uses **Latin digits** everywhere (`intlLocale('ar')` = `ar-u-nu-latn`; before, counts were Arabic-Indic and prices Latin); date+time is formatted as two pieces, 24 h, so RTL cannot shuffle it; per-row delete on the dashboard is a soft-red button (`dangerSoft`), and the `danger`/ok buttons now darken on hover (they had no hover change); phone header shows a short brand name instead of a truncated one.
   *Shared footer (2026-09-29/30):* one `components/SiteFooter.tsx`, the legacy dark footer made compact: slate blue `#2c3e50` (`--color-footer*` tokens, same in both themes) with a brand-coloured top rule, brand + one line about the platform + round social icons (`SOCIAL` list in `SiteFooter.tsx`: an entry with an empty `url` is not shown — legacy WhatsApp / YouTube / LinkedIn buttons pointed at `#`, so only Facebook has an address for now), two link columns with underlined headings and small arrows (guides / the platform), copyright line with the year isolated LTR. Every link opens the legal dialog. It replaces the run-on row of links that only `/search` had and the bare links row of the welcome / login / register shell, and is part of `AppShell` (every regular page); the full-screen map has none.
   *Duplicates removed:* the map's "search without map" chip and the search page's "go to map" chip show on phones only (the header has both links from tablet width up); the ticker lost its second "open the information centre" button (its title already links there).
   *PWA (2026-09-30, replaces the native-app bridge):* the app is installable — `web/public/manifest.webmanifest`, icons
   (`public/icons/icon-{192,512,maskable-512}.png`, `apple-touch-icon.png`, source `public/icon.svg`), iOS meta tags in `index.html`,
   and `public/sw.js` (registered by `lib/pwa.ts`, production only). The worker caches nothing (live data) and only exists so the
   app installs and so system notifications work on Android, where `new Notification()` throws: `showSystemNotification()` uses
   `registration.showNotification()` and falls back to the constructor. Also fixes the old call, which passed `lang: t('app.lang')`
   (a key that does not exist → the literal string as the language) and an icon (`/favicon.ico`) that is not served. Server: no change
   (`web/dist` files are already served; the CSP allows same-origin workers and manifest). Verified in Chrome against the real
   server: worker active, manifest without errors, no console / CSP messages; unit test `lib/pwa.test.ts`. **Not verified:** install +
   notifications on a real Android phone and iPhone. **Limit:** notifications still only arrive while the app is open (socket.io) —
   Web Push is under "Backend asks".
10. ✅ Extras: `platform-stats.js`, `featured-services-portal.js`, the "road status" / "fuel status" buttons, widgets ticker on the map
   ✅ **Done here (`features/map/extras/`):** the featured-services portal, the road-status and fuel-status lists and the
   platform statistics. ✅ The widgets ticker strip (bottom of the map) + the full widgets portal are ported in Phase 1 (`features/widgets/`). ✅ **Legacy mobile "home" tab** (`mobile-tabs.js`: platform stats + road + fuel buttons) — on phones the same three are one tap away: the fuel / roads / featured chips under the search box and the extras button (stats tab). Anything else can open the panel with
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
   - Media (`MediaGallery`): a strip of thumbnails (pictures, YouTube, video files) that opens in a viewer with previous /
     next and arrow keys; nothing heavy loads until tapped (YouTube is its thumbnail, not an iframe — legacy embedded them
     all at once). The viewer's YouTube frame sets its own `referrerpolicy` because the server's `Referrer-Policy:
     no-referrer` makes YouTube refuse embeds (error 153), and always offers "open on YouTube" for videos whose owner
     disabled embedding. `youtubeId` also reads shorts / live / m. / music. links and `watch?feature=…&v=`. Other video
     sites (Facebook, TikTok…) cannot be embedded under the server's `frame-src` and stay links, now with their host shown.
   - Faster access, taken from the legacy screens: a chip row under the map's search box (fuel status, road status,
     featured, search without map) — legacy had them as four coloured buttons on top of the map, we had them two taps
     deep in the extras panel; an information menu in the shared top bar (about, how to join, service-provider account,
     user guide, terms, privacy, contact — legacy: the top links and footer of the search page, not reachable from
     the map or the other pages at all), also inside the phone menu.
   - Glass (`.glass` in `index.css`, iOS-26-like: translucent white, blur, light rim) only on small controls floating
     over the imagery — map tool buttons, the search pill, the coordinates bar, the chips. Not on panels, tables, forms
     or dialogs (contrast). Solid white when blur is unsupported or `prefers-reduced-transparency` is on.
   - Bottom of the map: only the two figures that matter — service providers and services — as a glass pill next to the
     coordinates (legacy: a bar of six counters incl. visits and users; those stay in the stats tab). Hidden on phones.
   - `/search`: the search box and three shortcuts (interactive map, road status, fuel status; legacy: the coloured header
     buttons) stay in view while scrolling (the top bar is sticky too); the hero shows providers and services only.
   - Layer panel: the 68 service types are the same 13 groups as the search page (the `group` of each registry entry, see "Registry"),
     collapsible, each with a tri-state box and a visible/total count (a filter opens the matching groups); the
     "no background" map is offered to admins only.
   - Requests: status labels lose their emoji (a coloured dot + text instead), "تم الاتفاق" has no ✅, the chat footer keeps
     "cancel request" on one line on phones, hint and date text raised to 14 / 12 px.
   - Performance: every page except the auth screens is its own chunk (the entry file went from 1,045 kB to 339 kB,
     ≈103 kB gzipped) — the login page no longer downloads OpenLayers, the admin pages or the search code.
   - Decision (login wall): the map still needs a login, as in legacy; a visitor on `/` lands on `/welcome` (log in /
     register / legal texts), not on a bare login form. `/search` and `/widgets/*` stay public.
   - **Design system** (user, 2026-09-30: "the style is not that good; make Husam's work organised and maintainable"): one
     token file (`index.css`): brand indigo darkened for AA contrast, semantic surfaces / lines / text / status / elevation,
     Cairo font (self-hosted), a real dark theme (header toggle, saved, no flash). All ~480 raw `slate-*`/`red-*`… classes were
     replaced by tokens with a codemod; ESLint now forbids raw palette classes; hex colours in components → tokens.
     Brand `#667eea` → `#4f46e5` (same family; white text on it now passes AA). See HOUSE-STYLE.md "Design system".
   - **Registry** (user request: make the map code maintainable — one source of truth for the service types): the
     service-type list was written five times (`config.ts` SERVICE_TYPES, the type → group table in `extras/featured.ts`, the
     Arabic search tags in `edit/searchTagData.ts` (two 68-line tables), the extra-columns switch in `edit/schema.ts`, and the
     locale keys). It is now ONE array, `features/map/registry/services.ts` (`SERVICE_REGISTRY`): per type `key`, `icon`,
     `group`, `tier?`, `editProfile?`, `tagName`, `tagKeywords` (+ derived `labelKey` = `services.<key>`). Everything else derives
     from it and keeps its old export name: `config.ts` (`SERVICE_TYPES`, `SERVICE_TYPE_BY_KEY`), `targets.ts` (`ALL_TARGETS`),
     `featured.ts` (`groupOf`, `groupedTargets`), `edit/attributes.ts` (search tags), `edit/schema.ts` (`serviceTarget`,
     `POINT_TARGETS`), the layer panel, the type filter and the category browser. Group ids/order live in `registry/types.ts`,
     their icons in `registry/groupIcons.ts` (was copied in `TypeFilter` and `categories.ts`), label keys through
     `serviceLabelKey()` / `groupLabelKey()` instead of ten template strings. `edit/searchTagData.ts` is deleted.
     `edit/schema.ts` defines each field once (`NAME`, `PHONE`, `RATING_10` …) and the layer lists pick from them (same order).
     `registry/registry.test.ts` fails when a type exists in one place but not another: registry vs `services.<key>` in ar and en
     (both directions), vs `ALLOWED_LAYERS` parsed read-only from `server.js` (exact set), every type in exactly one group,
     every group named + iconed, editor targets and search tags derived. Proof that nothing moved: a one-off golden dump of
     SERVICE_TYPES / tiers / groups / labels / icons / API mapping / every edit target (fields, insert/update columns) / search
     tag text taken from the previous commit compared equal against the registry-derived values (not kept as a test: a golden
     file would make adding a type a two-file change).
     Legal texts (`features/legal/content.ts`, 896 lines of Arabic inside TypeScript) moved to `features/legal/texts/<key>.json`
     (9 files, Arabic is the source), loaded lazily per document (`import.meta.glob`, `useLegalDoc`; the page shows a spinner
     for the moment it takes, the dialog opens when the text has arrived). `legal.content.test.ts` pins each document by
     sha256 + length (`texts.sha256.json`, measured on the old `content.ts`), so a wording change is deliberate and shows up
     in review. No rendering change.
     Duplication (jscpd, src, min 5 lines / 40 tokens, tests + locales ignored): 15 clones / 150 duplicated lines (0.66 %) →
     13 clones / 122 lines (0.55 %); the two TypeScript clones (`content.ts`, `schema.ts` fields) are gone, the rest are UI
     components (search result rows, dialogs) outside this change.
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
## Home (`/home`) — new page, no legacy counterpart

Brief (user, 2026-09-29): a real landing page for signed-in users in the spirit of the water platform's (greeting, "what
needs me", role-aware cards) — designed for this platform, not a copy of the old pages. Code: `web/src/features/home/`
(lazy chunk of ~15 KB; it does not pull OpenLayers). Data comes only from hooks that already existed (`useMyRequests`,
`useIncomingRequests`, `useProviderAccount`, `usePendingRatings`, `useNotifications`, `useAdminUsers`, `usePlatformStats`,
the local `useUnseen` marks) — **no new server endpoints**.

- ✅ Route `/home` inside `AppShell`, login required; a visitor is sent to `/welcome` (like the map). First item of the header
  navigation ("الرئيسية / Home"); the header brand links to it.
- ✅ Greeting (first name, part of the day, today's date in the UI language, role badge) and a search box → `/search?q=`
  (two-letter minimum like the search page, hint instead of an alert).
- ✅ "Needs you" panel, most urgent first, zero counts omitted: provider — new requests waiting for their answer, "your status is
  Unavailable" (hidden from map/search), frozen account; admin — inactive accounts awaiting review; everyone — requests with
  news, completed services to rate, requests I sent that wait for a reply, chats in progress, unread notifications. Empty
  state = "nothing is waiting for you"; loading = skeleton rows; a failed call keeps the other rows and offers Retry.
- ✅ Cards (icon chip, title, one line, live figure where one exists): interactive map (places), search without a map (service
  types), live info, my requests (open count, opens the requests dialog), provider only: manage my service (status figure;
  opens the provider panel on the map), notifications (unread), admin only: users (inactive count, else total), dashboard
  (visits), widgets admin. Slim platform row at the bottom (providers, services).
- ✅ After login / registration the app lands on `/home` unless a `from` redirect exists. Deep links keep working:
  `/?x=…&y=…` and share links go through `/welcome` → login and back to the same URL.

**Changed on purpose (home):**
- The **login → landing page changed from `/` (the map) to `/home`**; the map is one click away (card, nav, brand). Registration
  users are inactive until an admin activates them, so `/register` → `/login` is unchanged.
- **Bug fixed on the way:** the welcome page's "log in" / "register" buttons dropped the `from` redirect, so a deep link opened
  by a visitor (`/?x=…&y=…`) lost its coordinates after login. They now pass the state on (`WelcomePage.tsx`).
- "Inactive accounts" counts every account with `is_active = false`; the server cannot tell a fresh registration from an
  account an admin switched off, so the row may include the latter. The users page still filters precisely.
- `useAdminUsers(enabled)` got an `enabled` flag (the home page must not call the admin endpoint for non-admins);
  `openProviderPanel()` was extracted from the map's provider button so the home page can open the panel before navigating.
- Notification / request figures use the same cache entries as the header bell and the requests list, so numbers agree.

**Verified:** typecheck, lint, unit + component tests (`home.test.tsx`: user / provider / admin variants, empty state, failed
call, search), live tests against the real backend (`home.live.test.ts`); headless browser at 1440 and 390 px in light and dark,
Arabic and English, as the three seeded accounts (including a real request + a "busy" provider), login landing and deep-link
flows, provider card → panel on the map. **Not verified:** a real phone; the browser-notification permission prompt.

## Show & hide (`/admin/visibility`) — new page, replaces legacy `MAP_CONFIG.globalExclusions`

Husam's legacy work on `main` (q4/q6, merged 2026-09-30) hid almost every service layer by editing `globalExclusions` in
`config.js` (a code change per decision). Here it is an admin setting instead, stored with Husam's `platform_content` table
under the key `settings.visibility` = `{"hiddenLayers": [...], "hiddenSections": [...]}`.

- ✅ **Model** (`features/visibility/model.ts`): hidden layers are `targetKey`s (`rent` / `sale` / `land` / discriminators);
  sections are `ticker` (live strip on the map and /search), `featured`, `stats`, `requests`. Road status and fuel status have
  no switch of their own: they follow the `road_barriers` / `fuel_stations` layers. Unknown keys are dropped on read.
- ✅ **One rule, one place** (`features/visibility/store.ts`): admins see everything (they edit hidden layers); everyone else
  sees what is left on. `VisibilitySync` (App) loads the setting (`GET /api/platform-content/:key`, refreshed every 5 min and
  on focus) into a Zustand store; the last value is kept in `localStorage` `psm-visibility` so hidden layers do not flash in
  before the answer. Hooks: `useLayerFilter`, `useShownTargets`, `useSectionShown`, `useExcludedLayers`; plain code:
  `layerShownToViewer`, `hiddenOnMap`.
- ✅ **Where it applies**: `toResults` (every result list of the app — map search, global search, /search results, featured,
  near me) drops hidden types; the map does not draw them (`MapView` style + real-estate layers); layer panel, quick search,
  type picker, near-me filter and the /search group browser do not offer them (a group left empty disappears); the extras
  panel and its chips lose the roads / fuel / featured / stats tabs that are off (no tab left → no button); the ticker drops
  road / fuel items and the whole strip when `ticker` is off (the full `/widgets/ticker` page stays); the information centre
  drops the road / fuel cards and its status tab when both are hidden; platform figures are counted without hidden layers
  (`/api/platform-stats?excludedLayers=`) and disappear with `stats` off; with `requests` off a registered provider shows
  call / WhatsApp instead of "request service" ("My requests" stays, so earlier chats remain reachable).
- ✅ **Admin page**: sections as four checkboxes with a line each; layers by group (tri-state group box, count), a type filter,
  "real estate only" and "show all" presets; a draft until "save" (discard button); the layer panel on the map marks hidden
  types / groups "hidden" for the admin. UX: one page instead of editing `config.js`.
- Verified: unit tests (`visibility.test.ts`), real backend (`visibility.live.test.ts`: save as admin, read as visitor, 404
  for a missing key, a user is refused), browser: "real estate only" + ticker off → visitor map shows real estate only,
  only the "featured" chip, no ticker; admin map keeps everything with "hidden" badges.
- ✅ The /search landing: section tiles and their counts leave hidden types out (a section with none left goes; property
  alone is centred), "most listed" chips and the road / fuel links follow the layers, the hero figures follow `stats`, the
  featured rows follow `featured`, and the today strip (same live data as the ticker) follows `ticker`.
- Not done on purpose: the server does not filter hidden layers out of `/api/search-features` (the setting is presentation;
  the data is public on GeoServer anyway). See Backend asks if that should change.

### Husam's legacy changes on `main` (q1–q7, merged into this branch 2026-09-30) — to port

Server parts came in with the merge. The legacy UI changes are not in React yet:

- ✅ Real-estate-only mode (`globalExclusions`, `applyGlobalExclusionsToDom`) → the show & hide page above.
- ✅ `platform-stats?excludedLayers=` → sent from React (`useExcludedLayers`).
- ✅ Platform texts admin → `/admin/texts` (details below). Same rows as his page: `legal.<key>` / `legal.backup.<key>` =
  JSON `{title, html}`, so either editor reads what the other saved.
- ✅ Legal texts read the admin's replacement (`features/legal/overrides.ts`, `useLegalDoc` → `custom`), for the nine texts
  React has. His three extra keys: `noMapIntro` (the search page's intro line) and `promoFeatures` (the welcome page's
  feature cards) → ✅ editable as **interface texts** (below); `mapEntryChoice` (the post-login "map or search" choice
  screen: two buttons and a "trial version" note) → **not ported on purpose**: `/home` replaced that screen and it has no
  marketing copy to edit. His rows `legal.noMapIntro` / `legal.promoFeatures` are not read (different storage, see below).

### Husam's changes on `main`, 30 September (q1, q2, "for test", "TestFinal", "Testing", merged 2026-10-01)

Server parts came with the merge; the legacy files they touched (root pages, `js/`, `frontend-react/`) stay deleted here.

- ✅ **Admin read-only view** (q2, server): the three `/api/admin/view-session/*` reads now need the admin's own session
  (`requireAdmin`) **and** the view token in `X-Read-Only-View`, and the token must belong to the admin who created it.
  React (`api/adminUsers.ts`) sent the view token *instead of* the admin token; now it sends both. A 401 on these calls
  (expired view link) still does not log the admin out (`client.ts` treats `X-Read-Only-View` as own credentials).
  Verified: `admin.live.test.ts` against the merged server.
- ✅ **Currency for hotels / villas** (q1): `service_all.currency` (Server changes); the editor offers the currency box
  for the two types (insert order `price, area, currency` = GeoServer's); prices show the row's currency, a row saved
  before (no currency) still reads as dollars; `currencyCode` reads codes in any case, `$`, `₪`, `د.أ` and the Arabic
  names like his `currencyDisplayLabel`; the map's smart search and /search offer the currency box for them as for
  property. Supersedes "price in dollars only" below. Verified: `edit.live.test.ts` saves a hotel with `currency: ILS`
  through the real GeoServer and reads it back; `propertyServices.test.ts`, `registry.test.ts`.
- ✅ **Featured cards** (q1): every service card except road barriers and fuel stations shows the customers' real
  rating (average, count, "show comments" with name / stars / comment, or "no ratings yet") above the name, instead of
  the hand-set `rating` column; a "top rated" card keeps the average it already carries (no second request); property
  keeps the hand-set stars. `FeaturedCard` `customerRatings` is now on by default (`false` turns it off). Verified in the
  browser: featured tab → painter / decorator / supermarket cards show "no ratings yet", the top-rated plumber 4 (3).
- ✅ **YouTube in the card** (TestFinal): already how React works — `MediaGallery` shows a thumbnail with a play badge and
  opens the player in a dialog (bottom sheet on phones) with "open on YouTube"; nothing to change.
- ✅ **/search**: the currency box now shows for hotels / villas (with the currency work above); the area filter's
  crowding was a legacy layout problem (side ads) — React's filter grid already gives price its own wide cell.
- **Not ported:** the colour picker for text boxes in his texts editor (q2) — our editor draws boxes in the theme's
  colours on purpose (option A below; dark mode). `.service-property-currencies.json` (one record, read by no code on
  `main`) — dropped. `TEST_PLAN.md` (his manual QA plan) was used for the role tests below; it describes the legacy pages, so it now lives in `docs/archive/`.

### Admin "send a notification" (legacy notifications-panel.html, found missing 2026-10-01)

The legacy panel had a send form (this plan said it did not — wrong; Husam's TEST_PLAN §10 tests it). Ported onto
`/notifications` for admins (`SendNotificationCard`): target = one user (ID), online now, everyone, regular users,
providers, admins, or a hand-picked list (role filter, search by name / phone / ID, select shown / clear, count); kind
info / success / warning / error; title (255) and message required. It emits the existing `send_notification` socket
event (the server re-checks the admin role, saves rows for everyone and pushes to those online) and reports "delivered
live to N of M". UX: inline field errors instead of alerts; the picker is a checkbox list instead of coloured buttons.
Verified: `sendModel.test.ts`; `flows.spec.ts` scenario N (admin sends to the user's ID, the user's other browser shows
it at once); browser at 1440 / 390, no overflow.

#### `/admin/texts` — how HTML from data is shown (user decision 2026-09-30: option A, allow-list → React elements)

- `lib/richText.ts`: stored HTML is parsed by `DOMParser` (inert document) and walked into a small tree; only paragraphs,
  headings, bold / italic / underline, lists, quotes, line breaks, links through `safeUrl` (http(s), mailto, tel, in-app
  `/…`), direction, centring and "boxes" (a block with a background) survive. Scripts, handlers, forms, buttons and media
  go with their content; everything else is unwrapped. The tree is rendered as React elements (`components/RichText.tsx`)
  in the theme's look — no HTML string is ever handed to the DOM, so the no-`innerHTML` rule holds.
- The editor (`components/RichTextEditor.tsx`): a `contentEditable` surface drawn once from the tree, the browser's
  editing commands (bold, italic, underline, heading, paragraph, lists, centre, link, unlink, clear), paste goes through
  the allow-list first, and the text is read back by walking the live DOM through the same filter; the save is clean HTML
  (`richTreeToHtml`, text escaped). Title field, save / discard, save a backup / load the backup, back to the built-in
  text (confirmation). A text never edited opens as the built-in text converted to rich text (`legalDocToRich`).
- UX change (accepted with option A): the editor's colours and font sizes are not kept; boxes are drawn in the theme's
  colours (so dark mode works). Husam's saved texts show with their structure (boxes, headings, centring, bold, links).
- Verified: `lib/richText.test.tsx` (scripts, handlers, `javascript:` links, forms, media dropped; escaping; stable;
  every built-in text converts), `overrides.test.tsx` (the page shows a replacement, a script inside it is gone),
  `overrides.live.test.ts` (real server: save as admin, read as visitor, restore default, a user is refused); browser:
  select + bold, a new paragraph, a paste carrying `<img onerror>` / `<script>` / `javascript:` → saved without them,
  nothing ran on the admin or the visitor page, the visitor sees the edit.
- ✅ The admin menu of the new header has icons for `/admin/texts` and `/admin/visibility` (and `/admin/appearance`).
- **Fixed 2026-10-01: saving dropped the boxes and the centring.** The editor draws a box or centred text with classes,
  but reading it back only recognised inline styles, so the first save of an edited text turned every box into plain
  paragraphs and un-centred the headings on the public page. `renderRich` now also writes `data-box` / `data-center` /
  `data-block`, which the reader accepts; `richText.test.tsx` draws a tree in both looks and reads it back unchanged.
- **Redesign 2026-10-01** (user: the texts page shows "cards"). The texts are a list on the side, grouped (platform
  pages, guides, site texts) with an "edited" chip, a drop-down on phones; the open text is one sheet whose top bar
  (name, saved / unsaved state, discard, save) stays in view while scrolling. In the editor a box is a quiet block with a
  side rule, not a centred card (visitors still see cards). Backup and "back to the built-in text" sit in one row under
  the text, with the backup's date. Leaving a text with unsaved changes asks first (before, switching tabs lost them
  silently); a failed save no longer clears the "unsaved" state.
- ✅ Price and area for `hotels` and `villas_rent` (`service_all.price` / `.area`, added by `ensureServicePropertyColumns`):
  - **One rule:** registry `editProfile: 'propertyService'` on the two types; `hasPrice(target)` (`map/targets.ts`) is "property or
    priced like property" and every place that showed a price for property asks it (map card, map result list, /search
    cards, featured cards); `priceCurrencyDefault` = USD for a service.
  - **Editor:** the two types get a price and an area (`edit/schema.ts`, `insertColumns` end with `price, area` = GeoServer's
    column order, as in his `servicesSchemaOrder`). **Dropped: the currency box.** His form offered one but the column does not
    exist and the value was never saved (his own comment says so); the price label says "السعر ($)" instead and the price is
    shown in dollars everywhere. If a real currency is wanted it needs a column — see Backend asks.
  - **Search (map smart search and /search):** price ($) and area filters for the two types; the currency box only for property;
    the price sort is offered for them without picking a currency.
  - **Verified:** unit tests (`propertyServices.test.ts`, registry, popup); real GeoServer (`edit.live.test.ts`: a hotel saved
    with price 120.5 / area 300, read back through WFS, kept after an update, no `currency` property); browser: `/search?type=hotels`
    shows the filters and "120 دولار · 300 م²" on the card (dev data put back).
  - **Deploy step (production):** GeoServer keeps a table's columns from when the layer was published, so after the server has
    created `price` / `area` GeoServer must re-read `service_all` or the map will not return them and saving them fails:
    GeoServer admin → *Layers* → `service_all` → *Reload feature type* (or *Server Status* → *Reload*; REST: `POST /rest/reset`).
    Dev: `dev/geoserver-setup.sh` now does the reset. Check: WFS `DescribeFeatureType` for `services:service_all` lists `price` and `area`.
  - **Also fixed:** `edit.live.test.ts` did not log in as an admin, so the proxy lock (`X-App-Token`, "Server changes") would refuse
    its writes; it logs in now.
- ⬜ Featured: before/after via `details_link_1/2 notempty` query; hotel / villa cards with property details and live rating;
  empty sections hidden.
- ✅ Road-barrier icon = the worse of `stop` / `stop2` (`worstBarrierStatus`, order open < light < inspection < heavy < closed;
  the label on the map follows it; the card still shows both directions). Test: `map.test.ts`.
- ✅ Edit tool after a failed save: nothing to port — React never turned the tool off. A refused save (wrong GeoServer login,
  GeoServer exception, network) keeps the login dialog open with the reason; "cancel" returns to the form / shape step with the
  panel open and the mode still pressed. Verified in a browser against the real GeoServer (wrong password → message → cancel →
  form back, "add" still pressed).
- ✅ Weather off when its request fails: React shows nothing broken instead of switching a widget off — a city without data
  gets no ticker item and no chip, the card shows the error with a retry button, the next forecast is tried in 30 minutes.
  Test: `widgets/model.test.ts`.
- ✅ Register: the full privacy policy and terms are written in a box that scrolls (`legal/InlineLegal.tsx`, the admin's
  replacement if there is one) instead of four hand-written bullets (their locale strings are removed); the box takes keyboard
  focus. Test: `RegisterPage.test.tsx` (which now answers the legal-text requests separately from the register call).

#### Interface texts (`/admin/texts` → "نصوص الواجهة") — `settings.texts`

- The admin rewords a **whitelist** of interface lines (`features/text-overrides/model.ts` → `TEXT_GROUPS`: the search page's
  badge, headline, intro line and sections heading; the welcome page's title, tagline, intro, buttons, footer and the six
  feature cards), in Arabic and English. Plain text only, at most 400 characters; a line that has a `{{count}}` code must keep
  exactly it. Stored as one JSON value under `settings.texts` in `platform_content`: `{ar: {key: text}, en: {…}}`.
- Applied over the bundled locale files in i18next at runtime (`TextOverridesSync` in `App.tsx`): every `t('…')` shows it, no
  component changed; the last value is kept in `localStorage` `psm-text-overrides` so a returning visitor sees it at once.
  An empty box = the built-in text (shown as the placeholder). A key is added to the whitelist in code, never picked from the
  request. Dropped on read: unknown keys, empty or unchanged text, too long, wrong placeholders.
- Found by its test: i18next writes overrides into the locale objects it was given, so the imported JSON stopped being "the
  built-in text"; the built-ins are copied once at load (`structuredClone`).
- Verified: `textOverrides.test.ts` (rules, applying, restoring, interpolation, markup stays text), `textOverrides.live.test.ts`
  (real server: admin saves, visitor reads, a user is refused), browser: Arabic override shows on `/search`, English override on
  the English page, clearing restores the built-in wording.
- This is the seed of the generic "settings" module the architecture review recommends (see [`docs/dev/review-2026-09-30.md`](../dev/review-2026-09-30.md) §2).
- Reference: `docs/dev/text-sources.md` (from his branch).

## Top bar + appearance (`/admin/appearance`) — new page, mirrors the water platform's Admin → Appearance

- ✅ **Top bar redesign** (`components/AppHeader`, user 2026-09-30: "nicer, consistent, practical"; then "purple much
  lighter, dynamic with the theme colour"). *Changed on purpose:* brand mark + name; the pages are icon tabs in one
  segmented group (icons only between `md` and `lg` so the row never crowds); the admin pages fold into one "الإدارة"
  dropdown; bell, my requests, help and the account are one 40 px icon-button size (`components/headerStyles.ts`);
  language + light/dark moved into the help menu (set once, not bar-worthy; `ThemeSwitcher.tsx` removed); a visitor's
  "log in" is a filled button; phones: brand · bell · requests · account · ☰ (a sheet with page tiles, admin, preferences,
  information).
- ✅ **Header styles** (admin's choice, all in the brand colours): *soft* (default — a light brand wash), *gradient*
  (the old full-colour bar), *white*. On the map each style is a see-through glass variant.
- ✅ **Brand theme** (`features/brand-theme`): stored in `platform_content` key `brand_theme` as JSON
  `{primary, secondary, header}` — no server change. Only the brand tokens change (`--color-brand`, `-2`, `-hover`, `-fg`,
  `-light`, light and dark); shades are derived and pushed until white-on-fill ≥ 4.5:1 and brand text ≥ 4.5:1 on light and
  dark surfaces (`model.test.ts` checks yellow, lime, black and every preset). CSS is injected as `:root:root{…}` (outranks
  index.css in any load order), cached in `localStorage` and put on by `public/theme-init.js` before the first paint.
  The `theme-color` meta follows the brand. Reads a 404 (server older than `5ec3df9`) as "no theme saved".
- ✅ **Page** (admin only, in the admin dropdown): 8 presets + two colour pickers with hex input, three header-style cards
  (each a real mini bar), a preview card, derived shades with the contrast ratio. Every change previews live on the whole app
  for the admin only; "save and publish" reaches everyone (next query, ≤ 5 min for open tabs); leaving without saving drops
  the preview; "restore default" deletes the row. *Not ported from the water platform:* per-module themes, fonts, field and
  text colours, radius — this app has one module and a fixed type scale.
- Verified: real server (admin PUT teal → visitor sees teal header, buttons and search hero in light and dark, map glass;
  DELETE → default), screenshots desktop / tablet / phone, dark. Not yet: a real phone.

## Owner's nine requests (2026-10-04) — worked one at a time, each its own commit(s)

1. Provider adds several services, edits them, uploads pictures · 2. A properties screen, editable · 3. Ratings for properties and
services, with the publisher's rating · 4. A hidden layer shows nowhere, UI or API · 5. A proper platform name · 6. WhatsApp + phone
of the platform · 7. A time-limited service stays in search when unavailable (not when cancelled); an unavailable property does not ·
8. Visitors get a defined, limited set of features · 9. A run-and-test document.

- ⬜ **5 — platform name**: waiting for the owner to pick ONE of the three candidates (دليلك / وين / أمين). Nothing renamed yet.
- ✅ **6 — platform WhatsApp + phone** (web only, no server change): the admin types the two numbers on `/admin/texts` (card on top);
  they are stored in `platform_content` under `settings.contact` (`{"whatsapp","phone"}`, like `settings.visibility` — public read,
  admin write). Shown as a WhatsApp and a phone button in the footer (the footer's WhatsApp icon was an unclickable placeholder) and
  in the information menu of every page. An empty number hides only its own button; both empty = nothing shown. Local (`05…`) and
  international (`+970…`) numbers; `wa.me` gets the country code (970) added for local ones. No floating button: it collides with the
  map controls. Code: `features/contact/` (`model.ts` pure logic, `store.ts` query + save, `ContactSettingsCard.tsx`).
  Verified: unit (`contact.test.ts`), components (`ContactLinks.test.tsx`), real backend (`contact.live.test.ts`: admin saves, visitor
  reads, row removal, a normal user is refused).

## Phase 4 — Cut-over & cleanup

- 🟨 All routes verified on desktop + mobile width (served by the real server with its CSP: login, welcome, map, search, widgets, admin, notifications, 404; phone width verified per page during each port). Still to do by hand: a pass on a real phone, and on production after the deploy.
- ✅ Deleted legacy `*.html`, `js/`, `css/`, `ol/`, `proj4/`, `pic/`, `icons/`, `sounds/`, `original-index.html` (own commit — `git revert` brings them back). `node_modules/` and `dist/` were never tracked here.
- ✅ Removed the legacy static serving and allow-list from `server.js` (see Server changes).

### Quality gates — what runs where

| Check | Where | When |
| --- | --- | --- |
| root `npm ci` + `node --check server.js`; `npm run typecheck`, `npm run lint` (incl. `jsx-a11y` + the design-token rule), `npm test`, `npm run build` in `web/` | `.github/workflows/ci.yml`, `ubuntu-latest`, Node 22, npm cache | every pull request and every push to a branch other than `main` |
| the same server + web checks, then staged deployment, restart smoke test, and automatic rollback on failure | `.github/workflows/deploy.yml`, self-hosted Windows runner — **all installs and builds finish before production is touched** | every push to `main`; deployments are serialized and the previous release is retained as `mapsHusam.__previous` |
| `npm audit --omit=dev --audit-level=high` in `web/` and in the repo root | `ci.yml`, job `audit`, `continue-on-error` (report only) | same as CI |
| `npm run e2e` (Playwright, `web/e2e/`, desktop 1440 + phone 390, Arabic) | **your machine only** — it needs the dev Postgres, the seeded accounts, the local GeoServer and the backend on :3000 | before merging anything that touches a page; not in CI (see `dev/README.md` → Browser tests) |

- Browser specs (all read-only — any write to `/api` is answered by the test harness, never by the server): visitor on `/`
  lands on `/welcome`; login through the form lands on `/home` (greeting + search box that continues on `/search`); the map (`/`) loads with markers and no console errors; a provider found in the
  search box opens its card with a contact / request button; the layers panel hides a whole group; keyword search on
  `/search`; `/widgets/portal` price cards; admin sees `/admin/users`, a normal user gets the forbidden page; the theme toggle
  (dark and back); no horizontal overflow on every route.
- `eslint-plugin-jsx-a11y` (recommended) is on for all of `web/src`. Fixed for real: `Modal` (click-outside moved to a decorative
  layer behind the dialog) and `DataTable` (a clickable row is reachable with Tab + Enter). Disabled on the line, with the
  reason next to it: ARIA combobox options (`SelectInput`, `GlobalSearchBox` — focus stays on the input by design), the owner
  video without a caption track (`MediaGallery`), `autoFocus` in the two dialogs that a click just opened.
  `eslint-plugin-jsx-a11y` lists ESLint ≤ 9 as a peer; `web/package.json` → `overrides` maps its peer to our ESLint 10 (lint runs
  clean on it; drop the override when the plugin publishes support).
- Not covered yet: nothing enforces a passing CI run before merge — turn on branch protection (require the `CI / Web` check) on
  GitHub to make it binding (a repository setting, not code).

## Definition of done (every page / feature)

- Parity checklist below is complete and every item works against the real backend.
- Ar (RTL) + En (LTR), desktop + mobile width (375px), keyboard reachable.
- Loading, empty and error states for every query; mutations disable their button while pending.
- `npm run typecheck && npm run lint && npm test` green (CI runs them, and so does the deploy); `npm run e2e` green on the
  dev stack when the page is reachable from a spec (add a spec in `web/e2e/` for every new route — at least "it opens and
  does not overflow", which `layout.spec.ts` covers by listing the route); at least one test per page (render + main
  action with a mocked API).
- No `console.log`, no hard-coded UI text, no `any` without a comment.

## Security baseline (frontend — applies to every page)

- Render user content via JSX only; no `innerHTML`, no `eval`/`new Function`, no inline `<script>`.
  URLs from data (links, images) go through a `safeUrl()` helper (http/https/relative only) — `lib/richText.ts`.
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

- ✅ **Login wall before the map — decided 2026-09-30: the map is public.** Legacy showed the map only after login; the
  WFS data is public on GeoServer anyway, so the wall protected nothing. `/` is `access: 'public'` and outside
  `ProtectedRoute` (`App.tsx`). Visitors browse, search, call and WhatsApp; the contact quota check and the click log
  (`/api/check-request-limit`, `/api/log-contact-click`, both `requireAuth`) are skipped for them, like the search quota
  already was. "Request service" sends a visitor to `/login` and back to the same map URL; chat, requests and the provider
  panel need a session as before. `/home` still sends visitors to `/welcome`. Header login link no longer wraps on phones.

## Server changes (allowed: functionality-preserving improvements, one commit each)

Rule: URLs, methods, auth rules and response shapes stay identical; legacy pages keep working.
Log each change here: **what · why · how to verify · commit**.

- **`POST /api/update-service-status`: cast `x_coord`/`y_coord` to `float8`.** The same `$2`/`$3` were used as column values and as
  `ST_MakePoint` arguments; PostgreSQL deduced conflicting types (numeric vs double) and the update failed with 500 "فشل تحديث قاعدة
  البيانات الخلفية" whenever a provider sent coordinates. Response and request unchanged. Verify: `web/src/features/map/provider/provider.live.test.ts`
  (moves the point and reads it back). Commit: `fix(server): cast provider coords to float8…`.

- **Serve the React app (`web/dist`) — Phase 4.** When `web/dist/index.html` exists the server serves it: `/assets/*` (hashed
  names, cached a year), the other built files (icons, sounds; an hour), and every path without a file extension except `/api`,
  `/geoserver-proxy`, `/socket.io` gets `index.html` (`no-cache`) so React Router handles it. The old pages redirect (301, query
  kept) to their new routes: `index.html`→`/`, `no-map-search.html`→`/search`, `widgets-portal.html`→`/widgets/portal`,
  `widgets-ticker.html`→`/widgets/ticker`, `notifications-panel.html`→`/notifications`, `admin-users.html`→`/admin/users`,
  `admin-view-user.html`→`/admin/users` (it used a token in the URL), `dashboard.html`→`/admin/dashboard`,
  `widgets-admin.html`→`/admin/widgets`. Later, in the commit that deleted the legacy frontend, the project root stopped being served as static files (the
  allow-list and forbidden-path middleware went with it): only `web/dist` is public now, so `README.md`, `SECURITY.md`, `package.json`
  etc. are no longer downloadable (they were, from Node; IIS blocked some). Without `web/dist`, or with `SERVE_REACT_APP=off`,
  every non-API path answers 503 with a plain message and the API keeps working. API routes, the proxy and socket.io are untouched.
  `web.config`: the static-file, dashboard and SPA-fallback rules are replaced by one rule that forwards everything else to Node
  (IIS no longer serves site files itself; the React build lives in `web/dist`, read by Node).
  Verify: `cd web && npm run build`, start the server, `curl -I localhost:3000/search` (200 html), `/no-map-search.html?group=fuel`
  (301 → `/search?group=fuel`), `/assets/<hash>.js` (200), `/api/nope` (404 JSON); log "🆕 يُقدَّم تطبيق React". Checked in a
  browser against the real server (helmet CSP on): no CSP violations on login, map, search, widgets, admin, notifications.
  The deploy workflow builds `web/` after the copy (see `.github/workflows/deploy.yml`).

- **`/geoserver-proxy`: writes need an admin.** Any method other than `GET`/`HEAD`/`OPTIONS` (a WFS-T transaction) is refused
  with 403 unless the request carries a valid session token of an active admin in `X-App-Token` (the `Authorization` header holds
  the GeoServer Basic login, so it cannot carry the app token); the server removes `X-App-Token` before forwarding. Why: the GeoServer
  login was the only gate, and that account is in the leaked repo history — anyone could write. Parity: the legacy UI let only admins
  edit (`config.js` → `rolePermissions.admin.canEdit`; provider and user `false`; providers move their point through
  `/api/update-service-status`, not the proxy). The editor (`features/map/edit/transport.ts`) sends the header. Verify: POST to
  `/geoserver-proxy/wfs` with no token or a user's token → 403, with an admin's → forwarded; reads (`GET`) unchanged. Server-side WFS-T
  (Backend asks) is still the full fix. Commit: `fix(server): only admins may write through the GeoServer proxy`.

- **`/api/search-features?ignore_status=1` is honoured for admins only.** For anyone else the flag is ignored and the usual
  `status = 0 AND auto_status = 0` filter applies (nothing in the legacy or React frontend sends it). Why: anyone could list inactive /
  expired records. Verify (dev): `ApartRent` with the flag → 49 rows as visitor or user, 53 as admin. Commit:
  `fix(server): ignore_status only for admins`.

- **"Last update" times read in the database's zone.** `widgets_manual_groups.updated_at` and the road / fuel `updated_at` are
  `TIMESTAMP` filled by `NOW()` (the DB session zone) but `node-postgres` read them as Node's local time, so every stamp was off by the
  zone difference (3 h in dev). The widget queries now select `updated_at AT TIME ZONE current_setting('TimeZone')` (a
  `timestamptz`), so the JSON carries the true instant; same field names and ISO format. No schema change. Verify: save a widget group,
  `GET /api/widgets-data` → `updated_at` equals the save time (dev: 3 h later than before the fix). Commit:
  `fix(server): read widget timestamps in the database time zone`.

- **Sessions expire after 30 idle days and renew while used.** Login / password change sign the token with `exp`
  (`SESSION_TTL_DAYS`, default 30); `requireAuth` answers with `X-New-Token` (which both frontends already store) when fewer than
  7 days are left or the token has no `exp` (tokens issued before this change keep working and are upgraded on their next request).
  `requireAuth` / `requireAdmin` no longer pass `ignoreExpiration`. An active user never sees a logout; a token left on an abandoned
  device dies by itself. Instant revocation is unchanged (`token_version` / `is_active` / `force_logout_flag`). Verify: token
  without `exp` → 200 + `X-New-Token`; fresh token → 200, no header; token 1 day from expiry → renewed; expired → 401 `TOKEN_INVALID`.
  Commit: `feat(server): session tokens expire after 30 idle days, renewed while in use`.

- **New public `GET /api/category-counts` (additive; no existing route changes).** Visible listings per type
  (`{ success, data: { counts: { ApartRent, ApartSale, LandSale, <service discriminator>: n } } }`), counted with the same
  `status = 0 AND auto_status = 0` filter the search applies, cached 60 s in memory like `/api/platform-stats`. Why: the section
  cards on `/search` showed the number of *types* in a section, which says nothing to a visitor; they now show real listings.
  Verify: `web/src/features/search/liveUpdates.live.test.ts` (the counts equal what the search returns for `plumber` and
  `ApartRent`). Commit: `feat(server): public listing counts per type`.

- **Socket push when an admin changes live data (additive events).** `broadcastLiveUpdate()` emits `status_updated { layer }`
  after each road-barrier / fuel-station write (`update-road-barrier`, `bulk-`, `batch-`, `update-fuel-station`, `bulk-`, `batch-`) and
  `widgets_updated { group }` after `POST /api/admin/widgets-data/:groupKey`. Payloads carry no data — the client refetches. Only
  authenticated sockets exist (the server rejects a connection without a token), so logged-in users see the change at once and
  visitors keep the one-minute poll. Verify: same live test (an admin save arrives on a connected socket; a token-less socket is
  refused). Commit: `feat(server): push status/widgets updates over the socket`.

- **New public `GET /api/market-rates` (additive): world exchange rates, gold and silver, fetched and cached by the server.** Sources
  `open.er-api.com` (USD base → ILS / JOD / EUR; published once a day) and `api.gold-api.com` (XAU / XAG in USD per ounce, live;
  → shekels per gram, 21k = 24k × 21/24, 18k = × 18/24), no keys, `fetch` with an 8 s timeout, cached 6.5 min (the app reads every 7 min, so each read reaches a fresh fetch; a partial answer
  1 min, then retried; a part that failed keeps its last good value; every source down and nothing cached → 502). Cross-checked on
  2026-09-29 against Frankfurter (ECB), fawazahmed0 currency-api and exchangerate-api v4: USD/ILS 3.056–3.074 in all four; gold
  4129–4185 $/oz in the two that have it. Why on the server: the visitor's address is not sent to third parties, no per-browser
  rate limits, the CSP stays as is. Response: `{ success, data: { rates: { USD_ILS, JOD_ILS, EUR_ILS, asOf } | null, gold: {
  usdPerOunce, ilsPerGram24, ilsPerGram21, ilsPerGram18, asOf } | null, silver: { usdPerOunce, asOf } | null, updatedAt } }`.
  Verify: `web/src/features/search/liveUpdates.live.test.ts` (shape, gold in the thousands of dollars, silver far below it, 21k =
  0.875 × 24k; tolerates a 502 when the sources are unreachable). Commit: `feat(server): cached world rates, gold and silver`.

- **`GET /api/platform-content/:key` (new, public).** One row of `platform_content` by key (`{success, item}`; a key nobody
  saved yet answers `item: null` with 200 — every visitor asks for `settings.visibility`, and a 404 would log a browser error
  on every page). Why: the list endpoint returns every platform text (~140 KB) and the React app needs one small setting
  (`settings.visibility`) on every load. Nothing existing changes. Verify: `curl /api/platform-content/settings.visibility`
  → `item: null` before the first save, the item after; `visibility.live.test.ts`. Commit: `feat(server): GET /api/platform-content/:key …`.

- **New public `GET /api/fuel-prices` (additive): Palestinian retail fuel prices, read from thefuelprice.com by the server.** There is
  no API for them, so the server reads the public page `https://www.thefuelprice.com/Fps/ar` (allowed by its `robots.txt`; we identify
  ourselves with a `User-Agent`, and cache 6.5 min so it is never asked more often than that; `?fresh=1` skips the cache only when it is at least 60 s old — `/api/market-rates` has the same flag). The parser is `lib/thefuelprice.js`
  (unit-tested against a saved copy of the real page: `npm test` in the repo root → `node --test lib/*.test.js`). It trusts nothing:
  unknown rows are ignored, each price must sit in a plausible range (litre 3–30 ₪, cylinders per size), and a page with fewer than four
  recognised rows counts as "the site changed" — then the last good prices are kept (or 502 when there are none, and the app shows the
  admin's rows). Response: `{ success, data: { items: [{ key, value, previous, unit: 'liter'|'cylinder', effectiveFrom }],
  sourceUpdatedOn, source, fetchedAt } }` for petrol 95 / 98, diesel, kerosene and gas 5 / 12 / 48 kg. Risk: a scraped page can change or
  disappear; the checks above make that fail safe, not silent-wrong. Verify: `lib/thefuelprice.test.js`, `web/src/features/search/liveUpdates.live.test.ts`.
  Commit: `feat(server): fuel prices read from thefuelprice.com`.

- **`GET /api/search-features`: `conditions_count` is capped at 30.** The condition loop is synchronous and the count came straight
  from the query string: `conditions_count=300000000` from any visitor froze the whole Node process (health check timed out for
  50 s+, sockets and every other request with it). Real use is a handful of conditions (filter fields, currency, smart-search
  chips), so 30 leaves room; response shape and behaviour below the cap are unchanged. Verify: with the fix the same request
  answers in ~17 ms and `/healthz` stays up; `web/src/features/search/search.live.test.ts` (huge count → 200 in < 5 s, health
  check up). Found by the 2026-09-30 review ([`docs/dev/review-2026-09-30.md`](../dev/review-2026-09-30.md) B1).
  Commit: `fix(server): cap the search condition count`.
- **`/geoserver-proxy`: the layer allow-list can no longer be side-stepped.** The check only looked at `typeName`, `typename`, `layers`,
  `LAYERS`, `TYPENAME`; GeoServer reads query keys case-insensitively and accepts more, so `TypeName=`, `typeNames=` (WFS 2.0),
  `layer=`, `query_layers=` and `featureID=<layer>.<id>` reached layers outside `ALLOWED_LAYERS`. Now every query key is compared
  lowercase against that set (array values and `ns:layer` prefixes handled), and any `sld*` parameter is refused. Verified against the
  real server: each variant above → 403, an allowed layer → passes the guard (404 is GeoServer's own). Commit:
  `fix(server): close the proxy layer allow-list bypass`.
- **`POST /save-stat`: the body's `user_id` is no longer trusted.** The endpoint is public and took `user_id` from the body, so anyone
  could burn another user's request quota or forge their dashboard counters. A valid session token now decides the identity; without
  one the row is stored as `guest` (or the client's own `guest-…` id) and no quota applies. Same request/response shape; the React
  client already sends the token and only posts when logged in. Verified on the real server: body `user_id:"1"` without token →
  stored as `guest`. Commit: `fix(server): /save-stat takes the identity from the session, not the body`.
- **Contact clicks and ratings can no longer be farmed.** `POST /api/log-contact-click` inserted a `completed` request for any
  `service_layer` string (no `isValidLayer` check) on every click, and each such row was one more chance to rate the same business.
  Now: the layer must be in `ALLOWED_LAYERS` and `feature_id` an integer; repeats of the same user+layer+feature+type within 10
  minutes return the existing row; `POST /api/service-requests/:id/rate` refuses a second rating from the same user for the same
  business (`service_layer` + `feature_id`), not just for the same request. Indexes added on `service_requests` (user, provider+status,
  layer+feature). Behaviour kept: contacting still lets the user rate afterwards (real-estate has no chat flow). The live request
  test tolerates the "already rated" refusal on re-runs against the same dev database. Commit:
  `fix(server): stop contact clicks and ratings from being farmed`.
- **Production refuses to start without a valid `JWT_SECRET`.** Without one the server signed sessions with a random per-process key:
  every restart (each deploy) logged all users out, and two instances could not accept each other's tokens. With
  `NODE_ENV=production` it now exits with a clear message (32+ characters, not a placeholder); development still falls back to the
  random key. The deploy workflow's restart smoke test turns a missing variable into an automatic rollback rather than an outage.
  Verified: `NODE_ENV=production JWT_SECRET=` and `=changeme` → exit 1; a valid secret starts as before. Commit:
  `fix(server): production must have a real JWT_SECRET`.
- **Login lockout is per phone + device, not per phone alone.** Ten wrong passwords typed by *anyone* locked the real owner of that
  number out for 15 minutes (a trivial harassment attack on any provider). The counter now keys on `phone|ip` (`LOGIN_MAX_FAILS`,
  default 10), so a stranger only locks themselves out; a second counter per phone across all addresses (5× the limit) still stops
  distributed guessing. Verified on the real server with `X-Forwarded-For`: 10 bad tries from one address → 11th is 429 and stays
  429 even with the right password; the owner from another address → 200; 54 failures spread over six addresses → locked for all.
  Commit: `fix(server): lock out a phone per device, not for everyone`.
- **New: "add my business" (`listing_submissions`).** Requested by the owner (this adds endpoints; nothing existing changes). A logged-in
  `user` submits a service (`POST /api/listing-submissions`: layer, name, phone, optional description / WhatsApp / hours / price, and a
  point in EPSG:28191); one pending request per user (partial unique index), 10 per day. `GET /api/listing-submissions/mine`,
  `DELETE /api/listing-submissions/:id` (own, pending only), `GET /api/listing-submissions/layers` (types offered: service types minus
  road barriers, fuel, landmarks, jobs, free distribution; property stays admin-only). Admin: `GET /api/admin/listing-submissions?status=`,
  `POST …/:id/approve` (one transaction: inserts the row into `service_all`, the DB trigger fills place/coordinates/visibility; makes the
  account a `provider` linked to it, bumps `token_version`, clears the caches; the admin may correct name/description/hours and send
  `search_tags`), `POST …/:id/reject` (reason required). The user gets a notification either way (after approval they must log in again,
  same as when the admin links an account by hand). Verified on the real server: bad layer/coordinates → 400, duplicate → 409, approve
  twice → 409, old token → session ended, submit as provider → 403, reject needs a reason, resubmit after reject and cancel work.
  Note: new accounts are inactive until an admin activates them (existing behaviour), so a submitter must already be active.
  Commit: `feat(server): "add my business" requests with admin approval`.
  - **Web side (`/add-listing`, `/admin/submissions`).** A signed-in `user` fills one form: type (searchable, grouped like the layer
    panel; only the types the server offers), name, description, hours, phone (+ "same number on WhatsApp"), a price for hotels and
    villas, and taps the location on a small satellite map (or uses the GPS). One request waits at a time; the page then shows its
    state with a cancel button, and after a decision shows the approval or the admin's reason. Providers and admins get a short note
    instead of the form. The admin page lists pending / approved / rejected requests with editable name, description and hours, an
    "open on the map" link, approve (publishes, links the account) and reject (a reason is required and reaches the sender). Admins
    are notified on every new request. Entrances: a home card "Add your business" (users) and "Add requests" (admins); the admin
    page is not in the header (it already holds eight admin links and overflowed). The register form has a
    "I have a business" box that opens the same fields (business phone defaults to the account's), so an owner signs up and submits in
    one step and waits for one decision: approving also activates the account (registration alone still needs an admin to activate). `serviceSearchTags` was extracted
    from the editor so the admin page writes the same search keywords as the edit tool. Live test: `listingSubmissions.live.test.ts`.
- **Register + business in one step, one approval.** `POST /api/auth/register` accepts an optional `listing` object (same fields and
  checks as `POST /api/listing-submissions`, now one shared `parseListingInput`). The account (still inactive, as always) and the
  pending request are created in one transaction, so a bad listing creates no account; admins are notified. Approving a request now
  also sets `is_active = true` on the owner, so a business owner waits for one decision, not two (activation, then approval); the
  notification says they can log in (or to log in again if they were already active). A rejected new account stays inactive: the
  admin decides about it separately from the users page. Without `listing` nothing changes. Verified on the real server: bad
  listing → 400 and no user row; register+listing → login refused; approve → login works as `provider` linked to the new point.
  Commit: `feat(server): register with a business, approved once`.
- **`service_all.currency` (TEXT) is added at start-up next to `price` / `area`.** Husam's editor on `main` (q1, 30
  September) writes a currency for hotels and holiday villas, so his database has the column; ours did not, and a WFS-T
  insert carrying it would fail. `ensureServicePropertyColumns` now adds it (`ADD COLUMN IF NOT EXISTS`, no data change,
  existing rows stay NULL = shown as dollars) and checks it is there. GeoServer must re-read the table once
  (`dev/geoserver-setup.sh` does it locally; production: reload the `service_all` feature type). Verified: start-up log
  lists the three columns; WFS `DescribeFeatureType` shows `currency`. Commit: `feat(server): service_all gets a currency column`.
- **After a deal the user gets the provider's numbers, also when the map entry has none.** The provider's call / WhatsApp
  numbers came only from the feature row (`service_all.phone` / `.whatsapp`); a provider whose entry has no number left the
  user with "contact numbers: not available" while the provider saw the user's account numbers. `getProviderContactInfo`
  now falls back, field by field, to the provider's account (`users.phone` / `whatsapp_number`) — the same source the user's
  numbers come from. Also `POST …/:id/confirm` answered `userWhatsapp: userPhone` (Husam's TEST_PLAN R20); it now sends the
  WhatsApp number. Found by the role test (`web/e2e/flows.spec.ts`, scenario A). Verified: the dev provider (no number on
  his feature) → the user's chat shows "agreed — contact now" with 0590000002. Commit:
  `fix(server): the user gets the provider's numbers after a deal`.
- **"Rate this service" follows the one-rating-per-business rule.** Since the rule (contact clicks and ratings commit), a
  user who had rated a business was still listed in `GET /api/service-requests/pending-ratings` for every later deal with
  it, so the rating window kept opening and every attempt was refused ("already rated"). The list now leaves out requests
  for a business the user already rated (by any request), and `GET …/:id/rating-check` reports such a request as rated
  (with that rating's comment state). Verified: the dev user (rated the dev provider before) → pending list empty, check
  `hasRated: true`; `requests.live.test.ts` and the role test cover a first and a repeated deal. Commit:
  `fix(server): no rating prompt for a business the user already rated`.
- **Live events reach every device of a user, not only the newest one.** `connectedUsers` kept one socket id per user
  (the last to connect), so a user with the site open on a phone and a laptop — or two tabs — got "request accepted", new
  chat messages, notifications and forced logouts only on the newest one; the other stayed stale until a reload. Each
  socket now joins the room `user:<id>` and the map holds the room name, so every existing `io.to(…)` reaches all the
  user's sockets; the user counts as online while any of them is connected. Found by the role test (another spec logged
  in as the same user took the events). Verified: `flows.spec.ts` scenario A opens a second session of the user, which
  also gets "the provider accepted"; the full browser suite (64) passes in parallel. Commit:
  `fix(server): socket events reach all of a user's devices`.
- **An admin edit ends the user's session only when it has to.** `POST /api/admin/users/update` saved a "your account
  was changed — log out and in again" notification and pushed `force_relogin` after **every** change, so lowering a
  request limit or linking a service logged the user out (now on all devices). The token is still invalidated only for a
  role, activation or password change (`token_version + 1`, unchanged); the notification and the push now follow the same
  condition. Found by the role test (scenario Q: the user was signed out by a limit change). Verified: `flows.spec.ts` Q
  (limit set → the user stays signed in and is stopped by the limit; limit lifted → free again), `admin.live.test.ts`.
  Commit: `fix(server): editing a user's limit or service no longer logs them out`.
- **The missing-settings message names the file the server reads.** When `POSTGRES_*` is missing, the server told you to
  create `.env.local` (with a production GeoServer address in the sample), but `dotenv.config()` only reads `.env` — a
  file made from that hint was silently ignored. It now says: copy `.env.example` to `.env`. `.env.example` lists exactly
  the variables `server.js` reads, with its defaults (9 unread ones dropped, 5 missing added). `.env.local.example`
  (the same list again) is gone. Verified: start without `POSTGRES_HOST` → the new message and exit 1. Commit:
  `fix(server): the missing-settings message points to .env`.
- **The ratings table is created at startup like the other tables.** `service_ratings` was the one table the server
  needed but never created: a new database needed `database/create_service_ratings_table.sql` run by hand, or every
  rating call failed. `ensureServiceRequestSchema` now creates it (same columns, checks, keys and indexes as the script,
  `IF NOT EXISTS`, so existing databases are untouched) and the script is removed. Verified: a schema-only copy of the dev
  database without the table → the server starts, the table appears with its unique key, check, 3 foreign keys and 3
  indexes. Commit: `fix(server): the ratings table is created at startup`.
- **Five unused admin endpoints removed** (was a "Backend ask"; the user decided 2026-10-01 to clean them up).
  `GET /api/stats-detailed`, `GET /api/stats-summary`, `DELETE /api/delete-stat/:id`, `GET /api/users` and
  `GET /api/admin/all-service-requests-logs` were called by nothing: the React app has its own dashboard and users
  endpoints, the legacy pages are deleted, and the last two returned every user's (and every requester's and provider's)
  phone and WhatsApp numbers. Fewer routes that can leak personal data. The logging routes (`POST /api/log-map-event`,
  `POST /api/log-contact-click`) and the dashboard stats stay.
  Verified: as admin, all five → 404; `GET /api/admin/users` → 200; `grep` finds no caller in `web/`. Commit:
  `refactor(server): remove five admin endpoints nothing calls`.
- **`GEOSERVER_TARGET` is required; no production address in the code.** `server.js` fell back to the production
  GeoServer's public IP when the variable was unset, so a missing setting silently pointed any copy (a laptop, a test
  box) at production, and the address sat in a public repository. It is now required like `POSTGRES_*`: missing → the
  startup message lists it and the server exits. `.env.example` lists it under "required"; `docs/ops/deploy.md` puts it
  in the pre-merge checklist (production must have it in its settings before this deploys — the deploy's smoke test
  rolls back otherwise). Verified: without it → "GEOSERVER_TARGET" in the missing list, exit 1; with `dev/dev.env` →
  `/geoserver-proxy/…/wfs` 200. Commit: `fix(server): GEOSERVER_TARGET comes from the settings only`.
- **One list of service types for the app and the server.** The server's `ALLOWED_LAYERS` repeated, by hand, the 68
  service keys of the web registry (`registry.test.ts` compared the two). The list now lives in
  `shared/service-types.json`: the web registry imports it, and `server.js` reads it at startup and adds the
  non-service layers (`OTHER_LAYERS`: the three property layers, `Location`, `RoadsTest`, `service_all`). Adding a
  type = one JSON entry + its two names in the locales; the server needs no edit. Same whitelist: the old literal and
  the new list hold the same 74 names (checked by script before the commit). Vite serves `../shared` and nothing else
  outside `web/` (`/@fs/…/server.js` → 403). Verified: `registry.test.ts` (entries have only known fields, valid
  group / tier / edit profile; the server builds its list from the file; `OTHER_LAYERS` = the app's non-service
  layers), the full unit and browser suites. Commit: `refactor: one list of service types for the app and the server`.
- **`server.js` split into modules (no behaviour change).** The 4,800-line file is now `server.js` (start-up: imports the
  modules in order, listens, shuts down cleanly) + `server/` — `app.js` (settings, security, Express, socket.io server,
  middleware), `database.js`, `layers.js`, `auth.js` (sessions, guards, quota), `state.js` (shared caches, who is online,
  `notifyUser`), `listings.js`, `routes/*.js` (one file per subject), `frontend.js` (health, `/api` 404, `web/dist`,
  legacy redirects, error handler), `sockets.js`. How it was done, so it stays mechanical: (1) inside the single file,
  declarations used by several subjects were moved up next to the shared code (`requireAdmin`, the quota, the presence
  map, `notifyUser`, the platform caches, the listing validators) and the body-parsing middleware moved to the end of
  the app setup — same middleware order; the provider-links cache became an object with `clearProviderLinkedCache()`
  because a module cannot reassign another module's binding; (2) a script cut the file at top-level statements and wrote
  each module's imports and exports from a scope analysis (every cross-module name, no module uses a later one, no
  module writes another's variable), so modules load — and register routes — in the old order; `ROOT_DIR` replaces
  `__dirname` (the repo root, now one level up). `npm run check:server` (`tools/check-server.mjs`) links every module
  without running anything (a missing export or an unimported file fails it); CI and the deploy job run it instead of
  `node --check server.js`, the deploy script also checks `server\` and `shared\` are staged, `web.config` blocks both
  folders, the edit guard hook covers `server/`. Verified: same start-up log; `VITE_LIVE_API` suite 503 passed; browser
  suite incl. the role flows 66 passed; no runtime error in the server log; with `web/dist` built: `/`, `/search`,
  `/admin/users` 200, `/index.html?x=1` → 301 `/?x=1`, `/admin-users.html` → 301, `/api/nope` 404, `/server.js` and
  `/shared/…` 404. Commit: `refactor(server): split server.js into modules`.
- **Notifications say where they lead (`notifications.link`).** A notification was a title and a text: clicking it in
  the bell or on `/notifications` could only mark it read (legacy did the same), so "new service request" did not take
  the provider to the request. New nullable column `link` (created at startup): `request:<id>` on the request
  notifications (new request, accepted / rejected, cancelled, deal done) and an app path on the "add my business" ones
  (`/admin/submissions` for admins, `/add-listing` after a rejection). `notifyUser()` takes it as a 5th argument; the
  socket list (`get_unread_notifications`) and the live push (`new_notification`) carry it. Existing rows and the
  admin's own notifications have none. Additive: no change for a client that ignores it. Verified: after a request
  between the dev accounts, the provider's row has `link = 'request:<id>'`; the role tests pass. Commit:
  `feat(server): notifications carry a link to what they are about`.
- **No password stays in plain text.** Passwords from before bcrypt were hashed only when their owner next logged in
  (`verifyPasswordWithMigration`), so an account nobody used since kept a readable password in `users.password_hash`
  for good — readable by anyone with database access or a backup. At startup the server now bcrypt-hashes every value
  that is not a bcrypt hash (the stored text itself, so the same password still works; the update is conditional on
  the old value, so a password changed meanwhile is not overwritten). Logs only the count. Verified on a schema copy
  with one plain-text account: `🔒 شُفّرت 1 …`, the row is `$2b$…`, login with the old password 200, a wrong one 401.
  Commit: `fix(server): hash every plain-text password at startup`.
- **Logout ends the session on the server (`POST /api/auth/logout`).** Logging out only deleted the token from the
  browser; the server kept accepting it until it expired (30 days), so a copied token (a shared computer, a leaked
  backup of browser data) stayed a working login. New route: the token's SHA-256 is stored until the token's own expiry
  in `revoked_sessions` (created at startup, pruned hourly) and in memory; `requireAuth`, `requireAdmin`,
  `activeAdminUidFromToken`, the socket handshake and `/save-stat` refuse it (`401 SESSION_REVOKED`), and open sockets
  opened with it are disconnected. Only that session ends — the user's other devices stay in. Session tokens now carry
  a random `jti`: two logins in the same second used to produce the very same token, so one logout would have ended
  both. No body, no account check (an invalid token has nothing to end → 200). Verified against the dev server: two
  sessions of the user → distinct tokens, both 200; logout A → A 401, B 200; after a restart A still 401; a socket with
  A is refused; a logged-out admin token → 401 on an admin route; no token / junk token → 200. Commit:
  `feat(server): logout revokes the token on the server`.
- **Scripts only from the site itself (CSP).** `script-src` allowed cdnjs, jsdelivr and cdn.socket.io, leftovers of the
  legacy pages; the React build loads no script from a CDN. jsdelivr serves any npm package, so an injected
  `<script src="https://cdn.jsdelivr.net/…">` would have passed the policy. Now `script-src 'self'`; the CDN entries
  of `font-src` and `style-src` went too. Verified with `web/dist` served by the server: the header shows the new
  policy; logged in as the provider, the map, `/search`, `/home` and `/notifications` load with no CSP violation in
  the console. Commit: `fix(server): scripts only from the site itself`.
- **An ended session answers 401 on admin routes too; `GET /api/auth/session`.** `requireAdmin` answered **403** "you do
  not have admin permission" when the admin's session had ended (account deleted or deactivated, forced logout,
  `token_version` changed by a password / role change). The app logs out only on 401, so an admin whose session ended
  stayed on the page with "no permission" errors (reported by the user). Those cases now answer 401
  `SESSION_REVOKED` like `requireAuth`; 403 stays for a live session of an account that is not an admin. New
  `GET /api/auth/session` (`requireAuth`, `{ uid, role }`): the app asks it when its socket is refused or dropped by
  the server and when a tab comes back, so an idle page notices an ended session. Verified in a browser against this
  server: an idle admin page whose token is logged out elsewhere → login page with "your session ended" in 0.5 s; after
  a `token_version` bump, "reload" on the dashboard → the same (before: a 403 toast, still "logged in"). Commit:
  `fix(server): an ended session is 401 on admin routes too`.

## Backend asks (needs the user's decision — behaviour-changing or larger)

- **Public map:** `/api/log-contact-click` is `requireAuth`, so a visitor's call / WhatsApp tap is not counted in the provider's
  statistics (and has no quota). If visitor contacts should count, the endpoint needs a public, rate-limited variant.

- WFS-T editing sends GeoServer credentials from the browser (`js/edit-wfs.js`); should move server-side.
  Detail (from porting item 5): `/geoserver-proxy` has **no role check** — the proxy forwards any `POST` (a WFS-T Transaction whose layer is
  whitelisted) and GeoServer's Basic login is the only gate, so anyone who knows a GeoServer account can write from anywhere, and every
  admin has to know that account. Proposal: `POST /api/admin/features` (`requireAuth` + admin) taking the `FeatureTx` JSON that
  `web/src/features/map/edit/tx.ts` already defines (`op`, `layer`, `fid`, `properties`, `geometry`), building the transaction with a
  server-side GeoServer account from the environment; then only `saveFeature` in `transport.ts` changes. (The interim guard — writes only with an admin app token in
  `X-App-Token` — is in place, see Server changes; the GeoServer login still travels from the browser.)
- `/api/search-features*` are public and return `SELECT *` — review exposed columns.
- Search returns at most 2000 rows with no offset/pagination; a text search ORs its words (broadens instead of narrowing).
- `/api/log-map-event` ignores the `service` field for search events (only `provider` and `event_type` are stored), so the
  dashboard can't tell WHAT was searched.
- Results are filtered client-side for nearby search (whole layer fetched, up to 2000 rows) — a server-side distance filter
  would scale better.
- CSP `connectSrc` allows any `https:`/`ws:`/`wss:` — tighten to own origin once the app is on React.
- **Hotels / villas price currency:** `service_all` has `price` and `area` but no currency column, so a service's price is shown as
  dollars (legacy showed a currency box that saved nothing). Add a `currency` column (and expose it in GeoServer) if prices in
  shekels / dinars are wanted; the editor and the filters already know how to handle a currency for property.
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
- **Admin users:** no endpoint deletes a user, and there is no "force password change at next login" field (the legacy checkbox did nothing) — decide if either is wanted. `POST /api/admin/users/update` always notifies the user and emits `force_relogin`, even for a quota-only change; it does not check that the service layer / feature exists or is already linked to another account, and role `provider` does not require a link. `POST /api/admin/users/force-logout-all` with `target_type: 'selected'` and a non-array `user_ids` answers 500; `all` / `online` include the calling admin. `GET /api/admin/users` returns every row without paging.
- **Admin dashboard:** `DELETE /api/admin/provider-success-stats/:id` hard-deletes the request row (and answers success for an id that does not exist; a non-numeric id gives 500). Consider a soft delete / audit trail, since it removes the request's chat history from the users' point of view.
- **Widgets admin:** `POST /api/admin/update-fuel-station` overwrites all three columns (an omitted one becomes NULL) and answers success for an unknown id; the React page always sends the three current values. `widgets_manual_groups` accepts any JSON for `items` (no per-group schema).
- **Widgets portal:** `GET /api/widgets-data` returns `groups.<key>.items` while the admin endpoint returns `groups.<key>.data` for the same rows, and always downloads all seven groups (the 106-row city fare list included, ~10 KB) every minute for every open ticker. A `?groups=` filter or an `ETag` would make the poll cheap. Prayer times and the weather forecast come straight from Aladhan / Open-Meteo in every visitor's browser; a small cached server proxy would remove the third-party dependency from the client (and the CSP `https:` allowance).
- **Live push for visitors:** `status_updated` / `widgets_updated` (see Server changes) reach logged-in users only, because the socket
  server refuses connections without a token. Public visitors on `/search` and `/widgets/*` keep the one-minute poll. A read-only
  public namespace (e.g. `io.of('/live')`, no auth, no client → server events, rate-limited connections) would give them the same
  instant refresh; it opens an unauthenticated socket surface, so it is left for the user to decide.
- **Web Push (notifications with the app closed).** Today a new request / chat message reaches a provider only while the app is open
  (socket.io); the phone locking or the tab sleeping cuts it. The installable PWA is in place (see Phase 3, item 9); real push needs
  the server: VAPID keys in the environment, a table of push subscriptions per user, `POST /api/push/subscribe` + `DELETE` (auth), and
  sending a push (e.g. `web-push`) wherever `service_request_new` / `service_request_message` / `new_notification` are emitted today,
  dropping subscriptions the push service answers 404 / 410 for; then a `push` handler in `web/public/sw.js` and a subscribe call after
  the user allows notifications. Adds endpoints, a table and a dependency — needs the user's decision. iOS: only for an app added to
  the Home Screen (16.4+).
- **Featured / recommended rule and pictures are constants:** `rating = 10` (featured) and `9.9` (recommended) and the section / slideshow pictures are fixed in the web app. Making them editable by an admin needs a settings table + admin page (and an upload endpoint for the pictures); not done — say if you want it.
