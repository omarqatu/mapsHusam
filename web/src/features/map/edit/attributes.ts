import type { EditTarget, FieldDef } from './schema';
import { SERVICE_BY_KEY } from '../registry';

// Pure logic behind the attribute dialog: feature properties -> form values, form values -> cleaned properties,
// validation, and the `search_tags` text (legacy js/edit-core.js and editPolygons.js).

export type FormValues = Record<string, string>;
/** Value as it is written to the database. `null` (update only) clears the column. */
export type PropValue = string | number | null;
export type Props = Record<string, PropValue>;

/** Stored in `work_hours` by the "24 hours" button (legacy text, the popup and the search read it). */
export const ALWAYS_OPEN = 'متوفر 24 ساعة';
/** Defaults the legacy editor wrote into a new row when the admin left the field empty. Arabic is data. */
export const INSERT_DEFAULTS = {
  name: 'خدمة جديدة',
  roadName: 'طريق جديد',
  place: 'غير محدد',
  rating: 5,
  currency: 'USD',
} as const;

const present = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

/** `2026-01-31` from a date column (GeoJSON gives `YYYY-MM-DD`; anything else is not shown). */
function dateInputValue(v: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : '';
}

/** What the dialog shows for a feature's current property values (empty strings for missing ones). */
export function initialValues(target: EditTarget, props: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const field of target.fields) {
    const raw = props[field.name];
    if (field.type === 'date') out[field.name] = dateInputValue(raw);
    else if (field.type === 'select') {
      const s = present(raw) ? String(raw) : '';
      out[field.name] = field.options?.includes(s) ? s : (field.options?.[0] ?? '');
    } else out[field.name] = present(raw) ? String(raw) : '';
  }
  return out;
}

/** Error keys of `edit.errors.*`, per field name. */
export type FormErrors = Record<string, 'number' | 'rating' | 'integer'>;

export function validateValues(target: EditTarget, values: FormValues): FormErrors {
  const errors: FormErrors = {};
  for (const field of target.fields) {
    const raw = (values[field.name] ?? '').trim();
    if (raw === '') continue;
    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[field.name] = 'number';
      else if (field.max !== undefined && (n < 0 || n > field.max)) errors[field.name] = 'rating';
      else if (field.name !== 'rating' && n < 0) errors[field.name] = 'number';
    } else if (field.type === 'integer' && !/^-?\d+$/.test(raw)) errors[field.name] = 'integer';
  }
  return errors;
}

/**
 * Form values as properties. Text is trimmed; numbers become numbers; empty numbers and text become `null` (the
 * caller decides whether that means "leave out" or "clear"); roads' integer fields default to 0 like the legacy tool.
 */
export function parseValues(target: EditTarget, values: FormValues): Props {
  const out: Props = {};
  for (const field of target.fields) out[field.name] = parseField(field, (values[field.name] ?? '').trim());
  return out;
}

function parseField(field: FieldDef, raw: string): PropValue {
  if (field.type === 'integer') return raw === '' ? 0 : Number.parseInt(raw, 10);
  if (raw === '') return null;
  if (field.type === 'number') return Number(raw);
  return raw;
}

const REAL_ESTATE_TAGS = {
  rent: 'شقة للايجار، شقق، أجار شهري، سكن طلاب، عائلات، أجار سنوي، مفروش',
  sale: 'شقة للبيع، شقق تمليك، عقارات، كاش، أقساط، شقة سكنية، كوشان، اموال غير منقولة، بيع شراء ،سند طابو',
} as const;

const LAND_TAGS =
  'أرض للبيع، أراضي، كوشان، طابو، سكن، زراعي، تجاري، نمرة أرض، استثمار عقاري، مساحات، عقارات للبيع';
const LAND_TAG_NAME = 'أرض للبيع';

const descriptionStart = (v: PropValue | undefined) =>
  String(v ?? '')
    .trim()
    .substring(0, 40);

/**
 * The searchable keyword text of a row (`search_tags`), or `null` for layers without that column.
 * Services: type name + name + start of the description + the type's fixed keywords; rent/sale/land: a fixed sentence.
 */
export function buildSearchTags(target: EditTarget, props: Props): string | null {
  if (target.id === 'rent' || target.id === 'sale') return REAL_ESTATE_TAGS[target.id];
  if (target.id === 'land') {
    const head = [LAND_TAG_NAME, descriptionStart(props.des)].filter((s) => s.length > 0).join('، ');
    return `${head}، ${LAND_TAGS}`;
  }
  if (target.kind !== 'point') return null;

  const key = target.discriminator ?? target.id;
  const service = SERVICE_BY_KEY.get(key);
  const head = [service?.tagName ?? key, String(props.name ?? '').trim(), descriptionStart(props.des)]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join('، ');
  const extra = service?.tagKeywords;
  return extra ? `${head}، ${extra}` : head;
}
