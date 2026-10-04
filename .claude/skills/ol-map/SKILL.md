---
name: ol-map
description: OpenLayers in React for the PSM map — map instance, EPSG:28191 projection, GeoServer WMS/WFS layers through /geoserver-proxy, popups, measure, draw/modify editing. Use for any change that touches the map or its layers.
---

# OpenLayers map in React

## Why OpenLayers (not MapLibre)

Data is in **EPSG:28191 (Palestine Grid)** and served by GeoServer as WMS/WFS. OpenLayers handles
both natively with proj4; MapLibre is Web-Mercator only. Keep OpenLayers.

## Shape

```
web/src/features/map/
  MapProvider.tsx      # creates ONE ol/Map, exposes it via context (useMap())
  MapView.tsx          # the <div ref> target; setTarget on mount, setTarget(undefined) on unmount
  projection.ts        # proj4.defs('EPSG:28191', ...) + register(proj4) — copy defs from js/config.js / proj4/
  layers/registry.ts   # typed port of js/layers.js (key, title, workspace, type, minZoom, style)
  layers/useLayer.ts   # adds a layer on mount, removes on unmount, syncs visible/opacity
  store.ts             # Zustand: visible layers, opacity, active tool — UI state only
  tools/{measure,draw,modify,share}.ts(x)
  popup/FeaturePopup.tsx   # ol/Overlay positioned, content rendered by React (portal)
```

Rules:
- **One map instance**, created in a ref/`useState(() => new Map(...))`, never re-created on
  re-render. Every `useEffect` that adds a layer/interaction/listener removes it in its cleanup
  (`map.removeLayer`, `map.removeInteraction`, `unByKey`).
- Layer definitions are data (`registry.ts`), not code scattered across components. Port
  `js/layers.js` + `MAP_CONFIG` (`js/config.js`) into it with types; keep `globalExclusions` and
  `rolePermissions` semantics.
- All GeoServer URLs are relative: `/geoserver-proxy/<workspace>/wms` / `/wfs`. Never a GeoServer
  host. The server whitelists layer names — a new service type goes in `shared/service-types.json`, any other layer in `OTHER_LAYERS` of `server/layers.js`.
- Feature attributes shown in popups are rendered as JSX text (XSS). Links (e.g. WhatsApp) are built
  with `new URL()` / `encodeURIComponent`, never string-concatenated into HTML.
- Search results come from `/api/search-features` (PostGIS), not from WFS filters in the browser.
- Mobile: the map must survive container resize — call `map.updateSize()` from a `ResizeObserver`.

## Editing (admin)

Legacy editing (`edit-core.js`, `edit-wfs.js`, `editLines.js`, `editPolygons.js`) posts WFS-T to
GeoServer with credentials typed by the user. Port the **interactions** (Draw/Modify/Snap/Select,
attribute modal) as-is, but isolate the transport in one function `saveFeature(tx)` in
`features/map/edit/transport.ts`, so it can later be switched to a server endpoint without touching
the UI. Don't store the GeoServer password anywhere (no store, no storage).

## Verify

Unit-test pure parts (registry filtering, style functions, coordinate formatting). For the rest run
the app against the real backend + GeoServer: layers draw at the right place, popup opens, measure
reads metres, editing round-trips.
