import { describe, expect, it } from 'vitest';
import Point from 'ol/geom/Point';
import type { SearchResult } from '../map/search/results';
import { ALL_TARGETS, targetKey, type MapTarget } from '../map/targets';
import {
  DEFAULT_PROPERTY_SERVICES,
  MAX_TYPES,
  parsePropertyServices,
  servicesFor,
} from './model';
import { PRIOR_MEAN, rankProviders, trustedRating, type RatingSummary } from './rank';

const target = (key: string) => ALL_TARGETS.find((t) => targetKey(t) === key) as MapTarget;

describe('config', () => {
  it('has a default for land only, and nothing for flats', () => {
    expect(servicesFor(DEFAULT_PROPERTY_SERVICES, target('land'))).toEqual([
      'land_surveyors',
      'real_estate_valuers',
      'lawyers',
    ]);
    expect(servicesFor(DEFAULT_PROPERTY_SERVICES, target('rent'))).toEqual([]);
    expect(servicesFor(DEFAULT_PROPERTY_SERVICES, target('plumber'))).toEqual([]);
    expect(servicesFor(DEFAULT_PROPERTY_SERVICES, null)).toEqual([]);
  });
  it('reads what the admin saved and drops what it does not know', () => {
    const c = parsePropertyServices(
      JSON.stringify({ land: ['lawyers', 'nope', 'lawyers', 7], sale: ['clinics'], hotel: ['lawyers'] }),
    );
    expect(c).toEqual({ land: ['lawyers'], sale: ['clinics'] });
  });
  it('a broken or empty value falls back to the default; a saved empty list is respected only per kind', () => {
    expect(parsePropertyServices(null)).toEqual(DEFAULT_PROPERTY_SERVICES);
    expect(parsePropertyServices('{not json')).toEqual(DEFAULT_PROPERTY_SERVICES);
    expect(parsePropertyServices('"text"')).toEqual(DEFAULT_PROPERTY_SERVICES);
    expect(parsePropertyServices(JSON.stringify({ land: [] }))).toEqual({});
  });
  it('a card gets a few types, not a market', () => {
    const many = ['lawyers', 'clinics', 'plumber', 'painter', 'carpenter', 'builder', 'doctors_on_call'];
    expect(parsePropertyServices(JSON.stringify({ land: many })).land).toHaveLength(MAX_TYPES);
  });
});

describe('trusted rating', () => {
  const r = (avg: number, count: number): RatingSummary => ({ avg, count });
  it('one perfect rating does not beat many good ones', () => {
    expect(trustedRating(r(5, 1))).toBeLessThan(trustedRating(r(4.7, 40)));
  });
  it('no ratings is neutral: above a bad provider, below a proven good one', () => {
    expect(trustedRating(null)).toBe(PRIOR_MEAN);
    expect(trustedRating(r(2, 10))).toBeLessThan(trustedRating(null));
    expect(trustedRating(r(4.5, 10))).toBeGreaterThan(trustedRating(null));
  });
});

describe('ranking', () => {
  const ORIGIN: [number, number] = [170000, 145000];
  let n = 0;
  /** A provider `km` kilometres east of the property. */
  function provider(id: string, km: number, props: Record<string, unknown> = {}): SearchResult {
    n += 1;
    const x = ORIGIN[0] + km * 1000;
    const geometry = new Point([x, ORIGIN[1]]);
    return {
      key: `land_surveyors:${id}`,
      target: target('land_surveyors'),
      id,
      props: { gov_a: 'رام الله والبيرة', auto_status: 0, status: 0, ...props },
      geometry,
      center: [x, ORIGIN[1]],
      extent: geometry.getExtent(),
      rating: n * 0,
    };
  }
  const place = { gov: 'رام الله والبيرة' };
  const order = (rs: SearchResult[], ratings = new Map<string, RatingSummary>(), p = place) =>
    rankProviders(rs, ORIGIN, p, ratings).map((x) => x.r.id);

  it('the nearest is not automatically first: the area, then availability, then rating, then distance', () => {
    const nearButOtherGov = provider('near-other-gov', 1, { gov_a: 'نابلس' });
    const nearButClosed = provider('near-closed', 2, { auto_status: 1 });
    const farButGood = provider('far-good', 20);
    const nearUnrated = provider('near-unrated', 3);
    const ratings = new Map([['far-good', { avg: 4.8, count: 30 }]]);
    expect(order([nearButOtherGov, nearButClosed, nearUnrated, farButGood], ratings)).toEqual([
      'far-good', // in the area, available, proven rating
      'near-unrated', // in the area, available
      'near-closed', // in the area but closed now
      'near-other-gov', // outside the area, however close
    ]);
  });
  it('equal on everything: the closer one wins', () => {
    expect(order([provider('b', 9), provider('a', 4)])).toEqual(['a', 'b']);
  });
  it('a withdrawn or unavailable listing counts as not available', () => {
    expect(order([provider('w', 1, { status: 2 }), provider('ok', 8)])).toEqual(['ok', 'w']);
    expect(order([provider('u', 1, { status: 1 }), provider('ok', 8)])).toEqual(['ok', 'u']);
  });
  it('a property with no governorate has no "area" step; the rest still ranks', () => {
    const other = provider('other', 1, { gov_a: 'نابلس' });
    const same = provider('same', 5);
    expect(order([same, other], new Map(), { gov: '' })).toEqual(['other', 'same']);
  });
  it('reports distance in metres and carries the rating', () => {
    const [first] = rankProviders([provider('a', 4)], ORIGIN, place, new Map([['a', { avg: 4, count: 2 }]]));
    expect(Math.round(first.distance)).toBe(4000);
    expect(first.rating).toEqual({ avg: 4, count: 2 });
    expect(first.inArea && first.available).toBe(true);
  });
});
