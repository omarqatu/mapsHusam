import type { Extent } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import type { StyleLike } from 'ol/style/Style';
import type BaseLayer from 'ol/layer/Base';
import { fetchWfs } from '@/api/geoserver';
import { WFS_TIMEOUT_MS, type BasemapKey, type WfsLayerDef } from './config';
import { PALESTINE_GRID } from './projection';

export function createBasemaps(): Record<BasemapKey, BaseLayer | null> {
  return {
    esri: new TileLayer({
      zIndex: 0,
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }),
    }),
    osm: new TileLayer({ zIndex: 0, source: new OSM() }),
    // 2023 aerial photo, served by our GeoServer in the native grid.
    aerial: new TileLayer({
      zIndex: 0,
      source: new TileWMS({
        url: '/geoserver-proxy/madeenati/wms',
        params: { LAYERS: 'madeenati:WB_2023_10_18mbt', FORMAT: 'image/jpeg', TILED: true },
        projection: PALESTINE_GRID,
        serverType: 'geoserver',
        crossOrigin: 'anonymous',
      }),
    }),
    none: null,
  };
}

const geojson = new GeoJSON({ dataProjection: PALESTINE_GRID, featureProjection: PALESTINE_GRID });

/** Vector layer loaded from GeoServer WFS by view extent (legacy createWFSLayer). */
export function createWfsLayer(
  def: WfsLayerDef,
  style: StyleLike,
  onError?: (def: WfsLayerDef, err: unknown) => void,
) {
  const source = new VectorSource({
    strategy: bboxStrategy,
    loader(extent: Extent, _resolution, _projection, success, failure) {
      fetchWfs(
        { workspace: def.workspace, typeName: def.typeName, srsName: PALESTINE_GRID, bbox: extent },
        { timeoutMs: WFS_TIMEOUT_MS },
      )
        .then((data) => {
          const features = geojson.readFeatures(data);
          source.addFeatures(features);
          success?.(features);
        })
        .catch((err: unknown) => {
          // Unlike legacy, report the failure so OpenLayers retries this extent on the next move.
          failure?.();
          if (!(err instanceof DOMException && err.name === 'AbortError')) onError?.(def, err);
        });
    },
  });

  const layer = new VectorLayer({
    source,
    style,
    zIndex: def.zIndex,
    maxResolution: def.maxResolution,
    // Overlapping labels are hidden instead of drawn on top of each other (legacy drew them all).
    // Icons are marked as obstacles in styles.ts, so markers never disappear — only labels do.
    declutter: true,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
  });
  layer.set('key', def.key);
  return layer;
}
