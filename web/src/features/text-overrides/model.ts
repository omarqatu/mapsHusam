import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

// Interface texts the admin may reword (plain text, both languages). Stored on the server as one JSON value under
// `settings.texts` (platform_content): `{ ar: { "<key>": "text" }, en: { … } }`, applied over the bundled locale files at
// runtime. Only the keys below can be overridden: a key is added here on purpose, never picked from the request.

export const TEXTS_KEY = 'settings.texts';
export type Lang = 'ar' | 'en';
export type TextOverrides = Record<Lang, Record<string, string>>;
export const NO_OVERRIDES: TextOverrides = { ar: {}, en: {} };

/** The reachable texts by screen; a group is one block on the admin page. */
export const TEXT_GROUPS = [
  {
    id: 'search',
    keys: [
      'searchPage.kicker',
      'searchPage.heroLine1',
      'searchPage.heroLine2',
      'searchPage.heroText',
      'searchPage.sectionsTitle',
      'searchPage.sectionsHint',
    ],
  },
  {
    id: 'welcome',
    keys: [
      'auth.welcome.title',
      'auth.welcome.tagline',
      'auth.welcome.subtitle',
      'auth.welcome.register',
      'auth.welcome.login',
      'auth.welcome.footer',
    ],
  },
  {
    id: 'features',
    keys: ['realEstate', 'providers', 'location', 'contact', 'search', 'free'].flatMap((f) => [
      `auth.welcome.features.${f}.label`,
      `auth.welcome.features.${f}.desc`,
      ...(f === 'realEstate' || f === 'providers' ? [`auth.welcome.features.${f}.descCount`] : []),
    ]),
  },
] as const;

export const TEXT_KEYS: readonly string[] = TEXT_GROUPS.flatMap((g) => g.keys);
const ALLOWED = new Set(TEXT_KEYS);

/** Longest override: these are short lines, not articles (the legal texts have their own page). */
export const MAX_TEXT_LENGTH = 400;

// A copy taken at load: i18next keeps the locale objects it was given and writes overrides into them, so the imported
// objects stop being "the built-in text" once one is applied.
const BUNDLES: Record<Lang, unknown> = { ar: structuredClone(ar), en: structuredClone(en) };

/** The bundled (built-in) text of a key. */
export function defaultText(lang: Lang, key: string): string {
  let node: unknown = BUNDLES[lang];
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : '';
}

/** `{{count}}`-style placeholders of a text, sorted: an override must keep exactly the ones the built-in text has. */
const placeholders = (s: string) => [...new Set(s.match(/\{\{\s*\w+\s*\}\}/g) ?? [])].sort().join('|');

/** True when `value` may replace the built-in text of `key` in `lang`. */
export function isValidOverride(lang: Lang, key: string, value: unknown): boolean {
  if (!ALLOWED.has(key) || typeof value !== 'string') return false;
  const v = value.trim();
  return (
    v !== '' &&
    v.length <= MAX_TEXT_LENGTH &&
    v !== defaultText(lang, key) &&
    placeholders(v) === placeholders(defaultText(lang, key))
  );
}

/** Stored text → overrides. Anything unknown, empty, too long, unchanged or with the wrong placeholders is dropped. */
export function parseTextOverrides(raw: string | null | undefined): TextOverrides {
  if (!raw) return NO_OVERRIDES;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NO_OVERRIDES;
  }
  if (!data || typeof data !== 'object') return NO_OVERRIDES;
  const out: TextOverrides = { ar: {}, en: {} };
  for (const lang of ['ar', 'en'] as const) {
    const part = (data as Partial<Record<Lang, unknown>>)[lang];
    if (!part || typeof part !== 'object') continue;
    for (const [key, value] of Object.entries(part)) {
      if (typeof value === 'string' && isValidOverride(lang, key, value)) out[lang][key] = value.trim();
    }
  }
  return out;
}

/** Overrides → stored text (keys sorted, so the same choice stores the same value). */
export function serializeTextOverrides(o: TextOverrides): string {
  const sorted = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({ ar: sorted(o.ar), en: sorted(o.en) });
}

export const sameOverrides = (a: TextOverrides, b: TextOverrides) =>
  serializeTextOverrides(a) === serializeTextOverrides(b);
