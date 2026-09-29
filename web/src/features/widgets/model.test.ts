import { describe, expect, it } from 'vitest';
import type { WidgetsData } from '@/api/widgets';
import {
  aladhanDate,
  buildTickerItems,
  CARD_IDS,
  CARD_TAB,
  CITIES,
  currencyBadge,
  filterRows,
  formatHijri,
  fuelKind,
  groupItems,
  applyMarket,
  headlineTemp,
  weatherLabel,
  isCardId,
  mergeWeather,
  nextPrayer,
  palestineNow,
  parseForecast,
  parsePrayerTimes,
  splitEvents,
  weatherKind,
  type PrayerTimes,
} from './model';

const data = (groups: WidgetsData['groups']): WidgetsData => ({
  success: true,
  groups,
  road_status_updated_at: null,
  fuel_status_updated_at: null,
});

describe('cards', () => {
  it('every card has a tab and ids are recognised for deep links', () => {
    for (const id of CARD_IDS) expect(CARD_TAB[id]).toBeDefined();
    expect(isCardId('road-status')).toBe(true);
    expect(isCardId('nope')).toBe(false);
    expect(isCardId(null)).toBe(false);
  });
});

describe('groupItems', () => {
  it('reads text rows, turns numbers into text and drops empty rows', () => {
    const d = data({ gold: { items: [{ id: 'g', label: 'x', value: 5 }, {}, null], updated_at: null } });
    expect(groupItems(d, 'gold')).toEqual([{ id: 'g', label: 'x', value: '5' }]);
  });
  it('is empty for a missing or malformed group', () => {
    expect(groupItems(undefined, 'gold')).toEqual([]);
    expect(groupItems(data({}), 'gold')).toEqual([]);
    expect(groupItems(data({ gold: { items: 'oops', updated_at: null } }), 'gold')).toEqual([]);
  });
});

describe('search and icons', () => {
  const rows = [
    { id: '1', label: 'دولار أمريكي', code: 'USD/ILS', value: '3' },
    { id: '2', label: 'يورو', code: 'EUR/ILS', value: '3.7' },
  ];
  it('folds Arabic letter variants and needs every word', () => {
    expect(filterRows(rows, 'دولار امريكي')).toHaveLength(1);
    expect(filterRows(rows, 'eur')).toHaveLength(1);
    expect(filterRows(rows, 'eur دولار')).toHaveLength(0);
    expect(filterRows(rows, '  ')).toHaveLength(2);
  });
  it('picks a currency badge and a fuel kind from the row', () => {
    expect(currencyBadge({ code: 'usd/ils' })).toBe('USD');
    expect(currencyBadge({})).toBe('¤');
    expect(fuelKind({ id: 'fuel-diesel' })).toBe('diesel');
    expect(fuelKind({ id: 'fuel-gas-large' })).toBe('gas');
    expect(fuelKind({ id: 'fuel-95' })).toBe('petrol');
  });
});

describe('weather', () => {
  it('maps WMO codes like the legacy icon picker', () => {
    expect(weatherKind(0)).toBe('clear');
    expect(weatherKind(2)).toBe('partly');
    expect(weatherKind(3)).toBe('cloudy');
    expect(weatherKind(46)).toBe('fog');
    expect(weatherKind(61)).toBe('rain');
    expect(weatherKind(75)).toBe('snow');
    expect(weatherKind(81)).toBe('showers');
    expect(weatherKind(96)).toBe('storm');
    expect(weatherKind(null)).toBe('partly');
  });

  const block = (max: number) => ({
    daily: {
      time: ['2026-09-29', '2026-09-30'],
      temperature_2m_max: [max, max + 1.6],
      temperature_2m_min: [10, 11],
      weathercode: [0, 61],
    },
  });

  it('reads one block per city in order, rounds, and tolerates a broken block', () => {
    const f = parseForecast([block(20.4), { nothing: true }], CITIES.slice(0, 2));
    expect(f.ramallah).toEqual([
      { date: '2026-09-29', max: 20, min: 10, kind: 'clear' },
      { date: '2026-09-30', max: 22, min: 11, kind: 'rain' },
    ]);
    expect(f.jerusalem).toEqual([]);
  });
  it('accepts the single-object answer of a one-city request', () => {
    expect(parseForecast(block(5), CITIES.slice(0, 1)).ramallah).toHaveLength(2);
  });

  it('puts the admin rows first, keeps their current values and adds the other forecast cities', () => {
    const forecast = parseForecast(Array.from({ length: CITIES.length }, () => block(20)));
    const merged = mergeWeather(
      [
        { id: 'gaza', label: 'غزة', temp: '32', condition: 'مشمس' },
        { id: 'nablus', temp: '  ', humidity: '' },
      ],
      forecast,
    );
    expect(merged[0]).toMatchObject({
      id: 'gaza',
      label: 'غزة',
      current: { temp: '32', condition: 'مشمس' },
      days: [],
    });
    expect(merged[1]).toMatchObject({ id: 'nablus', current: undefined });
    expect(merged[1].days).toHaveLength(2);
    expect(merged).toHaveLength(1 + CITIES.length); // gaza + all eleven (nablus once)
    expect(merged.filter((c) => c.id === 'nablus')).toHaveLength(1);
    expect(headlineTemp(merged[0])).toBe('32');
    expect(headlineTemp(merged[2])).toBe('20');
  });
  it('shows only the admin rows when the forecast is unavailable', () => {
    expect(mergeWeather([{ id: 'gaza', temp: '30' }], undefined).map((c) => c.id)).toEqual(['gaza']);
    expect(mergeWeather([], undefined)).toEqual([]);
  });
});

describe('prayer times', () => {
  const raw = {
    data: {
      timings: {
        Fajr: '04:57',
        Sunrise: '6:16 (EEST)',
        Dhuhr: '12:30',
        Asr: '16:07',
        Maghrib: '18:45',
        Isha: '20:01',
        Imsak: '04:40',
      },
    },
  };
  it('parses the six times and cleans suffixes', () => {
    expect(parsePrayerTimes(raw)).toEqual({
      fajr: '04:57',
      sunrise: '06:16',
      dhuhr: '12:30',
      asr: '16:07',
      maghrib: '18:45',
      isha: '20:01',
    });
  });
  it('rejects an answer without all six', () => {
    expect(parsePrayerTimes({ data: { timings: { Fajr: '04:57' } } })).toBeNull();
    expect(parsePrayerTimes(null)).toBeNull();
    expect(parsePrayerTimes({})).toBeNull();
  });
  const times = parsePrayerTimes(raw) as PrayerTimes;
  it('finds the next prayer, skipping sunrise, and wraps to tomorrow after Isha', () => {
    expect(nextPrayer(times, 4 * 60)).toEqual({ key: 'fajr', tomorrow: false });
    expect(nextPrayer(times, 7 * 60)).toEqual({ key: 'dhuhr', tomorrow: false });
    expect(nextPrayer(times, 18 * 60 + 45)).toEqual({ key: 'isha', tomorrow: false });
    expect(nextPrayer(times, 21 * 60)).toEqual({ key: 'fajr', tomorrow: true });
  });
  it('reads the clock of Palestine whatever the device timezone', () => {
    // 2026-09-29 22:30 UTC is 01:30 on the 30th in Palestine (UTC+3 in summer time).
    expect(palestineNow(new Date('2026-09-29T22:30:00Z'))).toEqual({ date: '2026-09-30', minutes: 90 });
    expect(aladhanDate('2026-09-30')).toBe('30-09-2026');
  });
});

describe('calendar', () => {
  it('formats the hijri date in both languages', () => {
    const d = new Date('2026-09-29T12:00:00');
    expect(formatHijri(d, 'en')).toContain('1448');
    expect(formatHijri(d, 'ar')).toMatch(/1448/);
  });
  it('splits events into upcoming, past and undated, sorted', () => {
    const { upcoming, past, undated } = splitEvents(
      [
        { id: 'a', label: 'later', date: '2026-10-10' },
        { id: 'b', label: 'today', date: '2026-09-29' },
        { id: 'c', label: 'old', date: '2026-01-01' },
        { id: 'd', label: 'older', date: '2025-01-01' },
        { id: 'e', label: 'no date' },
        { id: 'f', label: 'bad', date: 'soon' },
      ],
      '2026-09-29',
    );
    expect(upcoming.map((e) => [e.item.id, e.days])).toEqual([
      ['b', 0],
      ['a', 11],
    ]);
    expect(past.map((e) => e.item.id)).toEqual(['c', 'd']);
    expect(undated.map((e) => e.item.id)).toEqual(['e', 'f']);
  });
});

describe('ticker items', () => {
  const groups: WidgetsData['groups'] = {
    currency: { items: [{ id: 'c1', label: 'دولار', code: 'USD/ILS', value: '3.1' }], updated_at: null },
    gold: {
      items: [
        { id: 'g1', label: 'ذهب 24', value: '216', unit: 'شيكل/غرام' },
        { id: 'g2', label: 'no value' },
      ],
      updated_at: null,
    },
    fuel: {
      items: Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, label: `fuel ${i}`, value: String(i) })),
      updated_at: null,
    },
  };
  const base = {
    data: data(groups),
    weather: mergeWeather([{ id: 'ramallah', temp: '27' }], undefined),
    prayer: {
      fajr: '04:57',
      sunrise: '06:16',
      dhuhr: '12:30',
      asr: '16:07',
      maghrib: '18:45',
      isha: '20:01',
    },
    minutes: 13 * 60,
    hijri: '18 Rabi II 1448',
    name: (kind: string, id: string) => `${kind}:${id}`,
    nextLabel: (n: string) => `next ${n}`,
  };
  it('takes the first rows of each group with data, then prayer, date and the two status lists', () => {
    const items = buildTickerItems(base);
    expect(items.map((i) => i.card)).toEqual([
      'currency',
      'gold',
      'weather',
      'fuel',
      'fuel',
      'fuel',
      'prayer',
      'calendar',
      'road-status',
      'fuel-status',
    ]);
    expect(items[0]).toMatchObject({ label: 'USD/ILS', value: '3.1' }); // currency shows its code
    expect(items[2]).toMatchObject({ label: 'city:ramallah', value: '27°' });
    expect(items.find((i) => i.card === 'prayer')).toMatchObject({
      label: 'next prayer:asr',
      value: '16:07',
    });
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
  it('leaves out what it does not have', () => {
    const items = buildTickerItems({ ...base, data: undefined, weather: [], prayer: null });
    expect(items.map((i) => i.card)).toEqual(['calendar', 'road-status', 'fuel-status']);
  });
});

describe('weatherLabel', () => {
  const day = { date: '2026-09-30', max: 27, min: 15, kind: 'clear' as const };
  it('says today\'s high and low, ignoring what the admin once typed', () => {
    expect(weatherLabel({ id: 'ramallah', current: { temp: '99' }, days: [day] })).toBe('\u20662' + '7°/15°\u2069');
  });
  it('falls back to the admin\'s typed temperature, else nothing', () => {
    expect(weatherLabel({ id: 'x', current: { temp: '21' }, days: [] })).toBe('21°');
    expect(weatherLabel({ id: 'x', days: [] })).toBeNull();
  });
});

describe('applyMarket', () => {
  const labels = {
    usd: 'USD', eur: 'EUR', jod: 'JOD', gold24: 'G24', gold21: 'G21', gold18: 'G18',
    goldOunce: 'OZ', silver: 'AG', perGram: '/g', perOunce: '/oz',
  };
  const data = {
    success: true,
    groups: {
      currency: { items: [{ id: 'old', code: 'USD/ILS', label: 'old', value: '2.99' }], updated_at: '2020-01-01T00:00:00Z' },
      fuel: { items: [{ id: 'f', label: 'diesel', value: '7' }], updated_at: '2026-09-01T00:00:00Z' },
    },
    road_status_updated_at: null,
    fuel_status_updated_at: null,
  };
  const market = {
    rates: { USD_ILS: 3.07, EUR_ILS: 3.49, JOD_ILS: 4.33, asOf: null },
    gold: { usdPerOunce: 4185, ilsPerGram24: 413, ilsPerGram21: 361.4, ilsPerGram18: 309.8, asOf: null },
    silver: { usdPerOunce: 61.69, asOf: null },
    updatedAt: '2026-09-30T00:00:00Z',
  };

  it('replaces currency and gold with the live rows and stamps them with the fetch time', () => {
    const out = applyMarket(data, market, labels)!;
    expect(out.groups!.currency!.items).toEqual([
      { id: 'live-usd', code: 'USD/ILS', label: 'USD', value: '3.07' },
      { id: 'live-eur', code: 'EUR/ILS', label: 'EUR', value: '3.49' },
      { id: 'live-jod', code: 'JOD/ILS', label: 'JOD', value: '4.33' },
    ]);
    expect((out.groups!.gold!.items as { id: string; value: string }[]).map((r) => [r.id, r.value])).toEqual([
      ['live-gold-24', '413'], ['live-gold-21', '361'], ['live-gold-18', '310'], ['live-gold-ounce', '4185'], ['live-silver', '61.69'],
    ]);
    expect(out.groups!.currency!.updated_at).toBe(market.updatedAt);
  });

  it('leaves the admin\'s fuel group alone, and everything alone when the market is down', () => {
    expect(applyMarket(data, market, labels)!.groups!.fuel).toBe(data.groups.fuel);
    expect(applyMarket(data, undefined, labels)).toBe(data);
    const noGold = applyMarket(data, { ...market, gold: null, silver: null }, labels)!;
    expect(noGold.groups!.gold).toBeUndefined();
    expect(noGold.groups!.currency!.items).toHaveLength(3);
  });
});
