import type { Coordinate } from './config';

/** In-app link that opens the map at a Palestine Grid point (`?x=&y=&z=` — the same format the share tool produces). */
export function mapLinkTo(center: Coordinate, zoom = 19): string {
  return `/?x=${center[0].toFixed(3)}&y=${center[1].toFixed(3)}&z=${zoom}`;
}
