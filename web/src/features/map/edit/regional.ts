import type Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { fetchWfs } from '@/api/geoserver';
import { WFS_TIMEOUT_MS, type Coordinate } from '../config';
import { PALESTINE_GRID } from '../projection';
import { INSERT_DEFAULTS } from './attributes';

/** Governorate / village / place a new feature falls in, from the `Location` polygons (legacy: "regional data"). */
export interface Regional {
  gov_a: string;
  village_a: string;
  location: string;
  /** False when no polygon contained the point (the three texts are then the "not specified" default). */
  found: boolean;
}

export const NO_REGION: Regional = {
  gov_a: INSERT_DEFAULTS.place,
  village_a: INSERT_DEFAULTS.place,
  location: INSERT_DEFAULTS.place,
  found: false,
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : INSERT_DEFAULTS.place);

/** The first `Location` polygon that contains the point, as region texts. */
export function pickRegional(locations: readonly Feature[], coordinate: Coordinate): Regional {
  for (const feature of locations) {
    const geometry = feature.getGeometry();
    if (geometry?.intersectsCoordinate(coordinate))
      return {
        gov_a: text(feature.get('gov_a')),
        village_a: text(feature.get('village_a')),
        location: text(feature.get('location')),
        found: true,
      };
  }
  return NO_REGION;
}

const geojson = new GeoJSON({ dataProjection: PALESTINE_GRID, featureProjection: PALESTINE_GRID });

/**
 * Asks GeoServer for the `Location` polygons around the point (a 2 m box) and picks the one containing it. The legacy
 * editor read whatever `Location` features the map happened to have loaded, so it worked only when that layer had been
 * drawn in the current view. Best effort: a failed request gives `NO_REGION`, never blocks saving.
 */
export async function lookupRegional(coordinate: Coordinate): Promise<Regional> {
  try {
    const [x, y] = coordinate;
    const data = await fetchWfs(
      { workspace: 'realestate', typeName: 'Location', srsName: PALESTINE_GRID, bbox: [x - 1, y - 1, x + 1, y + 1] },
      { timeoutMs: WFS_TIMEOUT_MS },
    );
    return pickRegional(geojson.readFeatures(data), coordinate);
  } catch {
    return NO_REGION;
  }
}
