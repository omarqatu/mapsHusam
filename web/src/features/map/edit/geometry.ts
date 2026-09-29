import type OlGeometry from 'ol/geom/Geometry';
import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import type { Coordinate } from '../config';
import type { StoredGeometry } from './schema';

// Pure geometry helpers of the editor (no map needed): OpenLayers geometry -> plain data in EPSG:28191 that the
// transport can serialise, rounding, and the checks run before anything is sent.

export type Position = [number, number];
export type GeometryData =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

/** Grid metres are stored to the millimetre — enough for the data, and no `169463.41000000003` in requests. */
export const GRID_DECIMALS = 3;

/** Number as fixed-decimals text without a negative zero ("-0.00"). */
export function fixed(n: number, decimals: number): string {
  const s = n.toFixed(decimals);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/** Rounded number (see `fixed`). Used for the coordinate columns: grid 2 dp, WGS84 6 dp. */
export const round = (n: number, decimals: number) => Number(fixed(n, decimals));

const roundPos = (c: readonly number[]): Position => [round(c[0], GRID_DECIMALS), round(c[1], GRID_DECIMALS)];
const sameXY = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

/** A polygon ring always ends where it starts (OpenLayers keeps it closed, but data from other code may not). */
function closeRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  return sameXY(ring[0], ring[ring.length - 1]) ? ring : [...ring, ring[0]];
}

const ringsOf = (polygon: Polygon | number[][][]) =>
  (Array.isArray(polygon) ? polygon : polygon.getCoordinates()).map((r) => closeRing(r.map(roundPos)));

/**
 * The drawn/edited OpenLayers geometry as the geometry type the table stores: a LineString becomes a MultiLineString,
 * a Polygon becomes a MultiPolygon for `Location`. Returns `null` when the shape cannot be stored (a multi-part polygon
 * for a single-polygon table, or a type that does not belong to the layer).
 */
export function toGeometryData(geom: OlGeometry, stored: StoredGeometry): GeometryData | null {
  if (geom instanceof Point && stored === 'Point')
    return { type: 'Point', coordinates: roundPos(geom.getCoordinates()) };
  if (stored === 'MultiLineString') {
    if (geom instanceof LineString)
      return { type: 'MultiLineString', coordinates: [geom.getCoordinates().map(roundPos)] };
    if (geom instanceof MultiLineString)
      return { type: 'MultiLineString', coordinates: geom.getCoordinates().map((l) => l.map(roundPos)) };
    return null;
  }
  if (stored === 'Polygon') {
    if (geom instanceof Polygon) return { type: 'Polygon', coordinates: ringsOf(geom) };
    if (geom instanceof MultiPolygon && geom.getPolygons().length === 1)
      return { type: 'Polygon', coordinates: ringsOf(geom.getPolygon(0)) };
    return null;
  }
  if (stored === 'MultiPolygon') {
    if (geom instanceof Polygon) return { type: 'MultiPolygon', coordinates: [ringsOf(geom)] };
    if (geom instanceof MultiPolygon)
      return { type: 'MultiPolygon', coordinates: geom.getCoordinates().map(ringsOf) };
    return null;
  }
  return null;
}

// --- validation ---------------------------------------------------------------------------------

export type GeometryError =
  'invalidCoordinates' | 'outOfBounds' | 'lineTooShort' | 'ringTooShort' | 'ringNoArea' | 'selfIntersecting';

/** Generous box around the Palestine Grid; anything outside is a mis-click or a broken projection, never data. */
const BOUNDS = { minX: -50_000, maxX: 450_000, minY: -100_000, maxY: 500_000 };

const inBounds = ([x, y]: Position) =>
  x >= BOUNDS.minX && x <= BOUNDS.maxX && y >= BOUNDS.minY && y <= BOUNDS.maxY;

function cross(o: Position, a: Position, b: Position) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Proper crossing of two segments (touching at an end point does not count). */
function segmentsCross(a: Position, b: Position, c: Position, d: Position) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function ringArea(ring: Position[]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(sum) / 2;
}

function ringError(ring: Position[]): GeometryError | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return 'ringTooShort';
  const distinct = new Set(closed.slice(0, -1).map((p) => `${p[0]},${p[1]}`));
  if (distinct.size < 3) return 'ringNoArea';
  const n = closed.length - 1; // segments
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbours share a vertex
      if (segmentsCross(closed[i], closed[i + 1], closed[j], closed[j + 1])) return 'selfIntersecting';
    }
  // Checked after the crossings: a bow-tie's two lobes cancel to a signed area of exactly 0.
  return ringArea(closed) === 0 ? 'ringNoArea' : null;
}

/** First problem that makes the shape unfit to store, or `null` when it is fine. */
export function validateGeometry(g: GeometryData): GeometryError | null {
  const all: Position[] =
    g.type === 'Point'
      ? [g.coordinates]
      : g.type === 'MultiLineString'
        ? g.coordinates.flat()
        : g.type === 'Polygon'
          ? g.coordinates.flat()
          : g.coordinates.flat(2);
  if (all.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return 'invalidCoordinates';
  if (!all.every(inBounds)) return 'outOfBounds';

  if (g.type === 'MultiLineString') {
    for (const line of g.coordinates) {
      const distinct = new Set(line.map((p) => `${p[0]},${p[1]}`));
      if (line.length < 2 || distinct.size < 2) return 'lineTooShort';
    }
  } else if (g.type === 'Polygon') {
    for (const ring of g.coordinates) {
      const e = ringError(ring);
      if (e) return e;
    }
  } else if (g.type === 'MultiPolygon') {
    for (const polygon of g.coordinates)
      for (const ring of polygon) {
        const e = ringError(ring);
        if (e) return e;
      }
  }
  return null;
}

/** The point used to find the region a shape lies in (legacy: first vertex of a line, interior point of a polygon). */
export function representativePoint(g: GeometryData): Coordinate {
  if (g.type === 'Point') return g.coordinates;
  if (g.type === 'MultiLineString') return g.coordinates[0][0];
  const polygon = g.type === 'Polygon' ? g.coordinates : g.coordinates[0];
  const [x, y] = new Polygon(polygon).getInteriorPoint().getCoordinates();
  return [x, y];
}
