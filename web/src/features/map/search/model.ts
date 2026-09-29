import type { SearchCondition, SearchOperator } from '@/api/search';
import { FUEL_FIELDS, ROAD_BARRIER_STATUS } from '../config';

export {
  ALL_TARGETS,
  targetFromKey,
  targetKey,
  targetLabelKey,
  targetToApi,
  type MapTarget as MapTarget,
} from '../targets';
import type { MapTarget as MapTarget } from '../targets';

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

/** Checkpoint statuses for pickers — derived from the one status table in config. */
export const STOP_OPTIONS = Object.entries(ROAD_BARRIER_STATUS).map(([value, s]) => ({
  value,
  labelKey: `roadStatus.${s.key}`,
  icon: s.icon,
}));
export const FUEL_OPTIONS = [
  { value: '0', labelKey: 'popup.fuel.available', icon: '✔️' },
  { value: '1', labelKey: 'popup.fuel.unavailable', icon: '❌' },
];
export { FUEL_FIELDS };

const fixed = (id: string, labelKey: string, options: FieldDef['options']): FieldDef => ({
  id,
  labelKey,
  type: 'fixed',
  options,
});

export function fieldsFor(t: MapTarget): FieldDef[] {
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
