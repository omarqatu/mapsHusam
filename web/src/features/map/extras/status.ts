import { normalizeArabic } from '../search/globalSearch';

// Pure helpers of the road / fuel status lists (legacy widgets-ticker.js: relative "last update", grid filter).

/** Every typed word must appear (Arabic letter variants folded, case-insensitive) — legacy filterWidgetGrid. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = normalizeArabic(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeArabic(haystack).toLowerCase();
  return words.every((w) => text.includes(w));
}

export type RelativeUpdate =
  /** The layer has no rows / no timestamp yet. */
  | { kind: 'never' }
  | { kind: 'unknown' }
  /** Under 10 minutes ago (legacy showed "now" in green). */
  | { kind: 'now' }
  | { kind: 'ago'; value: number; unit: 'minute' | 'hour' | 'day' };

/**
 * "Last updated" as legacy did: under 10 min = now, otherwise rounded to 5 minutes.
 * Legacy printed two units ("1 hour and 5 minutes"); one unit ("about 1 hour") is enough for a freshness hint.
 */
export function relativeUpdate(iso: string | null | undefined, now: number): RelativeUpdate {
  if (!iso) return { kind: 'never' };
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return { kind: 'unknown' };
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 10) return { kind: 'now' };
  const rounded = Math.round(minutes / 5) * 5;
  if (rounded < 60) return { kind: 'ago', value: rounded, unit: 'minute' };
  if (rounded < 1440) return { kind: 'ago', value: Math.round(rounded / 60), unit: 'hour' };
  return { kind: 'ago', value: Math.round(rounded / 1440), unit: 'day' };
}

/** Number formatting locale for a UI language (Arabic digits for ar, like the details card). */
export const numberLocale = (language: string) => (language === 'ar' ? 'ar-EG' : 'en-US');

/** Localised "5 minutes ago" for an `ago` value. */
export function formatAgo(r: Extract<RelativeUpdate, { kind: 'ago' }>, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-r.value, r.unit);
}
