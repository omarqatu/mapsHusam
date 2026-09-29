import type { SearchCondition, SearchOperator, Workspace } from '@/api/search';
import { REAL_ESTATE_LAYERS, SERVICE_TYPES, type RealEstateLayerKey } from '../config';

/** What a search runs against: one real-estate layer or one service type (discriminator of service_all). */
export type SearchTarget =
  { kind: 'realEstate'; layer: RealEstateLayerKey } | { kind: 'service'; discriminator: string };

export const targetKey = (t: SearchTarget) => (t.kind === 'realEstate' ? t.layer : t.discriminator);

export const ALL_TARGETS: SearchTarget[] = [
  ...REAL_ESTATE_LAYERS.map((l): SearchTarget => ({ kind: 'realEstate', layer: l.key })),
  ...SERVICE_TYPES.map((s): SearchTarget => ({ kind: 'service', discriminator: s.key })),
];

const TARGET_BY_KEY = new Map(ALL_TARGETS.map((t) => [targetKey(t), t]));
export const targetFromKey = (key: string) => TARGET_BY_KEY.get(key) ?? null;

/** i18n key of the type's display name. */
export const targetLabelKey = (t: SearchTarget) =>
  t.kind === 'realEstate' ? `layers.${t.layer}` : `services.${t.discriminator}`;

/** `layer` + `workspace` params the search endpoints expect. */
export function targetToApi(t: SearchTarget): { layer: string; workspace: Workspace } {
  if (t.kind === 'service') return { layer: t.discriminator, workspace: 'services' };
  const layer = REAL_ESTATE_LAYERS.find((l) => l.key === t.layer)!;
  return { layer: layer.typeName, workspace: 'realestate' };
}

// --- fields the smart search offers per target (legacy fieldsConfig) -------------------------
export type FieldType = 'dropdown' | 'number' | 'fixed';
export interface FieldDef {
  id: string;
  /** i18n key */
  labelKey: string;
  type: FieldType;
  /** `fixed` fields: value → i18n label key (+ emoji). */
  options?: { value: string; labelKey: string; icon: string }[];
}

const dd = (id: string, labelKey = `search.fields.${id}`): FieldDef => ({ id, labelKey, type: 'dropdown' });
const num = (id: string): FieldDef => ({ id, labelKey: `search.fields.${id}`, type: 'number' });

export const STOP_OPTIONS = [
  { value: '0', labelKey: 'roadStatus.open', icon: '🟢' },
  { value: '1', labelKey: 'roadStatus.closed', icon: '🔴' },
  { value: '2', labelKey: 'roadStatus.light', icon: '🟠' },
  { value: '3', labelKey: 'roadStatus.heavy', icon: '🟤' },
  { value: '4', labelKey: 'roadStatus.inspection', icon: '🟣' },
];
export const FUEL_OPTIONS = [
  { value: '0', labelKey: 'popup.fuel.available', icon: '✔️' },
  { value: '1', labelKey: 'popup.fuel.unavailable', icon: '❌' },
];
export const FUEL_FIELDS = ['diesel', 'banzen95', 'banzen98'] as const;

const fixed = (id: string, labelKey: string, options: FieldDef['options']): FieldDef => ({
  id,
  labelKey,
  type: 'fixed',
  options,
});

export function fieldsFor(t: SearchTarget): FieldDef[] {
  if (t.kind === 'realEstate')
    return [dd('gov_a'), dd('village_a'), dd('location'), num('price'), num('area')];
  const base = [dd('gov_a'), dd('village_a'), dd('location_name')];
  if (t.discriminator === 'road_barriers') {
    return [
      ...base,
      dd('name', 'search.fields.barrierName'),
      fixed('stop', 'search.fields.stopIn', STOP_OPTIONS),
      fixed('stop2', 'search.fields.stopOut', STOP_OPTIONS),
    ];
  }
  if (t.discriminator === 'fuel_stations') {
    return [
      ...base,
      dd('name', 'search.fields.stationName'),
      ...FUEL_FIELDS.map((f) => fixed(f, `popup.fuel.${f}`, FUEL_OPTIONS)),
    ];
  }
  return [...base, dd('name')];
}

/** Operators that make sense for a field type. `>`/`<` are inclusive on the server, so they are labelled ≥ / ≤. */
export function operatorsFor(type: FieldType): SearchOperator[] {
  if (type === 'number') return ['=', '>', '<'];
  if (type === 'fixed') return ['='];
  return ['=', 'contains'];
}
export const OPERATOR_SYMBOL: Record<SearchOperator, string> = {
  '=': '=',
  contains: '⊃',
  '>': '≥',
  '<': '≤',
};

/** Cascade: town depends on governorate; place/name depend on both (legacy getUniqueValues). */
export function cascadeFilters(
  fieldId: string,
  conditions: SearchCondition[],
): { gov_a?: string; village_a?: string } {
  const gov = conditions.find((c) => c.field === 'gov_a')?.value;
  const village = conditions.find((c) => c.field === 'village_a')?.value;
  const out: { gov_a?: string; village_a?: string } = {};
  if (fieldId !== 'gov_a' && gov) out.gov_a = gov;
  if (['location', 'location_name', 'name'].includes(fieldId) && village) out.village_a = village;
  return out;
}

/** Choosing a price also constrains the currency when one is picked (legacy appended a currency condition). */
export function withCurrency(field: string, condition: SearchCondition, currency: string): SearchCondition[] {
  return field === 'price' && currency
    ? [condition, { field: 'currency', operator: '=', value: currency }]
    : [condition];
}
