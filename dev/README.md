# Local dev environment

Real backend + real Postgres, no mocks, and **no dependency on the repo's `.env`** (nothing here reads
or writes it). Needs `podman` and Node.

```bash
dev/dev.sh db-up      # isolated Postgres (podman, 127.0.0.1:55432) with services_db + realestate
dev/dev.sh seed       # dev accounts (below)
dev/dev.sh server     # server.js on :3000 using dev/dev.env
cd web && npm run dev # Vite (:5173, or the next free port) proxying /api, /geoserver-proxy, /socket.io
```

| Role     | Phone      | Password       |
| -------- | ---------- | -------------- |
| admin    | 0590000001 | Admin#12345    |
| provider | 0590000002 | Provider#12345 |
| user     | 0590000003 | User#12345     |

Real-backend tests (skipped unless the variable is set):
`cd web && VITE_LIVE_API=http://localhost:3000 npm test`

Other commands: `db-down` (stop, keep data), `db-reset` (delete everything).

**Before merging to `main`:** `dev/check-all.sh` runs everything — backend module check, `lib/` tests, web typecheck, lint,
unit + live tests and the whole browser suite including the role flows — against its own backend on `:3100` (`CHECK_PORT`),
then scans that backend's log for runtime errors. Needs `db-up`, `seed` and the local GeoServer.

## Browser tests (Playwright)

The checks we used to do by hand in a browser — login, the map with its markers, a provider card from the search box, the
layers panel, keyword search, the information centre, the admin pages and their guard, the theme toggle, no sideways scroll
— live in `web/e2e/` and run at desktop width (1440) and phone width (390), in Arabic.

```bash
dev/dev.sh db-up && dev/dev.sh seed && dev/dev.sh server   # backend on :3000 (and the local GeoServer, see below)
cd web && npm run e2e                                      # starts its own Vite on :5199, runs both widths
cd web && npm run e2e -- map --project=phone               # one spec file / one width
cd web && npm run e2e -- --ui                              # Playwright's UI mode (watch a run, inspect a failure)
```

- **Needs**: the seeded accounts (admin, user), the local GeoServer with the layers loaded (the map spec reads the services
  layer), and the backend on `http://localhost:3000` (`VITE_BACKEND_URL` to point elsewhere). `E2E_PORT` changes the Vite port
  (default 5199). The suite starts and owns its Vite process by default; set `E2E_REUSE_SERVER=1` only when you intentionally
  want to reuse a Vite instance you started from this same checkout.
- **Browser**: nothing is downloaded. The locally installed headless Chromium is used — the newest
  `~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`, or the binary named in
  `PLAYWRIGHT_CHROMIUM`.
- **Read-only**: specs never change seeded data. The test harness answers every write to `/api` itself (an empty 200), except
  the login calls, so searching or opening a card cannot log an event or use up a quota. Sessions are created once per run by
  `global-setup.ts` through the real login endpoint.
- **A failure** leaves a screenshot and a trace in `.playwright/<port>/results/` at the repository root
  (`cd web && npx playwright show-trace ../.playwright/5199/results/<test>/trace.zip`). Generated auth state lives under the
  same port-specific folder, outside Vite's watched `web/` tree, so trace writes cannot reload a page and concurrent runs on
  different ports cannot overwrite each other's sessions.
- **Role flows (opt-in, writes data):** `E2E_FLOWS=1 npm run e2e -- flows --project=desktop` runs `e2e/flows.spec.ts`:
  user, provider and admin in separate browsers against the real server — request → accept → chat → both confirm →
  numbers → rating, reject, cancel with a reason, no duplicates, the provider panel (busy / available at a mocked GPS
  position), a visitor sent to log in, the admin dashboard and read-only view, and refusals for a third account
  (Husam's `docs/archive/TEST_PLAN.md` §6–§8, §11, §15). It needs the seeded provider (`0590000002`, linked to a plumber) and puts back
  what it changes: open requests are answered, the provider's status and location restored. Without the variable it is
  skipped, so the default suite stays read-only.
- **CI does not run them**: they need this database, GeoServer and the seeded accounts. CI (`.github/workflows/ci.yml`) and the
  deploy job validate the server install/syntax plus web typecheck, lint, unit tests and build. Run `npm run e2e` yourself
  before merging a change to a page.

## What is and isn't there

- **Schema**: only what auth needs (`users`, `map_service_stats`) + whatever `server.js` creates itself at
  startup. Each ported page adds the tables it needs to `dev/db/01-init.sql` (then `db-reset`). The
  startup warning `road_barriers does not exist` is expected until the widgets pages are ported.
- **PostGIS / layer data**: not installed (postgres image without PostGIS, no data dump in the repo). Needed
  from Phase 3 (map) — switch `PSM_DEV_PG_IMAGE` to a `postgis/postgis` image then.
- **GeoServer**: a LOCAL official image, never the production one (editing / WFS-T can write). `GEOSERVER_TARGET`
  defaults to `127.0.0.1:8080`. Start it once (`:U` fixes the volume ownership under rootless podman), then load the
  layers over PostGIS with the setup script:
  ```bash
  podman run -d --name psm-dev-geoserver --network host \
    -e GEOSERVER_ADMIN_USER=admin -e GEOSERVER_ADMIN_PASSWORD='PsmDev-2026' \
    -v psm-dev-geoserver-data:/opt/geoserver_data:U docker.osgeo.org/geoserver:2.26.2
  dev/geoserver-setup.sh      # workspaces realestate + services, the 10 layers the map uses (idempotent)
  ```
  The script also sets each workspace namespace to `http://localhost/<workspace>` and aligns the `RoadsTest` id sequence, both
  needed for the map editor's WFS-T writes (`web/src/features/map/edit`). Editor live test:
  `cd web && VITE_LIVE_API=http://localhost:3000 VITE_GEOSERVER_DEV_PASSWORD=<the dev password> npm test -- edit.live`.
  The dev admin password is a throwaway (this GeoServer only listens on your machine); the setup script refuses any
  non-local URL. Data lives in the podman volume `psm-dev-geoserver-data`.
- The Postgres data lives in the podman volume `psm-dev-pgdata`, not in the repo.
