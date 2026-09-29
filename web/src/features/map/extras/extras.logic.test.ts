import { describe, expect, it } from 'vitest';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import type { Extent } from 'ol/extent';
import type { SearchResult } from '../search/results';
import { ALL_TARGETS, targetKey, type MapTarget } from '../targets';
import { SERVICE_TYPES } from '../config';
import {
  groupedTargets,
  groupOf,
  hasBeforeAfter,
  hasPhotos,
  hasVideos,
  mediaForMode,
  nearestEntries,
  pickForSection,
  sideMedia,
  type FeaturedEntry,
} from './featured';
import { formatAgo, matchesQuery, numberLocale, relativeUpdate } from './status';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe('relativeUpdate (legacy "last updated")', () => {
  it('no stamp / bad stamp', () => {
    expect(relativeUpdate(null, NOW)).toEqual({ kind: 'never' });
    expect(relativeUpdate('', NOW)).toEqual({ kind: 'never' });
    expect(relativeUpdate('not a date', NOW)).toEqual({ kind: 'unknown' });
  });
  it('under 10 minutes is "now", a future stamp too', () => {
    expect(relativeUpdate(ago(0), NOW)).toEqual({ kind: 'now' });
    expect(relativeUpdate(ago(9), NOW)).toEqual({ kind: 'now' });
    expect(relativeUpdate(ago(-5), NOW)).toEqual({ kind: 'now' });
  });
  it('rounds to 5 minutes, then hours, then days', () => {
    expect(relativeUpdate(ago(10), NOW)).toEqual({ kind: 'ago', value: 10, unit: 'minute' });
    expect(relativeUpdate(ago(23), NOW)).toEqual({ kind: 'ago', value: 25, unit: 'minute' });
    expect(relativeUpdate(ago(60), NOW)).toEqual({ kind: 'ago', value: 1, unit: 'hour' });
    expect(relativeUpdate(ago(200), NOW)).toEqual({ kind: 'ago', value: 3, unit: 'hour' });
    expect(relativeUpdate(ago(60 * 24 * 2), NOW)).toEqual({ kind: 'ago', value: 2, unit: 'day' });
  });
  it('is formatted in the UI language', () => {
    expect(formatAgo({ kind: 'ago', value: 25, unit: 'minute' }, 'en')).toBe('25 minutes ago');
    expect(formatAgo({ kind: 'ago', value: 1, unit: 'hour' }, 'en')).toBe('1 hour ago');
    expect(formatAgo({ kind: 'ago', value: 2, unit: 'day' }, 'ar')).toMatch(/يومين|٢|2/);
  });
  it('number locale', () => {
    expect(numberLocale('ar')).toBe('ar-EG');
    expect(numberLocale('en')).toBe('en-US');
  });
});

describe('matchesQuery (legacy grid filter)', () => {
  it('empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
  it('every word must be present, Arabic letter variants folded', () => {
    expect(matchesQuery('حاجز قلنديا مغلق', 'قلنديا مغلق')).toBe(true);
    expect(matchesQuery('حاجز قلنديا مغلق', 'قلنديا مفتوح')).toBe(false);
    expect(matchesQuery('أبو ديس', 'ابو')).toBe(true);
    expect(matchesQuery('مدرسة', 'مدرسه')).toBe(true);
    expect(matchesQuery('Ramallah Station', 'ramallah')).toBe(true);
  });
});

const target = (key: string) => ALL_TARGETS.find((t) => targetKey(t) === key) as MapTarget;
function result(key: string, id: string, geometry: SearchResult['geometry'], props = {}): SearchResult {
  const extent = geometry.getExtent() as Extent;
  return {
    key: `${key}:${id}`,
    target: target(key),
    id,
    props,
    geometry,
    center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
    extent,
    rating: 0,
  };
}
const at = (key: string, id: string, x: number, y = 0) => result(key, id, new Point([x, y]));

describe('pickForSection', () => {
  it('at most 10, but the first rent, sale and land are always included', () => {
    const services = Array.from({ length: 12 }, (_, i): FeaturedEntry => ({ r: at('plumber', String(i), i) }));
    const rent = { r: at('rent', 'r1', 100) };
    const land = { r: at('land', 'l1', 101) };
    const rent2 = { r: at('rent', 'r2', 102) };
    const picked = pickForSection([...services, rent, land, rent2]);
    expect(picked).toHaveLength(10);
    expect(picked.slice(0, 2)).toEqual([rent, land]); // rent, sale (none), land
    expect(picked).not.toContain(rent2);
    expect(picked.slice(2).map((e) => e.r.id)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });
  it('a short list is returned whole', () => {
    const one = { r: at('plumber', '1', 0) };
    expect(pickForSection([one])).toEqual([one]);
    expect(pickForSection([])).toEqual([]);
  });
});

describe('media sections', () => {
  const both = { pic: 'a.com/1.jpg', video: 'https://youtu.be/dQw4w9WgXcQ', details_link_1: 'a.com/b.jpg', details_link_2: 'a.com/c.jpg' };
  it('detects pictures, videos and before/after pairs', () => {
    expect(hasPhotos(both)).toBe(true);
    expect(hasVideos(both)).toBe(true);
    expect(hasBeforeAfter(both)).toBe(true);
    expect(hasPhotos({ video: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(false);
    expect(hasVideos({ pic: 'a.com/1.jpg' })).toBe(false);
    expect(hasBeforeAfter({ details_link_1: 'a.com/b.jpg' })).toBe(false);
    expect(hasPhotos({})).toBe(false);
  });
  it('an unsafe link never counts as media', () => {
    expect(hasBeforeAfter({ details_link_1: 'javascript:alert(1)', details_link_2: 'a.com/c.jpg' })).toBe(false);
    expect(hasPhotos({ pic: 'javascript:alert(1)' })).toBe(false);
  });
  it('each mode keeps only its kind', () => {
    expect(mediaForMode(both, 'photo').every((m) => m.type === 'image')).toBe(true);
    expect(mediaForMode(both, 'video').map((m) => m.type)).toEqual(['youtube']);
    expect(mediaForMode(both, 'all').length).toBeGreaterThan(2);
  });
  it('a before/after side is an image, a video, or a labelled link', () => {
    expect(sideMedia('https://a.com/b.jpg', 'k')).toEqual([{ type: 'image', url: 'https://a.com/b.jpg' }]);
    expect(sideMedia('https://youtu.be/dQw4w9WgXcQ', 'k')).toEqual([{ type: 'youtube', id: 'dQw4w9WgXcQ' }]);
    expect(sideMedia('https://facebook.com/x', 'popup.moreDetails2')).toEqual([
      { type: 'link', url: 'https://facebook.com/x', labelKey: 'popup.moreDetails2' },
    ]);
    expect(sideMedia(null, 'k')).toEqual([]);
  });
});

describe('type groups (near-me filter)', () => {
  it('every known type is in exactly one group', () => {
    const grouped = groupedTargets().flatMap((g) => g.targets.map(targetKey));
    expect(grouped.sort()).toEqual(ALL_TARGETS.map(targetKey).sort());
  });
  it('real estate, checkpoints, fuel and unknown-to-legacy types land where expected', () => {
    expect(groupOf(target('rent'))).toBe('realestate');
    expect(groupOf(target('road_barriers'))).toBe('roads');
    expect(groupOf(target('fuel_stations'))).toBe('fuel');
    expect(groupOf(target('plumber'))).toBe('technicians');
    expect(groupOf(target('online_stores'))).toBe('misc');
    expect(groupOf({ kind: 'service', discriminator: 'brand_new_type' })).toBe('misc');
  });
  it('no service type is left in "misc" by accident except the two legacy ones', () => {
    const misc = SERVICE_TYPES.filter((s) => groupOf({ kind: 'service', discriminator: s.key }) === 'misc').map((s) => s.key);
    expect(misc.sort()).toEqual(['free_distribution', 'online_stores']);
  });
});

describe('nearestEntries', () => {
  const all = [at('plumber', 'far', 500), at('plumber', 'near', 10), at('clinics', 'mid', 100), at('rent', 'x', 50)];
  it('nearest first, with distance, limited', () => {
    const out = nearestEntries(all, [0, 0], new Set(), 3);
    expect(out.map((r) => r.id)).toEqual(['near', 'x', 'mid']);
    expect(out[0].distance).toBe(10);
  });
  it('only the chosen types', () => {
    expect(nearestEntries(all, [0, 0], new Set(['plumber'])).map((r) => r.id)).toEqual(['near', 'far']);
    expect(nearestEntries(all, [0, 0], new Set(['rent'])).map((r) => r.id)).toEqual(['x']);
    expect(nearestEntries(all, [0, 0], new Set(['hotels']))).toEqual([]);
  });
  it('measures to the nearest edge of a polygon', () => {
    const land = result('land', 'p', new Polygon([[[100, 0], [200, 0], [200, 50], [100, 50], [100, 0]]]));
    expect(nearestEntries([land], [0, 0], new Set())[0].distance).toBe(100);
    expect(nearestEntries([land], [150, 20], new Set())[0].distance).toBe(20); // inside: to the edge
  });
});
