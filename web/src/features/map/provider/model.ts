import type { ProviderServiceResponse, ProviderStatus } from '@/api/provider';
import { GPS_MIN_INTERVAL_MS, REAL_ESTATE_LAYERS, SERVICE_ALL_LAYER, type Coordinate } from '../config';
import { targetFromKey, type MapTarget } from '../targets';

// Pure rules of the provider panel (legacy js/provider-panel.js), testable without React or a map.

/** After a successful update the buttons stay locked this long (legacy 10 s, client side only). */
export const COOLDOWN_SECONDS = 10;
/** Live tracking sends the phone's position this often (legacy `setInterval` 10 s). */
export const LIVE_INTERVAL_MS = GPS_MIN_INTERVAL_MS;

export const AVAILABLE: ProviderStatus = 0;
export const BUSY: ProviderStatus = 1;

/** The feature the provider account is linked to. */
export interface ProviderService {
  /** Value to send back to the server as `service_layer`. */
  layer: string;
  featureId: number;
  status: ProviderStatus;
  /** Last saved position (Palestine Grid) — `null` when the row has none. */
  location: Coordinate | null;
}

/** What `GET /api/get-provider-service` means for the panel. */
export type ProviderAccount =
  /** Not linked to any feature (or the server says there is nothing to show). */
  | { kind: 'unlinked' }
  /** Linked, but an admin froze the account (`users.status` ≠ 0). */
  | { kind: 'frozen' }
  | { kind: 'ready'; service: ProviderService };

/** Legacy: anything but 0 counts as "busy" (hidden). */
export const toStatus = (v: unknown): ProviderStatus =>
  v !== null && v !== '' && Number(v) === 0 ? AVAILABLE : BUSY;

/** A position the server would accept: both numbers, easting above 100 000 m (server + legacy rule). */
export function validLocation(x: unknown, y: unknown): Coordinate | null {
  const e = x === null || x === '' ? NaN : Number(x);
  const n = y === null || y === '' ? NaN : Number(y);
  return Number.isFinite(e) && Number.isFinite(n) && e > 100_000 ? [e, n] : null;
}

/** Legacy sent metres with two decimals (centimetres). */
export const roundGrid = ([x, y]: Coordinate): Coordinate => [
  Number(x.toFixed(2)),
  Number(y.toFixed(2)),
];

export function interpretService(res: ProviderServiceResponse): ProviderAccount {
  if (!res.success || !res.service) return { kind: 'unlinked' };
  if (res.user_status !== 0) return { kind: 'frozen' };
  const s = res.service;
  return {
    kind: 'ready',
    service: {
      layer: s.service_layer,
      featureId: Number(s.feature_id),
      status: toStatus(s.status),
      location: validLocation(s.x_coord, s.y_coord),
    },
  };
}

/** The map target of the linked feature: a service type, or one of the three real-estate layers. `null` if the map can't draw it. */
export function providerTarget(layer: string): MapTarget | null {
  const realEstate = REAL_ESTATE_LAYERS.find((l) => l.typeName === layer);
  if (realEstate) return { kind: 'realEstate', layer: realEstate.key };
  const target = targetFromKey(layer);
  return target?.kind === 'service' ? target : null;
}

/** `key` of the map's data layer that draws this target (set by `createWfsLayer`). */
export const dataLayerKey = (t: MapTarget) => (t.kind === 'realEstate' ? t.layer : SERVICE_ALL_LAYER.key);
