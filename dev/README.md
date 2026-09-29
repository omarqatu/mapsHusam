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
