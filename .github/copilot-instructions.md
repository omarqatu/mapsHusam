# PSM map — instructions for GitHub Copilot

Public real-estate and services map. Backend: `server.js` + `server/` + `lib/` (Express, PostgreSQL, socket.io; proxies
GeoServer at `/geoserver-proxy`). Frontend: React in `web/`. The plan and the page inventory are in
`docs/react-migration/PLAN.md`; the house style digest is `docs/react-migration/HOUSE-STYLE.md`. Read PLAN.md before a task.
More detail by area lives in `.github/instructions/`; reusable tasks are prompt files in `.github/prompts/` (type `/` in chat).

## Stack (fixed)

React 19 + TypeScript (strict) + Vite, React Router, Tailwind 4, TanStack Query (server state), Zustand (client state: auth,
map UI), i18next (Arabic default, RTL), `lucide-react` icons, socket.io-client, OpenLayers for the map (EPSG:28191 plus
GeoServer WMS/WFS; MapLibre cannot do this projection, do not switch).

## Run and check

```bash
dev/dev.sh db-up && dev/dev.sh seed   # local Postgres in podman + dev accounts (see dev/README.md)
dev/dev.sh server                     # backend on :3000, no .env needed
cd web && npm install && npm run dev  # Vite, proxies /api, /geoserver-proxy, /socket.io to :3000
cd web && npm run typecheck && npm run lint && npm test
```

Run all three checks before saying a change is done. Test against the real backend when a page talks to an endpoint.

## MCP tools (`.vscode/mcp.json`, free)

- `playwright`: opens the running app in a real browser. After any visible change, load `http://localhost:5173/` (or the
  port Vite prints), look at it at 1440 px and 390 px wide, in Arabic, and check there is no horizontal scroll.
- `psm-db`: read-only SQL on the LOCAL dev databases (`services` and `realestate`, configured in `dev/dbhub.toml`; start them
  with `dev/dev.sh db-up && dev/dev.sh seed` first). Use it to look at real rows before writing a query or a type. The
  credentials are the dev-only ones from `dev/dev.env`; never point this at production.

## Rules that must hold

- **Backend: functionality-preserving only.** Existing endpoints keep URLs, methods, auth rules and response shapes.
  A server improvement goes in its own commit and is logged in PLAN.md under "Server changes".
- **No emoji as icons, ever.** Icons are `lucide-react` drawings (`registry/typeIcons.ts`, `features/map/TargetIcon`) or
  pictures. `web/src/noEmoji.test.ts` fails on any emoji in code, locales or texts (comments excepted).
- **No `innerHTML` / `dangerouslySetInnerHTML`.** User content (names, descriptions, chat, ratings) goes through JSX only.
- **All HTTP goes through `web/src/api/client.ts`** (Bearer token, 401 means logout). No raw `fetch` in components.
  GeoServer reads go through `web/src/api/geoserver.ts` (it must not send the app token). Each server call is a typed
  function in `web/src/api/*.ts` plus a Query hook.
- **Arabic is data, English is code.** Comments and identifiers in English; UI text in `web/src/locales/{ar,en}.json`
  (add every key to both), never hard-coded in JSX.
- **RTL-safe Tailwind:** logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`/`mr-`/`left-`/`right-`.
- **Reuse before writing:** look in `web/src/components/ui/` first; a pattern used twice becomes a shared component.
- Text at least 14 px, touch targets at least 40 px, visible focus
  (`focus-visible:outline-2 focus-visible:outline-brand`).
- Never commit `node_modules`, `dist`, `.env`. Stage files by name.

## Style

Match the surrounding code: naming, comment density, idiom. Comments explain why, not what.
