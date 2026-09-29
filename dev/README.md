# Local dev environment

Real backend + real Postgres, no mocks, and **no dependency on the repo's `.env`** (nothing here reads
or writes it). Needs `podman` and Node.

```bash
dev/dev.sh db-up      # isolated Postgres (podman, 127.0.0.1:55432) with services_db + realestate
dev/dev.sh seed       # dev accounts (below)
dev/dev.sh server     # server.js on :3000 using dev/dev.env
cd web && npm run dev # Vite (:5173, or the next free port) proxying /api, /geoserver-proxy, /socket.io
```

| Role | Phone | Password |
| --- | --- | --- |
| admin | 0590000001 | Admin#12345 |
| provider | 0590000002 | Provider#12345 |
| user | 0590000003 | User#12345 |

Real-backend tests (skipped unless the variable is set):
`cd web && VITE_LIVE_API=http://localhost:3000 npm test`

Other commands: `db-down` (stop, keep data), `db-reset` (delete everything).

## What is and isn't there

- **Schema**: only what auth needs (`users`, `map_service_stats`) + whatever `server.js` creates itself at
  startup. Each ported page adds the tables it needs to `dev/db/01-init.sql` (then `db-reset`). The
  startup warning `road_barriers does not exist` is expected until the widgets pages are ported.
- **PostGIS / layer data**: not installed (postgres image without PostGIS, no data dump in the repo). Needed
  from Phase 3 (map) — switch `PSM_DEV_PG_IMAGE` to a `postgis/postgis` image then.
- **GeoServer**: `GEOSERVER_TARGET` points at `127.0.0.1:8080` on purpose, NOT the production GeoServer —
  editing (WFS-T) can write. Run a local GeoServer (or agree on a read-only one) before the map phase.
- The Postgres data lives in the podman volume `psm-dev-pgdata`, not in the repo.
