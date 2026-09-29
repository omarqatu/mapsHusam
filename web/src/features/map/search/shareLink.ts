import type { SearchCondition } from '@/api/search';
import type { Coordinate } from '../config';
import type { NearbyExtra } from './nearby';

// "Copy results link" / ?resultsShare= — a link that re-runs a search. The state is small JSON, encoded as base64url.
// Links come from strangers: decoding validates the shape and returns null for anything unexpected.

export type ShareState =
  | { type: 'quick'; target: string; bbox?: string }
  | { type: 'attribute'; target: string; conditions: SearchCondition[] }
  | { type: 'location'; target: string; center: Coordinate; radius: string; extra?: NearbyExtra };

const OPERATORS = ['=', 'contains', '>', '<'];

export function encodeShareState(state: ShareState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const isCoordinate = (v: unknown): v is Coordinate =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const isBbox = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.split(',').length === 4 &&
  v.split(',').every((n) => n !== '' && Number.isFinite(Number(n)));
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function readExtra(v: unknown): NearbyExtra | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as { stop?: unknown; fuel?: Record<string, unknown> };
  return {
    stop: str(o.stop),
    fuel: { diesel: str(o.fuel?.diesel), banzen95: str(o.fuel?.banzen95), banzen98: str(o.fuel?.banzen98) },
  };
}

export function decodeShareState(raw: string | null): ShareState | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const o: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    if (!o || typeof o !== 'object') return null;
    const s = o as Record<string, unknown>;
    if (typeof s.target !== 'string') return null;
    if (s.type === 'quick')
      return { type: 'quick', target: s.target, bbox: isBbox(s.bbox) ? s.bbox : undefined };
    if (s.type === 'attribute' && Array.isArray(s.conditions)) {
      const conditions = s.conditions.filter(
        (c): c is SearchCondition =>
          !!c && typeof c.field === 'string' && typeof c.value === 'string' && OPERATORS.includes(c.operator),
      );
      return { type: 'attribute', target: s.target, conditions };
    }
    if (s.type === 'location' && isCoordinate(s.center))
      return {
        type: 'location',
        target: s.target,
        center: s.center,
        radius: str(s.radius),
        extra: readExtra(s.extra),
      };
  } catch {
    /* not base64 / not JSON */
  }
  return null;
}

export function buildShareLink(state: ShareState, origin: string, pathname: string): string {
  return `${origin}${pathname}?resultsShare=${encodeShareState(state)}`;
}
