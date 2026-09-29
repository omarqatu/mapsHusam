import type Geometry from 'ol/geom/Geometry';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import type OlMap from 'ol/Map';
import { DoubleClickZoom } from 'ol/interaction';

// Pure helpers behind the measure tool (legacy measure.js), testable without a map.

export type MeasureMode = 'length' | 'area' | 'point';

/** What the "draw" button of each mode asks OpenLayers for. */
export const DRAW_TYPE = { length: 'LineString', area: 'Polygon', point: 'Point' } as const;

export type MeasureResult =
  | { kind: 'length'; meters: number }
  | { kind: 'area'; squareMeters: number }
  | { kind: 'point'; easting: number; northing: number };

/**
 * Length / area / coordinates of a drawn shape. EPSG:28191 is metric (scale factor 1), so — exactly like the
 * legacy tool — this is planar geometry in metres, not geodesic.
 */
export function measureGeometry(geom: Geometry): MeasureResult | null {
  if (geom instanceof Polygon) return { kind: 'area', squareMeters: geom.getArea() };
  if (geom instanceof LineString) return { kind: 'length', meters: geom.getLength() };
  if (geom instanceof Point) {
    const [easting, northing] = geom.getCoordinates();
    return { kind: 'point', easting, northing };
  }
  return null;
}

/** Legacy precision: 3 decimals, Latin digits. */
export const formatMeasureNumber = (n: number) => n.toFixed(3);

/**
 * OpenLayers zooms in on a double click, and the same double click finishes a line/polygon — so the map
 * zooms by accident when a shape ends. Turned off while drawing (legacy toggleDoubleClickZoom).
 */
export function setDoubleClickZoom(map: OlMap, active: boolean) {
  map.getInteractions().forEach((i) => {
    if (i instanceof DoubleClickZoom) i.setActive(active);
  });
}
