import type { Coordinate } from './config';

/** `?x=..&y=..` (Palestine Grid) — the legacy share-location link format. */
export function readSharedCenter(search: string): Coordinate | null {
  const p = new URLSearchParams(search);
  const x = Number.parseFloat(p.get('x') ?? '');
  const y = Number.parseFloat(p.get('y') ?? '');
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** `?z=..` zoom of a shared-location link (share tool); null when absent or not a number. */
export function readSharedZoom(search: string): number | null {
  const z = Number.parseFloat(new URLSearchParams(search).get('z') ?? '');
  return Number.isFinite(z) ? z : null;
}

/** Palestine Grid label. 2 decimals for the pointer bar (legacy), 3 where a point is shared/copied (legacy share tool). */
export function formatGrid([e, n]: readonly number[], decimals = 2) {
  return `E: ${e.toFixed(decimals)}, N: ${n.toFixed(decimals)}`;
}

/** GPS for people who paste into Google Maps / WhatsApp: "lat, lon" with 6 decimals (~10 cm). */
export function formatLatLon([lon, lat]: readonly number[]) {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/** i18n key for a geolocation failure (legacy getGeolocationErrorMessage). */
export function geolocationErrorKey(code: number | undefined, secure: boolean) {
  if (!secure) return 'map.gps.insecure';
  if (code === 1) return 'map.gps.denied';
  if (code === 2) return 'map.gps.unavailable';
  if (code === 3) return 'map.gps.timeout';
  return 'map.gps.failed';
}
