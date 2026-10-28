// Locale-aware formatting — the one place that maps the UI language to an Intl locale.

/** Arabic UI → Arabic names with Latin digits (prices, counts and dates read the same everywhere); English → British day/month order. */
export const intlLocale = (lang: string) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

export const formatNumber = (n: number, lang: string) => n.toLocaleString(intlLocale(lang));
export const formatDate = (d: Date | string, lang: string) =>
  new Date(d).toLocaleDateString(intlLocale(lang));
/** Date, then time without seconds — two separate pieces, so right-to-left text cannot shuffle them. */
export const formatDateTime = (d: Date | string, lang: string) =>
  `${formatDate(d, lang)} ${new Date(d).toLocaleTimeString(intlLocale(lang), { hour: '2-digit', minute: '2-digit', hour12: false })}`;
/** "Tuesday 29 September 2026" / «الثلاثاء ٢٩ سبتمبر ٢٠٢٦». */
export const formatLongDate = (d: Date | string, lang: string) =>
  new Date(d).toLocaleDateString(intlLocale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** A bare `2026-06-28`: the spec reads it as UTC midnight, unlike every other form here. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Postgres timestamps: the server sends ISO (`2026-06-28T22:35:58.529Z`) for `timestamptz`, but a
 * `timestamp without time zone` reaches us as its text form — `2026-06-28 22:35:58.529724` (space,
 * microseconds, sometimes a short `+02` offset) — which `new Date` rejects. Legacy `parseServerDate`.
 *
 * A value that carries no zone is read as **local time**: that is what the legacy site did
 * (`js/widgets-ticker.js`) and what the app has shown since, and it is right only while the viewer sits
 * in the database's time zone. Reading it as UTC instead means appending `Z` here — that moves every
 * such date by the viewer's offset, so it needs the owner's word on what the server stores (ALA-19).
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = DATE_ONLY.test(raw)
    ? `${raw}T00:00:00` // local midnight, like the date+time forms below
    : raw
        .replace(' ', 'T')
        .replace(/(\.\d{3})\d+/, '$1') // microseconds → milliseconds
        .replace(/([+-]\d{2})$/, '$1:00'); // Postgres' short offset `+02` → `+02:00`
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
