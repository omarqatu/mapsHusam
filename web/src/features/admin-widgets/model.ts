import type { FeatureLayer, WidgetGroupKey, WidgetItem } from '@/api/adminWidgets';

// Pure logic of the live-information admin page: the editable groups, their defaults, cleaning rows for saving,
// and the "edits on top of the saved values" model of the road / fuel tables.

export interface FieldDef {
  key: string;
  /** Column label key under `adminWidgets.field.*`. */
  label: string;
  /** Example text; Arabic/English sample data, not UI text. */
  placeholder?: string;
  type?: 'date';
}

const ID: FieldDef = { key: 'id', label: 'id', placeholder: 'currency-usd-ils' };
const LABEL: FieldDef = { key: 'label', label: 'label', placeholder: 'دولار أمريكي' };
const VALUE: FieldDef = { key: 'value', label: 'value', placeholder: '3.45' };
const UNIT = (placeholder: string): FieldDef => ({ key: 'unit', label: 'unit', placeholder });

/** The seven groups the server accepts (`WIDGETS_CONFIG_GROUPS`) and the fields each row has. */
export const GROUP_FIELDS: Record<WidgetGroupKey, FieldDef[]> = {
  currency: [ID, LABEL, { key: 'code', label: 'code', placeholder: 'USD/ILS' }, VALUE],
  gold: [ID, LABEL, VALUE, UNIT('شيكل/غرام')],
  weather: [
    { key: 'id', label: 'cityId', placeholder: 'ramallah' },
    { key: 'label', label: 'cityName', placeholder: 'رام الله' },
    { key: 'temp', label: 'temp', placeholder: '28' },
    { key: 'humidity', label: 'humidity', placeholder: '65' },
    { key: 'wind', label: 'wind', placeholder: '12' },
    { key: 'condition', label: 'condition', placeholder: 'غائم جزئياً' },
  ],
  fuel: [ID, LABEL, VALUE, UNIT('شيكل/لتر')],
  transport_inter_city: [ID, LABEL, VALUE, UNIT('شيكل')],
  transport_intra_city: [ID, LABEL, VALUE, UNIT('شيكل')],
  events: [
    { key: 'id', label: 'id', placeholder: 'event-1' },
    { key: 'date', label: 'date', type: 'date' },
    { key: 'label', label: 'eventName', placeholder: 'عيد الفطر' },
    { key: 'notes', label: 'notes' },
  ],
};

/** Starting rows when the server has none yet: `js/widgets-config.js` (`WIDGETS_MANUAL_DATA`) + legacy demo weather. */
export const DEFAULT_ITEMS: Record<WidgetGroupKey, WidgetItem[]> = {
  currency: [
    { id: 'currency-usd-ils', label: 'دولار أمريكي', code: 'USD/ILS', value: '3.01' },
    { id: 'currency-jod-ils', label: 'دينار أردني', code: 'JOD/ILS', value: '4.86' },
    { id: 'currency-eur-ils', label: 'يورو', code: 'EUR/ILS', value: '3.72' },
  ],
  gold: [
    { id: 'gold-24', label: 'ذهب عيار 24', value: '215.5', unit: 'شيكل/غرام' },
    { id: 'gold-21', label: 'ذهب عيار 21', value: '188.5', unit: 'شيكل/غرام' },
    { id: 'gold-18', label: 'ذهب عيار 18', value: '161.5', unit: 'شيكل/غرام' },
    { id: 'gold-ounce', label: 'أونصة الذهب عالمياً', value: '2450', unit: 'دولار/أونصة' },
    { id: 'silver', label: 'الفضة', value: '28.50', unit: 'دولار/أونصة' },
  ],
  weather: [
    { id: 'ramallah', label: 'رام الله', temp: '28', humidity: '65', wind: '12', condition: 'غائم جزئياً' },
    { id: 'gaza', label: 'غزة', temp: '32', humidity: '70', wind: '15', condition: 'مشمس' },
    { id: 'jerusalem', label: 'القدس', temp: '26', humidity: '60', wind: '10', condition: 'غائم' },
  ],
  fuel: [
    { id: 'fuel-95', label: 'بنزين 95', value: '6.85', unit: 'شيكل/لتر' },
    { id: 'fuel-98', label: 'بنزين 98', value: '7.05', unit: 'شيكل/لتر' },
    { id: 'fuel-diesel', label: 'سولار', value: '8.56', unit: 'شيكل/لتر' },
    { id: 'fuel-gas-cylinder', label: 'أسطوانة غاز', value: '35.00', unit: 'شيكل' },
    { id: 'fuel-gas-large', label: 'غاز حجم كبير', value: '85.00', unit: 'شيكل' },
    { id: 'fuel-gas-small', label: 'غاز حجم صغير', value: '45.00', unit: 'شيكل' },
  ],
  transport_inter_city: [
    { id: 'transport-ramallah-hebron', label: 'رام الله - الخليل', value: '30', unit: 'شيكل' },
    { id: 'transport-ramallah-bethlehem', label: 'رام الله - بيت لحم', value: '22', unit: 'شيكل' },
    { id: 'transport-ramallah-jericho', label: 'رام الله - أريحا', value: '15', unit: 'شيكل' },
    { id: 'transport-ramallah-nablus', label: 'رام الله - نابلس', value: '18', unit: 'شيكل' },
  ],
  transport_intra_city: [
    { id: 'transport-bireh-qalandia', label: 'البيرة - قلنديا', value: '4.5', unit: 'شيكل' },
    { id: 'transport-bireh-albalou', label: 'البيرة - البالوع', value: '3.5', unit: 'شيكل' },
    { id: 'transport-bireh-bitunia', label: 'البيرة - بيتونيا', value: '5', unit: 'شيكل' },
    { id: 'transport-bireh-umsharayet', label: 'البيرة - أم الشرايط', value: '3.5', unit: 'شيكل' },
  ],
  events: [
    { id: 'event-1', label: 'يوم الأرض', date: '2026-03-30' },
    { id: 'event-2', label: 'عيد الفطر', date: '2026-06-17' },
    { id: 'event-3', label: 'عيد الأضحى', date: '2026-08-23' },
  ],
};

/** The server may hold numbers or nulls from older saves; the editor works with text only. */
export function toTextItem(raw: unknown): WidgetItem {
  const out: WidgetItem = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (v !== null && v !== undefined) out[k] = String(v);
  return out;
}

/**
 * Rows → what is saved: values trimmed, empty ones left out, rows without an id dropped (legacy `saveJsonGroup`).
 * Keys the editor has no column for are kept as they are.
 */
export function cleanItems(rows: readonly WidgetItem[]): WidgetItem[] {
  const out: WidgetItem[] = [];
  for (const row of rows) {
    const item: WidgetItem = {};
    for (const [k, v] of Object.entries(row)) {
      const val = v.trim();
      if (val !== '') item[k] = val;
    }
    if (item.id) out.push(item);
  }
  return out;
}

export const sameItems = (a: readonly WidgetItem[], b: readonly WidgetItem[]) =>
  JSON.stringify(cleanItems(a)) === JSON.stringify(cleanItems(b));

/** New array with the element at `from` moved to `to` (clamped); the same array when nothing moves. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (from === target || from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Same as `moveItem` but by ids (drag & drop: drop `fromId` where `toId` is). */
export function moveById(ids: readonly number[], fromId: number, toId: number): number[] {
  return moveItem(ids, ids.indexOf(fromId), ids.indexOf(toId));
}

// ---- road checkpoints / fuel stations ----

export interface StatusLayerConfig {
  layer: FeatureLayer;
  /** Column names of the status fields. */
  fields: readonly string[];
}
export const ROAD_CONFIG: StatusLayerConfig = { layer: 'road_barriers', fields: ['stop', 'stop2'] };
export const FUEL_CONFIG: StatusLayerConfig = {
  layer: 'fuel_stations',
  fields: ['diesel', 'banzen95', 'banzen98'],
};

/** Road: 0 open · 1 closed · 2 light jam · 3 heavy jam · 4 inspection. Labels: `roadStatus.<key>`. */
export const ROAD_OPTIONS = [
  { value: '0', key: 'open' },
  { value: '1', key: 'closed' },
  { value: '2', key: 'light' },
  { value: '3', key: 'heavy' },
  { value: '4', key: 'inspection' },
] as const;
/** Fuel: 0 available · 1 unavailable. Labels: `popup.fuel.available` / `unavailable`. */
export const FUEL_OPTIONS = [
  { value: '0', key: 'available' },
  { value: '1', key: 'unavailable' },
] as const;

/** A status column as text; '' = never set. */
export const statusText = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Pending edits: feature id → field → chosen value. Only fields that differ from the saved value are kept. */
export type Edits = Record<number, Record<string, string>>;

export function setEdit(edits: Edits, id: number, field: string, chosen: string, saved: object): Edits {
  const row = { ...(edits[id] ?? {}) };
  if (chosen === statusText((saved as Record<string, unknown>)[field]) || chosen === '') delete row[field];
  else row[field] = chosen;
  const next = { ...edits };
  if (Object.keys(row).length) next[id] = row;
  else delete next[id];
  return next;
}

/** The value a select shows: the pending edit, else the saved one. */
export const effective = (edits: Edits, id: number, field: string, saved: object) =>
  edits[id]?.[field] ?? statusText((saved as Record<string, unknown>)[field]);

export const dirtyIds = (edits: Edits): number[] => Object.keys(edits).map(Number);

/** Batch body: only rows and fields the user changed. */
export type BatchItem = { id: number } & Record<string, string | number>;
export function collectBatch(edits: Edits): BatchItem[] {
  return dirtyIds(edits).map((id) => ({ ...edits[id], id }));
}

/** After a save: drop the pending edits of `fields` for `ids` (they are now the saved values). */
export function withoutEdits(edits: Edits, ids: readonly number[], fields: readonly string[]): Edits {
  const next: Edits = {};
  for (const [key, row] of Object.entries(edits)) {
    const id = Number(key);
    if (!ids.includes(id)) {
      next[id] = row;
      continue;
    }
    const rest = Object.fromEntries(Object.entries(row).filter(([f]) => !fields.includes(f)));
    if (Object.keys(rest).length) next[id] = rest;
  }
  return next;
}
