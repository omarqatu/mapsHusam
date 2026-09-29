// Locale-aware formatting — the one place that maps the UI language to an Intl locale.

/** Arabic UI → Egyptian Arabic digits/format (legacy used 'ar-EG'); English → British day/month order. */
export const intlLocale = (lang: string) => (lang === 'ar' ? 'ar-EG' : 'en-GB');

export const formatNumber = (n: number, lang: string) => n.toLocaleString(intlLocale(lang));
export const formatDate = (d: Date | string, lang: string) =>
  new Date(d).toLocaleDateString(intlLocale(lang));
export const formatDateTime = (d: Date | string, lang: string) =>
  new Date(d).toLocaleString(intlLocale(lang));

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
