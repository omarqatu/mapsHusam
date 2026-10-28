import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatLongDate,
  formatNumber,
  intlLocale,
  parseServerDate,
} from './format';

/** The instant a wall-clock reading means in the machine's own zone — so the tests hold anywhere. */
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms).getTime();

describe('parseServerDate', () => {
  it('keeps the instant of an ISO timestamp that carries a zone', () => {
    expect(parseServerDate('2026-06-28T22:35:58.529Z')?.toISOString()).toBe('2026-06-28T22:35:58.529Z');
    expect(parseServerDate('2026-06-28T22:35:58.529+02:00')?.toISOString()).toBe('2026-06-28T20:35:58.529Z');
  });

  it('reads the legacy Postgres form (space + microseconds) as local time', () => {
    expect(parseServerDate('2026-06-28 22:35:58.529724')?.getTime()).toBe(local(2026, 6, 28, 22, 35, 58, 529));
    expect(parseServerDate('2026-06-28 22:35:58')?.getTime()).toBe(local(2026, 6, 28, 22, 35, 58));
    expect(parseServerDate('  2026-06-28 22:35:58.529724  ')?.getTime()).toBe(local(2026, 6, 28, 22, 35, 58, 529));
  });

  it('accepts the short `+02` offset Postgres prints for a zoned column', () => {
    expect(parseServerDate('2026-06-28 22:35:58.529724+02')?.toISOString()).toBe('2026-06-28T20:35:58.529Z');
    expect(parseServerDate('2026-06-28 22:35:58-05')?.toISOString()).toBe('2026-06-29T03:35:58.000Z');
  });

  it('reads a bare date as local midnight, like the date+time forms', () => {
    expect(parseServerDate('2026-06-28')?.getTime()).toBe(local(2026, 6, 28));
  });

  it('gives null for junk and for nothing at all', () => {
    expect(parseServerDate('nope')).toBeNull();
    expect(parseServerDate('2026-13-45 99:99:99')).toBeNull();
    expect(parseServerDate('')).toBeNull();
    expect(parseServerDate(null)).toBeNull();
    expect(parseServerDate(undefined)).toBeNull();
  });
});

describe('intlLocale', () => {
  it('gives Arabic names with Latin digits, and British day/month order for English', () => {
    expect(intlLocale('ar')).toBe('ar-u-nu-latn');
    expect(intlLocale('en')).toBe('en-GB');
  });
});

describe('formatting', () => {
  const d = new Date(2026, 5, 28, 9, 5, 0);

  it('writes numbers and dates with Latin digits in Arabic too', () => {
    expect(formatNumber(1234567, 'ar')).toBe('1,234,567');
    expect(formatDate(d, 'ar')).toMatch(/\d{1,2}.*6.*2026/);
    expect(formatDate(d, 'en')).toBe('28/06/2026');
  });

  it('puts the date first and a 24-hour time without seconds after it', () => {
    expect(formatDateTime(d, 'en')).toBe('28/06/2026 09:05');
  });

  it('spells the weekday and the month out in full', () => {
    expect(formatLongDate(d, 'en')).toBe('Sunday, 28 June 2026');
    expect(formatLongDate(d, 'ar')).toContain('يونيو');
  });
});
