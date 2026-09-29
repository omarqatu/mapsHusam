#!/usr/bin/env bash
# Local dev environment for the PSM backend. Isolated Postgres in podman + server.js on :3000.
#   dev/dev.sh db-up      start (or create) the Postgres container, wait until ready
#   dev/dev.sh seed       create/refresh the dev accounts (needs server run once, or db-up only)
#   dev/dev.sh server     run server.js with dev/dev.env in the foreground
#   dev/dev.sh db-down    stop the container (data kept)
#   dev/dev.sh db-reset   DELETE the container + data and start over
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=psm-dev-pg
VOLUME=psm-dev-pgdata
IMAGE=${PSM_DEV_PG_IMAGE:-docker.io/library/postgres:18.3}
PORT=55432

load_env() { set -a; . dev/dev.env; set +a; }

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
  seed)   load_env; node dev/seed-users.mjs ;;
  server) load_env; exec node server.js ;;
  db-down) podman stop "$NAME" ;;
  db-reset) podman rm -f "$NAME" >/dev/null 2>&1 || true; podman volume rm -f "$VOLUME" >/dev/null 2>&1 || true; echo "removed; run db-up" ;;
  *) sed -n 2,9p "$0"; exit 1 ;;
esac
