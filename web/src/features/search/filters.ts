import type { SearchCondition, SearchOperator } from '@/api/search';
import { fieldsFor, type FieldDef } from '../map/search/model';
import type { MapTarget } from '../map/targets';

// Filter state of the search page. The page keeps it in the URL as a list of conditions (the same `SearchCondition`
// the map's smart search sends), so this module only converts between "what the inputs show" and "what the server gets".

export interface FilterValue {
  value: string;
  /** Number fields only (price, area). Legacy offered ≤ and ≥ and started with ≤. */
  operator?: SearchOperator;
}
export interface FilterState {
  values: Record<string, FilterValue>;
  /** Price currency (USD / ILS / JOD), '' = any. */
  currency: string;
}
export const EMPTY_FILTERS: FilterState = { values: {}, currency: '' };

export const DEFAULT_RANGE_OPERATOR: SearchOperator = '<';
export const RANGE_OPERATORS: SearchOperator[] = ['<', '>'];
export const CURRENCIES = ['USD', 'ILS', 'JOD'] as const;

/** The filter inputs of a type, in display order (legacy searchFieldsConfig — same list as the map's smart search). */
export const filterFields = (target: MapTarget): FieldDef[] => fieldsFor(target);

/** Conditions for the server: one per filled field, price adds the currency (legacy appended it right after). */
export function toConditions(state: FilterState, fields: FieldDef[]): SearchCondition[] {
  const out: SearchCondition[] = [];
  for (const f of fields) {
    const v = state.values[f.id];
    const value = v?.value.trim() ?? '';
    if (value) {
      const operator = f.type === 'number' ? (v.operator ?? DEFAULT_RANGE_OPERATOR) : '=';
      out.push({ field: f.id, operator, value });
    }
    // Legacy filtered by currency even without an amount ("everything priced in shekels").
    if (f.id === 'price' && state.currency)
      out.push({ field: 'currency', operator: '=', value: state.currency });
  }
  return out;
}

/** Inverse of `toConditions` (a shared link or the back button brings conditions, the inputs need values). */
export function fromConditions(conditions: SearchCondition[]): FilterState {
  const values: Record<string, FilterValue> = {};
  let currency = '';
  for (const c of conditions) {
    if (c.field === 'currency') currency = c.value;
    else values[c.field] = c.operator === '>' || c.operator === '<' ? { value: c.value, operator: c.operator } : { value: c.value };
  }
  return { values, currency };
}

/**
 * Change one input. Choosing a governorate / town empties the pickers after it that depend on it (legacy reset every
 * dropdown after the changed one); fixed lists (checkpoint status, fuel) and numbers are left alone.
 */
export function setFilter(
  state: FilterState,
  fields: FieldDef[],
  fieldId: string,
  next: FilterValue | null,
): FilterState {
  const values = { ...state.values };
  if (next && next.value !== '') values[fieldId] = next;
  else delete values[fieldId];
  const index = fields.findIndex((f) => f.id === fieldId);
  if (index >= 0 && fields[index].type === 'dropdown' && (fieldId === 'gov_a' || fieldId === 'village_a')) {
    for (const f of fields.slice(index + 1)) if (f.type === 'dropdown') delete values[f.id];
  }
  return { ...state, values };
}

export const countActive = (state: FilterState) =>
  Object.values(state.values).filter((v) => v.value.trim() !== '').length + (state.currency ? 1 : 0);
