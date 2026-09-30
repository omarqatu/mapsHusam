// Map configuration — typed port of legacy js/config.js (MAP_CONFIG) and js/layers.js.
// Names shown to users live in the locale files (services.<key>, layers.<key>); this file is data only.

import { SERVICE_BY_KEY, SERVICE_REGISTRY, type ServiceEntry, type ServiceTier } from './registry';

export type Coordinate = [number, number];

/** Al-Manara square, Ramallah/Al-Bireh — legacy default start point. */
export const DEFAULT_CENTER: Coordinate = [169463.41, 145767.99];
export const DEFAULT_ZOOM = 19;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 22;
/** Legacy refreshed visible data layers every minute. */
export const REFRESH_INTERVAL_MS = 60_000;
/** Legacy: ignore GPS fixes arriving faster than this while tracking. */
export const GPS_MIN_INTERVAL_MS = 10_000;
export const WFS_TIMEOUT_MS = 15_000;

export type BasemapKey = 'esri' | 'osm' | 'aerial' | 'none';
export const BASEMAPS: BasemapKey[] = ['esri', 'osm', 'aerial', 'none'];
export const DEFAULT_BASEMAP: BasemapKey = 'esri';

export type RealEstateLayerKey = 'rent' | 'sale' | 'land';

export interface WfsLayerDef {
  key: string;
  workspace: 'realestate' | 'services';
  /** GeoServer feature type (must be whitelisted in server.js isValidLayer). */
  typeName: string;
  /** Hidden when the view resolution (m/px) is above this. */
  maxResolution: number;
  zIndex: number;
}

// Legacy helper layers (Governorate, City, Location, RoadsTest) are in MAP_CONFIG.globalExclusions and never
// shown, so they are not ported. Add them here if the exclusion is lifted.
export const REAL_ESTATE_LAYERS: (WfsLayerDef & { key: RealEstateLayerKey; icon: string })[] = [
  { key: 'rent', icon: '🏠', workspace: 'realestate', typeName: 'ApartRent', maxResolution: 1, zIndex: 20 },
  { key: 'sale', icon: '🏡', workspace: 'realestate', typeName: 'ApartSale', maxResolution: 1, zIndex: 20 },
  { key: 'land', icon: '🟥', workspace: 'realestate', typeName: 'LandSale', maxResolution: 1, zIndex: 10 },
];

/** One layer holds every service; `discriminator` tells the type (legacy "service_all"). */
export const SERVICE_ALL_LAYER: WfsLayerDef = {
  key: 'services',
  workspace: 'services',
  typeName: 'service_all',
  maxResolution: 5000,
  zIndex: 30,
};

export type { ServiceTier } from './registry';
export type ServiceType = ServiceEntry;

/** Every service type the map knows (legacy serviceTranslations), from the registry. Unknown discriminators are not drawn. */
export const SERVICE_TYPES: readonly ServiceType[] = SERVICE_REGISTRY;
export const SERVICE_TYPE_BY_KEY: ReadonlyMap<string, ServiceType> = SERVICE_BY_KEY;

/** Per tier: max resolution at which the point is drawn, and below which its label is drawn (legacy values). */
export const TIER_RULES: Record<ServiceTier, { maxResolution: number; labelBelow: number }> = {
  always: { maxResolution: 5000, labelBelow: 8 },
  medium: { maxResolution: 5, labelBelow: 0.7 },
  close: { maxResolution: 1, labelBelow: 0.7 },
};

/** `stop` column of road_barriers → status (legacy getRoadBarrierStopInfo). Label text is `roadStatus.<key>`. */
export const ROAD_BARRIER_STATUS: Record<number, { key: string; color: string; icon: string }> = {
  0: { key: 'open', color: '#28a745', icon: '🟢' },
  1: { key: 'closed', color: '#dc3545', icon: '🔴' },
  2: { key: 'light', color: '#f39c12', icon: '🟠' },
  3: { key: 'heavy', color: '#8b0000', icon: '🟤' },
  4: { key: 'inspection', color: '#6f42c1', icon: '🟣' },
};
export const ROAD_BARRIER_UNKNOWN = { key: 'unknown', color: '#6c757d', icon: '⚪' };

export function roadBarrierStatus(stop: unknown) {
  const n = typeof stop === 'number' ? stop : Number.parseInt(String(stop), 10);
  return ROAD_BARRIER_STATUS[n] ?? ROAD_BARRIER_UNKNOWN;
}

/** From the least to the most serious: open < light traffic < inspection < heavy traffic < closed (legacy layers.js). */
const BARRIER_SEVERITY = [0, 2, 4, 3, 1];

const barrierCode = (v: unknown) => (typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10));

/**
 * The status the map icon shows: the worse of the two directions, so a checkpoint closed one way is not drawn green
 * because the other way is open (the card has both). A missing or unknown `stop2` leaves `stop`.
 */
export function worstBarrierStatus(stop: unknown, stop2: unknown) {
  const a = barrierCode(stop);
  const b = barrierCode(stop2);
  const rank = (n: number) => BARRIER_SEVERITY.indexOf(n);
  return roadBarrierStatus(rank(b) > rank(a) ? b : a);
}

/** Fuel availability columns of fuel_stations: 0 = available, anything else = not available. */
export const FUEL_FIELDS = ['diesel', 'banzen95', 'banzen98'] as const;
export type FuelField = (typeof FUEL_FIELDS)[number];
