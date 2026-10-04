import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, PRESETS, contrast, deriveTokens, normalizeHex, parseTheme, themeCss } from './model';

describe('brand theme model', () => {
  it('parses stored JSON and falls back field by field', () => {
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme('not json')).toEqual(DEFAULT_THEME);
    expect(parseTheme('{"primary":"#ABC","secondary":"red","header":"gradient"}')).toEqual({
      primary: '#aabbcc',
      secondary: DEFAULT_THEME.secondary,
      header: 'gradient',
    });
    expect(parseTheme('{"header":"neon"}').header).toBe('soft');
  });

  it('normalizes hex colours', () => {
    expect(normalizeHex(' 0F766E ')).toBe('#0f766e');
    expect(normalizeHex('#12345')).toBeNull();
  });

  it('keeps every derived text colour readable, whatever colour is picked', () => {
    for (const primary of ['#ffff00', '#a3e635', '#000000', ...PRESETS.map((p) => p.primary)]) {
      const { light, dark } = deriveTokens({ ...DEFAULT_THEME, primary });
      expect(contrast(light['--color-brand'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light['--color-brand-fg'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark['--color-brand-fg'], '#161a2c')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('adds no CSS for the default colours, and outranks index.css otherwise', () => {
    expect(themeCss(DEFAULT_THEME)).toBe('');
    expect(themeCss({ ...DEFAULT_THEME, header: 'gradient' })).toBe('');
    const css = themeCss({ ...DEFAULT_THEME, primary: '#0f766e' });
    expect(css).toContain(':root:root{--color-brand:');
    expect(css).toContain(":root:root[data-theme='dark']");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });
});
