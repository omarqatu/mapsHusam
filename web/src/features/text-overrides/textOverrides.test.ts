import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  MAX_TEXT_LENGTH,
  NO_OVERRIDES,
  TEXT_KEYS,
  defaultText,
  isValidOverride,
  parseTextOverrides,
  sameOverrides,
  serializeTextOverrides,
} from './model';
import { applyTextOverrides } from './store';

const HERO = 'searchPage.heroText';
const COUNT = 'auth.welcome.features.realEstate.descCount';

describe('text overrides: what may replace a built-in text', () => {
  it('every editable key exists in both locale files and is a plain string', () => {
    for (const lang of ['ar', 'en'] as const)
      for (const key of TEXT_KEYS) expect(defaultText(lang, key), `${lang} ${key}`).not.toBe('');
  });

  it('accepts a plain replacement and drops everything else', () => {
    expect(isValidOverride('ar', HERO, 'نص جديد')).toBe(true);
    expect(isValidOverride('ar', 'auth.login', 'x')).toBe(false); // not on the list
    expect(isValidOverride('ar', 'nav.home', 'x')).toBe(false);
    expect(isValidOverride('ar', HERO, '   ')).toBe(false);
    expect(isValidOverride('ar', HERO, 'x'.repeat(MAX_TEXT_LENGTH + 1))).toBe(false);
    expect(isValidOverride('ar', HERO, defaultText('ar', HERO))).toBe(false); // unchanged = no override
    expect(isValidOverride('ar', HERO, 42)).toBe(false);
  });

  it('a line with a number code keeps exactly that code', () => {
    expect(defaultText('ar', COUNT)).toContain('{{count}}');
    expect(isValidOverride('ar', COUNT, 'أكثر من {{count}} عقار')).toBe(true);
    expect(isValidOverride('ar', COUNT, 'عقارات كثيرة')).toBe(false); // lost it
    expect(isValidOverride('ar', COUNT, '{{count}} {{other}}')).toBe(false); // invented one
    expect(isValidOverride('ar', HERO, 'نص فيه {{count}}')).toBe(false); // the built-in line has none
  });

  it('reads the stored JSON safely', () => {
    const v = parseTextOverrides(
      JSON.stringify({ ar: { [HERO]: ' جديد ', 'nav.home': 'x', [COUNT]: 'بلا رمز' }, en: { [HERO]: 5 }, fr: { [HERO]: 'x' } }),
    );
    expect(v).toEqual({ ar: { [HERO]: 'جديد' }, en: {} });
    for (const raw of [null, undefined, '', 'not json', '[]', '"x"', 'null', '{"ar":5}'])
      expect(sameOverrides(parseTextOverrides(raw), NO_OVERRIDES)).toBe(true);
  });

  it('stores the same choice the same way', () => {
    const a = { ar: { [HERO]: 'ب', 'searchPage.kicker': 'أ' }, en: {} };
    const b = { ar: { 'searchPage.kicker': 'أ', [HERO]: 'ب' }, en: {} };
    expect(serializeTextOverrides(a)).toBe(serializeTextOverrides(b));
    expect(sameOverrides(parseTextOverrides(serializeTextOverrides(a)), a)).toBe(true);
  });
});

describe('text overrides: applied over the interface', () => {
  afterEach(() => {
    applyTextOverrides(NO_OVERRIDES);
  });

  it('shows the override for that language only, and the built-in text again once it is removed', () => {
    const builtInAr = i18n.t(HERO, { lng: 'ar' });
    const builtInEn = i18n.t(HERO, { lng: 'en' });
    expect(applyTextOverrides({ ar: { [HERO]: 'بديل عربي' }, en: {} })).toBe(true);
    expect(i18n.t(HERO, { lng: 'ar' })).toBe('بديل عربي');
    expect(i18n.t(HERO, { lng: 'en' })).toBe(builtInEn);

    expect(applyTextOverrides(NO_OVERRIDES)).toBe(true);
    expect(i18n.t(HERO, { lng: 'ar' })).toBe(builtInAr);
    expect(applyTextOverrides(NO_OVERRIDES)).toBe(false); // nothing left to change
  });

  it('keeps interpolation working in a reworded line', () => {
    applyTextOverrides({ ar: { [COUNT]: 'أكثر من {{count}} عقار' }, en: {} });
    expect(i18n.t(COUNT, { lng: 'ar', count: 120 })).toBe('أكثر من 120 عقار');
  });

  it('never renders markup: the text stays text', () => {
    applyTextOverrides({ ar: { [HERO]: '<img src=x onerror=alert(1)>' }, en: {} });
    expect(i18n.t(HERO, { lng: 'ar' })).toBe('<img src=x onerror=alert(1)>'); // components print it through JSX
  });
});
