import type { Coordinate } from './config';

/** `?x=..&y=..` (Palestine Grid) — the legacy share-location link format. */
export function readSharedCenter(search: string): Coordinate | null {
  const p = new URLSearchParams(search);
  const x = Number.parseFloat(p.get('x') ?? '');
  const y = Number.parseFloat(p.get('y') ?? '');
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

export function formatGrid([e, n]: readonly number[]) {
  return `E: ${e.toFixed(2)}, N: ${n.toFixed(2)}`;
}

/** i18n key for a geolocation failure (legacy getGeolocationErrorMessage). */
export function geolocationErrorKey(code: number | undefined, secure: boolean) {
  if (!secure) return 'map.gps.insecure';
  if (code === 1) return 'map.gps.denied';
  if (code === 2) return 'map.gps.unavailable';
  if (code === 3) return 'map.gps.timeout';
  return 'map.gps.failed';
}
