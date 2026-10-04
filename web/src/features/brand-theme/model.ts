// The admin's brand theme (stored in platform_content under THEME_KEY, JSON). Only the brand family of tokens
// changes: every other colour stays the design system's. Shades are derived, and text colours are pushed until
// they pass WCAG AA, so any colour an admin picks stays readable in light and dark.

export type HeaderStyle = 'soft' | 'gradient' | 'surface';

export interface BrandTheme {
  primary: string;
  /** Second stop of the brand gradient. */
  secondary: string;
  header: HeaderStyle;
}

export const THEME_KEY = 'brand_theme';
export const HEADER_STYLES: HeaderStyle[] = ['soft', 'gradient', 'surface'];

/** Same values as the @theme block of index.css: saving these means "no override". */
export const DEFAULT_THEME: BrandTheme = { primary: '#4f46e5', secondary: '#7c3aed', header: 'soft' };

export const PRESETS: { id: string; primary: string; secondary: string }[] = [
  { id: 'indigo', primary: '#4f46e5', secondary: '#7c3aed' },
  { id: 'ocean', primary: '#0369a1', secondary: '#0891b2' },
  { id: 'teal', primary: '#0f766e', secondary: '#0d9488' },
  { id: 'green', primary: '#15803d', secondary: '#65a30d' },
  { id: 'amber', primary: '#b45309', secondary: '#d97706' },
  { id: 'rose', primary: '#be123c', secondary: '#db2777' },
  { id: 'plum', primary: '#7e22ce', secondary: '#c026d3' },
  { id: 'slate', primary: '#334155', secondary: '#475569' },
];

const DARK_SURFACE = '#161a2c';

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${[...hex].map((c) => c + c).join('')}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`.toLowerCase();
  return null;
}

/** Stored JSON → a complete theme; anything missing or malformed falls back to the default. */
export function parseTheme(raw: string | null | undefined): BrandTheme {
  if (!raw) return DEFAULT_THEME;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof BrandTheme, unknown>>;
    return {
      primary: normalizeHex(o.primary) ?? DEFAULT_THEME.primary,
      secondary: normalizeHex(o.secondary) ?? DEFAULT_THEME.secondary,
      header: HEADER_STYLES.includes(o.header as HeaderStyle) ? (o.header as HeaderStyle) : DEFAULT_THEME.header,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export const serializeTheme = (t: BrandTheme) => JSON.stringify(t);

export const sameTheme = (a: BrandTheme, b: BrandTheme) =>
  a.primary === b.primary && a.secondary === b.secondary && a.header === b.header;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `weight` of the way from `a` to `b`. */
export function mix(a: string, b: string, weight: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * weight));
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Moves `color` towards `toward` in small steps until it reaches `ratio` against `bg`. */
function ensureContrast(color: string, bg: string, ratio: number, toward: string): string {
  let c = color;
  for (let i = 1; i <= 20 && contrast(c, bg) < ratio; i++) c = mix(color, toward, i * 0.05);
  return c;
}

/** The brand tokens for each scheme. */
export function deriveTokens(t: BrandTheme): { light: Record<string, string>; dark: Record<string, string> } {
  // Fills carry white text (buttons, active tab): at least 4.5:1 against white.
  const brand = ensureContrast(t.primary, '#ffffff', 4.5, '#000000');
  const brand2 = ensureContrast(t.secondary, '#ffffff', 3, '#000000');
  return {
    light: {
      '--color-brand': brand,
      '--color-brand-2': brand2,
      '--color-brand-hover': mix(brand, '#0f172a', 0.18),
      '--color-brand-fg': ensureContrast(mix(brand, '#0f172a', 0.12), '#ffffff', 5.5, '#000000'),
      '--color-brand-light': mix(t.primary, '#ffffff', 0.88),
    },
    dark: {
      '--color-brand-fg': ensureContrast(mix(t.primary, '#ffffff', 0.45), DARK_SURFACE, 7, '#ffffff'),
      '--color-brand-light': mix(t.primary, DARK_SURFACE, 0.72),
    },
  };
}

const block = (selector: string, vars: Record<string, string>) =>
  `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;

/**
 * CSS that puts the theme over index.css. `:root:root` outranks index.css's `:root` rules whatever order the two
 * stylesheets load in (the early copy from theme-init.js lands before Vite's CSS). Empty for the default colours.
 */
export function themeCss(t: BrandTheme): string {
  if (t.primary === DEFAULT_THEME.primary && t.secondary === DEFAULT_THEME.secondary) return '';
  const { light, dark } = deriveTokens(t);
  return [
    block(':root:root', light),
    block(":root:root[data-theme='dark']", dark),
    `@media (prefers-color-scheme: dark){${block(":root:root:not([data-theme='light']):not([data-theme='dark'])", dark)}}`,
  ].join('\n');
}
