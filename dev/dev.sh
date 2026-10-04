#!/usr/bin/env bash
# Local dev environment for the PSM backend. Isolated Postgres in podman + server.js on :3000.
#   dev/dev.sh db-up      start (or create) the Postgres container, wait until ready
#   dev/dev.sh restore    load dev/db/dumps/{services_db,realestate}.dump (skips personal table data)
#   dev/dev.sh seed       create/refresh the dev accounts (after restore)
#   dev/dev.sh server     run server.js with dev/dev.env in the foreground
#   dev/dev.sh db-down    stop the container (data kept)
#   dev/dev.sh db-reset   DELETE the container + data and start over
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=psm-dev-pg
VOLUME=psm-dev-pgdata
IMAGE=${PSM_DEV_PG_IMAGE:-docker.io/postgis/postgis:18-3.6}
PORT=55432

# The live tests register throwaway accounts on every run: lift the per-device sign-up limit locally.
load_env() { set -a; . dev/dev.env; : "${REGISTER_RATE_LIMIT:=1000}"; set +a; }

wait_ready() {
  for _ in $(seq 1 60); do
    podman exec "$NAME" pg_isready -U psm -d services_db >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "Postgres did not become ready" >&2; exit 1
}

case "${1:-}" in
  db-up)
    if podman container exists "$NAME"; then
      podman start "$NAME" >/dev/null
    else
      podman run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" \
        -e POSTGRES_USER=psm -e POSTGRES_PASSWORD=psm_dev_only -e POSTGRES_DB=postgres \
        -v "$VOLUME:/var/lib/postgresql" \
        -v "$PWD/dev/db:/docker-entrypoint-initdb.d:ro,Z" \
        "$IMAGE" >/dev/null
    fi
    wait_ready
    echo "Postgres ready on 127.0.0.1:$PORT (databases: services_db, realestate)"
    ;;
  restore)
    # Tables whose rows are about people. Their structure is restored, their rows never are — even if a
    # dump happens to contain them.
    PERSONAL='users|service_requests|service_request_messages|service_ratings|notifications|map_service_stats'
    for db in services_db realestate; do
      f="dev/db/dumps/$db.dump"
      [ -f "$f" ] || { echo "missing $f" >&2; exit 1; }
      podman cp "$f" "$NAME:/tmp/$db.dump"
      podman exec "$NAME" sh -c "pg_restore -l /tmp/$db.dump | grep -vE 'TABLE DATA public ($PERSONAL) ' > /tmp/$db.list"
      podman exec "$NAME" pg_restore -U psm -d "$db" --no-owner --no-privileges --clean --if-exists \
        -L "/tmp/$db.list" "/tmp/$db.dump" 2>&1 | grep -vE 'extension "postgis"|already exists|does not exist, skipping' || true
      podman exec "$NAME" rm -f "/tmp/$db.dump" "/tmp/$db.list"
      echo "restored $db"
    done
    ;;
  seed)   load_env; node dev/seed-users.mjs ;;
  server) load_env; exec node server.js ;;
  db-down) podman stop "$NAME" ;;
  db-reset) podman rm -f "$NAME" >/dev/null 2>&1 || true; podman volume rm -f "$VOLUME" >/dev/null 2>&1 || true; echo "removed; run db-up" ;;
  *) sed -n 2,9p "$0"; exit 1 ;;
esac
