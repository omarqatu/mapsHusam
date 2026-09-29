#!/usr/bin/env bash
# Configures the LOCAL dev GeoServer (podman, see dev/README.md) on top of the local PostGIS copy.
# Idempotent: re-running skips what exists. Never point this at production.
#   GEOSERVER_ADMIN_PASSWORD=... dev/geoserver-setup.sh
set -euo pipefail

GS="${GEOSERVER_URL:-http://127.0.0.1:8080/geoserver}"
AUTH="admin:${GEOSERVER_ADMIN_PASSWORD:-PsmDev-2026}"
PG_HOST=127.0.0.1 PG_PORT="${POSTGRES_PORT:-55432}" PG_USER=psm PG_PASS=psm_dev_only

case "$GS" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: $GS is not a local GeoServer" >&2; exit 1 ;; esac

rest() { curl -sS -u "$AUTH" -H 'Content-Type: application/json' -o /dev/null -w '%{http_code}' "$@"; }

# workspace  database        layers (table names)
setup() {
  local ws=$1 db=$2; shift 2
  [ "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$GS/rest/workspaces/$ws.json")" = 200 ] ||
    rest -X POST "$GS/rest/workspaces" -d "{\"workspace\":{\"name\":\"$ws\"}}" >/dev/null
  # The editor's WFS-T bodies (web/src/features/map/edit/wfst.ts) name the feature types with the namespace
  # http://localhost/<workspace> — what the real GeoServer uses. A fresh local workspace gets http://<workspace>, and
  # GeoServer rejects a Transaction whose namespace differs, so align it (idempotent PUT, local only).
  rest -X PUT "$GS/rest/namespaces/$ws" -d "{\"namespace\":{\"prefix\":\"$ws\",\"uri\":\"http://localhost/$ws\"}}" >/dev/null
  if [ "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$GS/rest/workspaces/$ws/datastores/$db.json")" != 200 ]; then
    rest -X POST "$GS/rest/workspaces/$ws/datastores" -d "{\"dataStore\":{\"name\":\"$db\",\"connectionParameters\":{\"entry\":[
      {\"@key\":\"dbtype\",\"$\":\"postgis\"},{\"@key\":\"host\",\"$\":\"$PG_HOST\"},{\"@key\":\"port\",\"$\":\"$PG_PORT\"},
      {\"@key\":\"database\",\"$\":\"$db\"},{\"@key\":\"schema\",\"$\":\"public\"},{\"@key\":\"user\",\"$\":\"$PG_USER\"},
      {\"@key\":\"passwd\",\"$\":\"$PG_PASS\"},{\"@key\":\"Expose primary keys\",\"$\":\"true\"}]}}}" >/dev/null
  fi
  for layer in "$@"; do
    if [ "$(curl -s -u "$AUTH" -o /dev/null -w '%{http_code}' "$GS/rest/workspaces/$ws/datastores/$db/featuretypes/$layer.json")" = 200 ]; then
      echo "  $ws:$layer exists"; continue
    fi
    code=$(rest -X POST "$GS/rest/workspaces/$ws/datastores/$db/featuretypes?recalculate=nativebbox,latlonbbox" \
      -d "{\"featureType\":{\"name\":\"$layer\",\"nativeName\":\"$layer\",\"srs\":\"EPSG:28191\",\"projectionPolicy\":\"FORCE_DECLARED\",\"enabled\":true}}")
    echo "  $ws:$layer -> HTTP $code"
  done
}

echo "realestate"; setup realestate realestate ApartRent ApartSale LandSale City Governorate Location RoadsTest
echo "services";   setup services services_db service_all fuel_stations road_barriers
echo "done — WFS: $GS/services/wfs?service=WFS&request=GetCapabilities"

# The realestate copy has RoadsTest.id defaulting to roads_test_id_seq while its owned sequence is "RoadsTest_id_seq";
# GeoServer reads currval of the owned one after an Insert and fails ("currval ... not yet defined"). Point the default
# at the owned sequence (idempotent; only when the local Postgres container is there).
if command -v podman >/dev/null 2>&1 && podman container exists psm-dev-pg 2>/dev/null; then
  podman exec psm-dev-pg psql -q -U psm -d realestate -c "
    SELECT setval('\"RoadsTest_id_seq\"', GREATEST((SELECT COALESCE(MAX(id),1) FROM \"RoadsTest\"), (SELECT last_value FROM roads_test_id_seq), 1));
    ALTER TABLE \"RoadsTest\" ALTER COLUMN id SET DEFAULT nextval('\"RoadsTest_id_seq\"');" >/dev/null && echo "RoadsTest id sequence aligned"
fi
