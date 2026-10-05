import type { RealEstateLayerKey } from '../map/config';
import { SERVICE_BY_KEY } from '../map/registry';
import { targetKey, type MapTarget } from '../map/targets';

// "Services for this property": which kinds of provider a property card offers (a land: surveyor, valuer, lawyer…).
// The list is data, not code: the admin can change it (platform_content `settings.propertyServices`, JSON
// `{ "land": ["land_surveyors", …] }`), and this default applies until someone does. A property kind with no entry
// shows nothing — land is the first kind (owner, 2026-10-05); flats come once this proves useful.

export const PROPERTY_SERVICES_KEY = 'settings.propertyServices';

export type PropertyServicesConfig = Partial<Record<RealEstateLayerKey, string[]>>;

const KINDS: readonly RealEstateLayerKey[] = ['rent', 'sale', 'land'];
/** A card is not a market: a few types per kind, the ones people reach for at the moment they decide. */
export const MAX_TYPES = 5;

export const DEFAULT_PROPERTY_SERVICES: PropertyServicesConfig = {
  land: ['land_surveyors', 'real_estate_valuers', 'lawyers'],
};

/** Stored text → config; anything unknown (a kind, a service type) is dropped, so a stale or hand-edited value is harmless. */
export function parsePropertyServices(raw: string | null | undefined): PropertyServicesConfig {
  if (!raw) return DEFAULT_PROPERTY_SERVICES;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_PROPERTY_SERVICES;
  }
  if (!data || typeof data !== 'object') return DEFAULT_PROPERTY_SERVICES;
  const out: PropertyServicesConfig = {};
  for (const kind of KINDS) {
    const list = (data as Record<string, unknown>)[kind];
    if (!Array.isArray(list)) continue;
    const types = [...new Set(list.filter((k): k is string => typeof k === 'string' && SERVICE_BY_KEY.has(k)))];
    if (types.length) out[kind] = types.slice(0, MAX_TYPES);
  }
  return out;
}

export const serializePropertyServices = (c: PropertyServicesConfig) => JSON.stringify(c);

/** The service types offered on this listing's card (empty for anything but a configured property kind). */
export function servicesFor(config: PropertyServicesConfig, target: MapTarget | null | undefined): string[] {
  if (!target || target.kind !== 'realEstate') return [];
  return config[targetKey(target) as RealEstateLayerKey] ?? [];
}
