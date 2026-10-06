---
applyTo: "web/src/features/map/**,web/src/api/geoserver.ts"
---
# OpenLayers map

Data is in EPSG:28191 (Palestine Grid), served by GeoServer as WMS/WFS. OpenLayers handles that with proj4; keep it.

- One `ol/Map` instance, created once (ref or `useState(() => new Map(...))`), never on re-render. Every effect that adds a
  layer, interaction or listener removes it in its cleanup (`map.removeLayer`, `map.removeInteraction`, `unByKey`).
- Layer definitions are data (`config.ts`, `registry/`), not code scattered across components.
- GeoServer URLs are relative: `/geoserver-proxy/<workspace>/wms` and `/wfs`. Never a GeoServer host. The server whitelists
  layer names: a new service type goes in `shared/service-types.json`, any other layer in `OTHER_LAYERS` of `server/layers.js`.
- Feature attributes in popups are rendered as JSX text. Links (WhatsApp, tel) are built with `new URL()` and
  `encodeURIComponent`, never concatenated into HTML.
- Search results come from `/api/search-features` (PostGIS), not from WFS filters in the browser.
- The map must survive container resize: call `map.updateSize()` from a `ResizeObserver`.
- Marker icons are drawn from the same lucide icon as the UI (`iconSvg.ts`, `typeMarker` in `styles.ts`), never an emoji.
- Editing (admin) keeps the WFS-T transport in one function (`features/map/edit/transport.ts`); never store the GeoServer
  password anywhere.
- Unit-test the pure parts (registry filtering, style functions, coordinate formatting).
