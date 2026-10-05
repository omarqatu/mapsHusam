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
import { BAND, PRIOR_MEAN, rankProviders, ratingBand, trustedRating, type RatingSummary } from './rank';

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
  it('ratings within one band count as equal; closed right now costs exactly one band', () => {
    expect(ratingBand(r(4.5, 30), null)).toBe(ratingBand(r(4.6, 30), null)); // noise, not a difference
    expect(ratingBand(r(4.8, 30), 'closed')).toBe(ratingBand(r(4.8, 30), 'open') - 1);
    expect(BAND).toBe(0.25);
  });
});

describe('ranking', () => {
  const ORIGIN: [number, number] = [170000, 145000];
  /** A provider `km` kilometres east of the property. */
  function provider(id: string, km: number, props: Record<string, unknown> = {}): SearchResult {
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
      rating: 0,
    };
  }
  const order = (rs: SearchResult[], ratings: Record<string, RatingSummary> = {}) =>
    rankProviders(rs, ORIGIN, new Map(Object.entries(ratings))).map((x) => x.r.id);

  it('the governorate is context, not a winner: 3 km across the line beats 35 km inside it', () => {
    const near = provider('near-other-gov', 3, { gov_a: 'نابلس' });
    const far = provider('far-same-gov', 35);
    expect(order([far, near])).toEqual(['near-other-gov', 'far-same-gov']);
  });
  it('active first: a listing marked unavailable for now goes after the active ones, however good', () => {
    const away = provider('away', 1, { status: 1 });
    expect(order([away, provider('ok', 8)], { away: { avg: 5, count: 50 } })).toEqual(['ok', 'away']);
  });
  it('a proven rating comes before distance; equal ratings are decided by distance', () => {
    const proven = provider('far-proven', 9);
    const nearUnrated = provider('near-unrated', 1);
    expect(order([nearUnrated, proven], { 'far-proven': { avg: 4.8, count: 30 } })).toEqual(['far-proven', 'near-unrated']);
    expect(order([provider('b', 9), provider('a', 4)])).toEqual(['a', 'b']);
  });
  it('4.5 vs 4.6 from thirty customers is noise: the nearer one wins', () => {
    const ratings = { far: { avg: 4.6, count: 30 }, near: { avg: 4.5, count: 30 } };
    expect(order([provider('far', 9), provider('near', 2)], ratings)).toEqual(['near', 'far']);
  });
  it('closed right now is a light nudge: it loses to an equal open one, not to a clearly worse one', () => {
    const closed = provider('closed', 2, { auto_status: 1 });
    const open = provider('open', 5);
    expect(order([closed, open])).toEqual(['open', 'closed']); // same rating: one band lower
    const excellentButClosed = provider('excellent-closed', 6, { auto_status: 1 });
    expect(order([open, excellentButClosed], { 'excellent-closed': { avg: 4.9, count: 40 } })).toEqual([
      'excellent-closed',
      'open',
    ]);
    // a closed surveyor with a good rating is still level with an open one of nearly the same rating: the nearer one wins
    const a = provider('a-closed', 2, { auto_status: 1 });
    const b = provider('b-open', 7);
    expect(order([b, a], { 'a-closed': { avg: 4.8, count: 30 }, 'b-open': { avg: 4.6, count: 30 } })).toEqual(['a-closed', 'b-open']);
  });
  it('reports distance in metres, the rating and the state', () => {
    const [first] = rankProviders([provider('a', 4)], ORIGIN, new Map([['a', { avg: 4, count: 2 }]]));
    expect(Math.round(first.distance)).toBe(4000);
    expect(first.rating).toEqual({ avg: 4, count: 2 });
    expect(first.active).toBe(true);
    expect(first.state).toBe('open');
  });
});
