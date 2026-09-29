# Working agreement — PSM map (React migration)

Public real-estate & services map. Backend: `server.js` (Express + PostgreSQL + socket.io, proxies
GeoServer at `/geoserver-proxy`). Legacy frontend: root `*.html` + `js/` + `css/` (vanilla JS +
OpenLayers). **We are migrating the frontend to React in `web/`.** The plan and the page inventory
live in [`docs/react-migration/PLAN.md`](docs/react-migration/PLAN.md) — read it first on every task.

## Reference project

The house style comes from the water platform (Enterprise-APP), `clients/web`. When it is available
on disk (e.g. `../Enterprise-APP`), read its conventions before inventing one:
`clients/web/src/components/ui/` (shared components), `.agents/skills/react/SKILL.md` (patterns).
Copy the *pattern*, not its domain code (no tenancy, no module RBAC, no MapLibre — see below).

## Stack (fixed — do not re-litigate)

React 19 + TypeScript (strict) + Vite, React Router, Tailwind 4, TanStack Query (server state),
Zustand (client state: auth, map UI), i18next (ar default, RTL), lucide-react icons,
socket.io-client, **OpenLayers** for the map (EPSG:28191 + GeoServer WMS/WFS — MapLibre cannot do
this projection, so do not switch).

## Run

```bash
npm install && npm start          # backend on :3000 (needs .env: Postgres + GeoServer)
cd web && npm install && npm run dev   # Vite on :5173, proxies /api, /geoserver-proxy, /socket.io → :3000
cd web && npm run typecheck && npm run lint && npm test
```

## Invariants

- **Backend is frozen during migration.** Don't change `server.js` endpoints or response shapes to
  suit the new UI. If an endpoint is missing or wrong, write it down in PLAN.md → "Backend asks".
  Security fixes are the exception and go in their own commit.
- **Parity before polish.** A ported page must do everything the legacy page did (see its checklist
  in PLAN.md) before any redesign. Legacy files stay until the React page is verified, then are
  deleted in the same commit that switches the route.
- **No `innerHTML` / `dangerouslySetInnerHTML`.** User content (names, descriptions, chat, ratings)
  is rendered through JSX only. This is the main XSS fix of the migration.
- **All HTTP goes through `web/src/api/client.ts`** (Bearer token, 401 → logout). No raw `fetch`
  in components. Every server call is a typed function in `web/src/api/*.ts` + a Query hook.
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
