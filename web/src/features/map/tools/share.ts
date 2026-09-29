import { locationShareLink } from '../popup/featureModel';
import { formatGrid } from '../mapUtils';
import { toLonLat } from '../projection';

// Pure helpers behind the share-location tool (legacy share-location.js), testable without a map.

/** Palestine Grid with 3 decimals (legacy share tool). */
export const gridDisplay = (coord: readonly number[]) => formatGrid(coord, 3);

/** Same point for pasting into ArcGIS Pro: `E,N`. */
export function gridClipboard([e, n]: readonly number[]) {
  return `${e.toFixed(3)},${n.toFixed(3)}`;
}

/** WGS84 [lat, lon] of a Palestine Grid point. */
export function wgsLatLon(coord: readonly number[]): [number, number] {
  const [lon, lat] = toLonLat(coord);
  return [lat, lon];
}

/** WGS84, shown as typed in legacy: `Lat: 31.952000 , Lon: 35.233000`. */
export function wgsDisplay(coord: readonly number[]) {
  const [lat, lon] = wgsLatLon(coord);
  return `Lat: ${lat.toFixed(6)} , Lon: ${lon.toFixed(6)}`;
}

/** Same point for pasting into Google Maps: `lat,lon`. */
export function wgsClipboard(coord: readonly number[]) {
  const [lat, lon] = wgsLatLon(coord);
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function googleMapsLink(coord: readonly number[]) {
  return `https://www.google.com/maps?q=${wgsClipboard(coord)}`;
}

/** `?x=&y=&z=` link of the current page: coordinates to 3 decimals, zoom rounded (legacy format). */
export function shareLink(origin: string, pathname: string, coord: readonly number[], zoom: number) {
  const round3 = (n: number) => Number(n.toFixed(3));
  return locationShareLink(origin, pathname, [round3(coord[0]), round3(coord[1])], Math.round(zoom));
}
