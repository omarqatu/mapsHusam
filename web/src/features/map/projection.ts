import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';

/** Palestine Grid — every GeoServer layer and the map view use it. Definition copied from legacy js/main.js. */
export const PALESTINE_GRID = 'EPSG:28191';

proj4.defs(
  PALESTINE_GRID,
  '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs',
);
register(proj4);

export const palestineGrid = getProjection(PALESTINE_GRID)!;

/** GPS (WGS84 lon/lat) → Palestine Grid metres. */
export function fromLonLat(lon: number, lat: number): [number, number] {
  return proj4('EPSG:4326', PALESTINE_GRID, [lon, lat]) as [number, number];
}

/** Palestine Grid metres → WGS84 [lon, lat]. */
export function toLonLat([e, n]: readonly number[]): [number, number] {
  return proj4(PALESTINE_GRID, 'EPSG:4326', [e, n]) as [number, number];
}
