# Working agreement — PSM map (React migration)

Public real-estate & services map. Backend: `server.js` + `server/` (Express + PostgreSQL + socket.io, proxies
GeoServer at `/geoserver-proxy`). The frontend is React in `web/` (the legacy vanilla-JS + OpenLayers pages — root `*.html`, `js/`, `css/` — were deleted in the Phase 4
commit; `git show <commit>^:index.html` etc. still reads them). The plan and the page inventory
live in [`docs/react-migration/PLAN.md`](docs/react-migration/PLAN.md) — read it first on every task.

## Reference project

The house style comes from the water platform (Enterprise-APP), `clients/web`. It lives on disk at
`../pwa-1` (git remote `Alameentech/Enterprise-APP`); add it to the session with
`/add-dir ../pwa-1` (or `permissions.additionalDirectories` in `.claude/settings.json`). Read the digest
[`docs/react-migration/HOUSE-STYLE.md`](docs/react-migration/HOUSE-STYLE.md) first; open
`../pwa-1/clients/web/src/components/ui/<Component>.tsx` only when mirroring that specific component
(don't bulk-read the reference — it is large).
Copy the *pattern*, not its domain code (no tenancy, no module RBAC, no MapLibre — see below).

## Stack (fixed — do not re-litigate)

React 19 + TypeScript (strict) + Vite, React Router, Tailwind 4, TanStack Query (server state),
Zustand (client state: auth, map UI), i18next (ar default, RTL), lucide-react icons,
socket.io-client, **OpenLayers** for the map (EPSG:28191 + GeoServer WMS/WFS — MapLibre cannot do
this projection, so do not switch).

## Run

```bash
dev/dev.sh db-up && dev/dev.sh seed   # local Postgres in podman + dev accounts (see dev/README.md)
dev/dev.sh server                     # backend on :3000 with dev/dev.env — no .env needed
cd web && npm install && npm run dev  # Vite (:5173 or next free), proxies /api, /geoserver-proxy, /socket.io → :3000
cd web && npm run typecheck && npm run lint && npm test
cd web && VITE_LIVE_API=http://localhost:3000 npm test   # + tests against the real backend (no mocks)
```

Test against the real backend whenever a page talks to an endpoint; mocks are only for cases the real
server can't produce on demand (network failure, 401 mid-session).

## Invariants

- **Backend: functionality-preserving improvements only.** Existing endpoints keep their URLs,
  methods, auth rules and response shapes (the legacy pages and the React app both depend on them).
  Server improvements (security, performance, cleanup) are allowed, each in its **own commit** and
  each **logged in PLAN.md → "Server changes"** (what, why, how to verify). Anything bigger or
  behaviour-changing goes to "Backend asks" for the user to decide.
- **Functionality parity, better UX.** A ported page must do everything the legacy page did (see its
  checklist in PLAN.md). The *experience* may change (fewer modals, less clutter, mobile-first) — record each
  UX change under the page's PLAN item. Visual identity comes from legacy `css/design-system.css` tokens. Legacy files stay until the React page is verified, then are
  deleted in the same commit that switches the route.
- **No `innerHTML` / `dangerouslySetInnerHTML`.** User content (names, descriptions, chat, ratings)
  is rendered through JSX only. This is the main XSS fix of the migration.
- **All HTTP goes through `web/src/api/client.ts`** (Bearer token, 401 → logout). No raw `fetch`
  in components. GeoServer reads go through `web/src/api/geoserver.ts` instead (it must not send the app
  token to GeoServer). Every server call is a typed function in `web/src/api/*.ts` + a Query hook.
- **Arabic is data, English is code.** Comments and identifiers in English; UI text in
  `web/src/locales/{ar,en}.json`, never hard-coded in JSX.
- **RTL-safe Tailwind:** use logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never
  `ml-`/`mr-`/`left-`/`right-`.
- **Reuse before writing:** check `web/src/components/ui/` first; a pattern used twice becomes a
  shared component.
- **Never commit** `node_modules`, `dist`, `.env`. Stage files by name, no `git add -A`.

## Skills

| Task | Skill |
| --- | --- |
| Porting one legacy page/feature to React | `migrate-page` |
| Anything touching the map, layers, WMS/WFS, projection, drawing/editing | `ol-map` |
