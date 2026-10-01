import type { Workspace } from '@/api/search';
import { REAL_ESTATE_LAYERS, SERVICE_TYPE_BY_KEY, SERVICE_TYPES, type RealEstateLayerKey } from './config';
import { SERVICE_BY_KEY, serviceLabelKey } from './registry';

/**
 * What a map feature / search is about: one real-estate layer, or one service type (a `discriminator` of service_all).
 * Every icon, name, key and API mapping of a type comes from here — nowhere else.
 */
export type MapTarget =
  { kind: 'realEstate'; layer: RealEstateLayerKey } | { kind: 'service'; discriminator: string };

export const targetKey = (t: MapTarget) => (t.kind === 'realEstate' ? t.layer : t.discriminator);

export const ALL_TARGETS: MapTarget[] = [
  ...REAL_ESTATE_LAYERS.map((l): MapTarget => ({ kind: 'realEstate', layer: l.key })),
  ...SERVICE_TYPES.map((s): MapTarget => ({ kind: 'service', discriminator: s.key })),
];

const BY_KEY = new Map(ALL_TARGETS.map((t) => [targetKey(t), t]));
/** `null` for keys the map doesn't know (it can't draw or describe them). */
export const targetFromKey = (key: unknown) => (typeof key === 'string' ? (BY_KEY.get(key) ?? null) : null);

/** i18n key of the type's display name. */
export const targetLabelKey = (t: MapTarget) =>
  t.kind === 'realEstate' ? `layers.${t.layer}` : serviceLabelKey(t.discriminator);

export function targetIcon(t: MapTarget): string {
  if (t.kind === 'realEstate') return REAL_ESTATE_LAYERS.find((l) => l.key === t.layer)?.icon ?? '🏠';
  return SERVICE_TYPE_BY_KEY.get(t.discriminator)?.icon ?? '📍';
}

/** `layer` + `workspace` the search endpoints expect. */
export function targetToApi(t: MapTarget): { layer: string; workspace: Workspace } {
  if (t.kind === 'service') return { layer: t.discriminator, workspace: 'services' };
  return { layer: REAL_ESTATE_LAYERS.find((l) => l.key === t.layer)!.typeName, workspace: 'realestate' };
}

export const isTarget = (t: MapTarget, key: string) => targetKey(t) === key;

/** Rows of this type carry a price and an area: property, and the services priced like it (hotels, holiday villas). */
export const hasPrice = (t: MaybeTarget) =>
  t?.kind === 'realEstate' ||
  (t?.kind === 'service' && SERVICE_BY_KEY.get(t.discriminator)?.editProfile === 'propertyService');

/** A row's own currency wins; a hotel / villa saved before `service_all.currency` existed has none and is in dollars. */
export const priceCurrencyDefault = (t: MaybeTarget) => (t?.kind === 'service' ? 'USD' : undefined);

type MaybeTarget = MapTarget | { kind: 'location' } | null | undefined;
export const isRoadBarrier = (t: MaybeTarget) => t?.kind === 'service' && t.discriminator === 'road_barriers';
export const isFuelStation = (t: MaybeTarget) => t?.kind === 'service' && t.discriminator === 'fuel_stations';
