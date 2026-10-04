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

/** 1 dunam = 1000 m² — the unit land is read in here (same constant as the water platform). */
export const SQUARE_METERS_PER_DUNAM = 1000;

type T = (key: string, opts?: Record<string, unknown>) => string;
const latin = (n: number, digits: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** «850 م» under a kilometre, «3.42 كم» from one (water platform formatLengthM). */
export function formatLength(meters: number, t: T): string {
  return Math.round(meters) >= 1000
    ? t('measure.lengthKm', { value: latin(meters / 1000, 2) })
    : t('measure.lengthM', { value: latin(Math.round(meters), 0) });
}

/** «850 م² (0.85 دونم)», from 1 ha «12.40 كم² (12,400 دونم)» (water platform formatAreaM2). */
export function formatArea(squareMeters: number, t: T): string {
  const dunams = squareMeters / SQUARE_METERS_PER_DUNAM;
  if (squareMeters >= 10_000)
    return t('measure.areaKm2', {
      km2: latin(squareMeters / 1_000_000, 2),
      dunams: latin(Math.round(dunams), 0),
    });
  return t('measure.areaM2', {
    m2: latin(Math.round(squareMeters), 0),
    dunams: dunams.toLocaleString('en-US', { maximumFractionDigits: 2 }),
  });
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
