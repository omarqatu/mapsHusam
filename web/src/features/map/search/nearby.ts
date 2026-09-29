import type { Coordinate } from '../config';
import { FUEL_FIELDS, type SearchTarget } from './model';
import type { SearchResult } from './results';

export interface NearbyExtra {
  /** Road checkpoint status (inbound `stop`), one value. '' = any. */
  stop: string;
  /** Fuel availability per fuel: '' = don't care, '0' = available, '1' = not available. All chosen must hold (AND). */
  fuel: Record<(typeof FUEL_FIELDS)[number], string>;
}
export const EMPTY_EXTRA: NearbyExtra = { stop: '', fuel: { diesel: '', banzen95: '', banzen98: '' } };

/** Legacy applyExtraFilters — barrier status only looks at `stop` (inbound), fuel filters are AND-ed. */
export function applyExtraFilters(
  results: SearchResult[],
  target: SearchTarget,
  extra: NearbyExtra,
): SearchResult[] {
  if (target.kind !== 'service') return results;
  if (target.discriminator === 'road_barriers' && extra.stop !== '')
    return results.filter((r) => String(r.props.stop) === extra.stop);
  if (target.discriminator === 'fuel_stations') {
    const active = FUEL_FIELDS.filter((f) => extra.fuel[f] !== '');
    if (active.length)
      return results.filter((r) => active.every((f) => String(r.props[f]) === extra.fuel[f]));
  }
  return results;
}

export const MAX_RADIUS_M = 50_000;

export type NearbyOutcome =
  { ok: true; results: SearchResult[]; radius: number | null } | { ok: false; reason: 'invalidRadius' };

const dist = (a: Coordinate, b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Legacy radius rules (metres, EPSG:28191 is metric):
 *  - empty     → the single closest match
 *  - 0         → features that contain the point (polygons) / sit exactly on it
 *  - positive  → everything within that distance of the feature's nearest point
 * Results are sorted nearest first and carry `distance` (legacy sorted by rating; distance is what a "near me" list needs).
 */
export function findNearby(
  all: SearchResult[],
  target: SearchTarget,
  center: Coordinate,
  radiusText: string,
  extra: NearbyExtra,
): NearbyOutcome {
  const text = radiusText.trim();
  const radius = text === '' ? null : Number(text);
  if (radius !== null && (!Number.isFinite(radius) || radius < 0 || radius > MAX_RADIUS_M))
    return { ok: false, reason: 'invalidRadius' };

  const withDistance = applyExtraFilters(all, target, extra).map((r) => ({
    ...r,
    distance: dist(center, r.geometry.getClosestPoint(center)),
  }));
  let picked: SearchResult[];
  if (radius === null) {
    picked = withDistance.length
      ? [
          withDistance.reduce((best, r) =>
            (r.distance ?? Infinity) < (best.distance ?? Infinity) ? r : best,
          ),
        ]
      : [];
  } else if (radius === 0) {
    picked = withDistance.filter((r) => r.geometry.intersectsCoordinate(center));
  } else {
    picked = withDistance.filter((r) => (r.distance ?? Infinity) <= radius);
  }
  picked.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return { ok: true, results: picked, radius };
}
