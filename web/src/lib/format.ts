// Locale-aware formatting — the one place that maps the UI language to an Intl locale.

/** Arabic UI → Egyptian Arabic digits/format (legacy used 'ar-EG'); English → British day/month order. */
export const intlLocale = (lang: string) => (lang === 'ar' ? 'ar-EG' : 'en-GB');

export const formatNumber = (n: number, lang: string) => n.toLocaleString(intlLocale(lang));
export const formatDate = (d: Date | string, lang: string) =>
  new Date(d).toLocaleDateString(intlLocale(lang));
export const formatDateTime = (d: Date | string, lang: string) =>
  new Date(d).toLocaleString(intlLocale(lang));
