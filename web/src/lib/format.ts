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

/**
 * Postgres timestamps: the server sends ISO (`2026-06-28T22:35:58.529Z`), but other drivers / older rows give
 * `2026-06-28 22:35:58.529724` (space, microseconds) which `new Date` rejects. Legacy `parseServerDate`.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
