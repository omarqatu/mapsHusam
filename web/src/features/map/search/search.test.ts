import { describe, expect, it } from 'vitest';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { getCenter } from 'ol/extent';
import { buildSearchParams } from '@/api/search';
import { decodeShareState, encodeShareState, buildShareLink, type ShareState } from './shareLink';
import {
  highlightParts,
  normalizeArabic,
  rankHits,
  specialIntent,
  wordHits,
  type GlobalHit,
} from './globalSearch';
import { cascadeFilters, fieldsFor, operatorsFor, withCurrency } from './model';
import { ALL_TARGETS, targetFromKey, targetToApi } from '../targets';
import { applyExtraFilters, EMPTY_EXTRA, findNearby } from './nearby';
import { toResults, type SearchResult } from './results';

const svc = (
  discriminator: string,
  x: number,
  y: number,
  props: Record<string, unknown> = {},
): SearchResult => {
  const geometry = new Point([x, y]);
  const extent = geometry.getExtent();
  return {
    key: `${discriminator}:${x}`,
    target: { kind: 'service', discriminator },
    id: String(x),
    props: { discriminator, ...props },
    geometry,
    center: getCenter(extent) as [number, number],
    extent,
    rating: Number(props.rating) || 0,
  };
};
const land = (): SearchResult => {
  const geometry = new Polygon([
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
  ]);
  return {
    key: 'land:1',
    target: { kind: 'realEstate', layer: 'land' },
    id: '1',
    props: {},
    geometry,
    center: [50, 50],
    extent: geometry.getExtent(),
    rating: 0,
  };
};

describe('query building (matches server.js param names)', () => {
  it('numbers conditions and sets conditions_count only when there are some', () => {
    expect(buildSearchParams({ layer: 'ApartRent', workspace: 'realestate' })).toEqual({
      layer: 'ApartRent',
      workspace: 'realestate',
    });
    const p = buildSearchParams({
      layer: 'ApartRent',
      workspace: 'realestate',
      bbox: [1, 2, 3, 4],
      conditions: [
        { field: 'price', operator: '>', value: '100' },
        { field: '', operator: '=', value: 'x' },
        { field: 'gov_a', operator: '=', value: '' },
        { field: 'currency', operator: '=', value: 'USD' },
      ],
    });
    expect(p).toMatchObject({
      bbox: '1,2,3,4',
      field_0: 'price',
      operator_0: '>',
      value_0: '100',
      field_1: 'currency',
      value_1: 'USD',
      conditions_count: '2',
    });
    expect(p).not.toHaveProperty('field_2');
  });

  it('sends "not empty" columns after the filters, with a value so the server does not skip them', () => {
    expect(
      buildSearchParams({
        layer: 'service_all',
        workspace: 'services',
        conditions: [{ field: 'gov_a', operator: '=', value: 'رام الله' }],
        notEmpty: ['details_link_1', 'details_link_2'],
      }),
    ).toEqual({
      layer: 'service_all',
      workspace: 'services',
      field_0: 'gov_a',
      operator_0: '=',
      value_0: 'رام الله',
      field_1: 'details_link_1',
      operator_1: 'notempty',
      value_1: '1',
      field_2: 'details_link_2',
      operator_2: 'notempty',
      value_2: '1',
      conditions_count: '3',
    });
  });
});

describe('targets', () => {
  it('has 3 real-estate layers + every service type', () => {
    expect(ALL_TARGETS.filter((t) => t.kind === 'realEstate')).toHaveLength(3);
    expect(ALL_TARGETS.length).toBeGreaterThan(60);
    expect(targetToApi(targetFromKey('rent')!)).toEqual({ layer: 'ApartRent', workspace: 'realestate' });
    expect(targetToApi(targetFromKey('land')!)).toEqual({ layer: 'LandSale', workspace: 'realestate' });
    expect(targetToApi(targetFromKey('plumber')!)).toEqual({ layer: 'plumber', workspace: 'services' });
    expect(targetFromKey('electrician')).toEqual({ kind: 'service', discriminator: 'electrician' });
    expect(targetFromKey('nope')).toBeNull();
  });
  it('fields per target: barriers get both directions, fuel gets 3 fuels, real estate gets price/area', () => {
    expect(fieldsFor(targetFromKey('road_barriers')!).map((f) => f.id)).toEqual([
      'gov_a',
      'village_a',
      'location_name',
      'name',
      'stop',
      'stop2',
    ]);
    expect(fieldsFor(targetFromKey('fuel_stations')!).map((f) => f.id)).toEqual([
      'gov_a',
      'village_a',
      'location_name',
      'name',
      'diesel',
      'banzen95',
      'banzen98',
    ]);
    expect(fieldsFor(targetFromKey('rent')!).map((f) => f.id)).toEqual([
      'gov_a',
      'village_a',
      'location',
      'price',
      'area',
    ]);
    expect(fieldsFor(targetFromKey('plumber')!).map((f) => f.id)).toEqual([
      'gov_a',
      'village_a',
      'location_name',
      'name',
    ]);
  });
  it('operators per field type; cascade filters; price adds currency', () => {
    expect(operatorsFor('number')).toEqual(['=', '>', '<']);
    expect(operatorsFor('fixed')).toEqual(['=']);
    const conds = [
      { field: 'gov_a', operator: '=' as const, value: 'رام الله' },
      { field: 'village_a', operator: '=' as const, value: 'البيرة' },
    ];
    expect(cascadeFilters('gov_a', conds)).toEqual({});
    expect(cascadeFilters('village_a', conds)).toEqual({ gov_a: 'رام الله' });
    expect(cascadeFilters('name', conds)).toEqual({ gov_a: 'رام الله', village_a: 'البيرة' });
    expect(withCurrency('price', { field: 'price', operator: '>', value: '5' }, 'USD')).toHaveLength(2);
    expect(withCurrency('price', { field: 'price', operator: '>', value: '5' }, '')).toHaveLength(1);
    expect(withCurrency('area', { field: 'area', operator: '>', value: '5' }, 'USD')).toHaveLength(1);
  });
});

describe('API rows → results', () => {
  it('drops rows without usable coordinates and unknown service types, reads rating', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [10, 20] },
          properties: { id: 1, discriminator: 'plumber', rating: '7.5' },
        },
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [null, null] },
          properties: { id: 2, discriminator: 'plumber' },
        },
        { type: 'Feature' as const, geometry: null, properties: { id: 3, discriminator: 'plumber' } },
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [1, 1] },
          properties: { id: 4, discriminator: 'martian' },
        },
      ],
    };
    const r = toResults(fc, null);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: '1',
      rating: 7.5,
      target: { kind: 'service', discriminator: 'plumber' },
      center: [10, 20],
    });
    expect(toResults(fc, targetFromKey('plumber'))).toHaveLength(2); // a fixed target keeps the row of an unknown type (valid coordinates)
  });
});

describe('nearby search (legacy radius rules)', () => {
  const rows = [
    svc('fuel_stations', 100, 0, { diesel: 0, banzen95: 1 }),
    svc('fuel_stations', 300, 0, { diesel: 0, banzen95: 0 }),
    svc('fuel_stations', 900, 0, { diesel: 1, banzen95: 0 }),
  ];
  const fuel = targetFromKey('fuel_stations')!;
  const at0 = [0, 0] as [number, number];
  it('empty radius → the single closest', () => {
    const o = findNearby(rows, fuel, at0, '', EMPTY_EXTRA);
    expect(o.ok && o.results.map((r) => r.distance)).toEqual([100]);
  });
  it('positive radius → within, nearest first, with distance', () => {
    const o = findNearby(rows, fuel, at0, '350', EMPTY_EXTRA);
    expect(o.ok && o.results.map((r) => r.distance)).toEqual([100, 300]);
  });
  it('radius 0 → only features containing the point', () => {
    const o = findNearby([land(), ...rows], targetFromKey('land')!, [50, 50], '0', EMPTY_EXTRA);
    expect(o.ok && o.results.map((r) => r.key)).toEqual(['land:1']);
    const miss = findNearby([land()], targetFromKey('land')!, [500, 500], '0', EMPTY_EXTRA);
    expect(miss.ok && miss.results).toEqual([]);
  });
  it('extra filters apply BEFORE picking the closest (legacy fix) and fuel filters are AND', () => {
    const extra = { ...EMPTY_EXTRA, fuel: { diesel: '0', banzen95: '0', banzen98: '' } };
    expect(applyExtraFilters(rows, fuel, extra).map((r) => r.key)).toEqual(['fuel_stations:300']);
    const o = findNearby(rows, fuel, at0, '', extra);
    expect(o.ok && o.results.map((r) => r.distance)).toEqual([300]); // closest MATCHING, not closest overall
  });
  it('barrier status filter looks at the inbound `stop` column only', () => {
    const b = [
      svc('road_barriers', 10, 0, { stop: 0, stop2: 1 }),
      svc('road_barriers', 20, 0, { stop: 1, stop2: 0 }),
    ];
    expect(
      applyExtraFilters(b, targetFromKey('road_barriers')!, { ...EMPTY_EXTRA, stop: '1' }).map((r) => r.key),
    ).toEqual(['road_barriers:20']);
  });
  it('rejects negative / NaN / huge radii', () => {
    for (const bad of ['-5', 'abc', '99999999', 'Infinity'])
      expect(findNearby(rows, fuel, at0, bad, EMPTY_EXTRA)).toEqual({ ok: false, reason: 'invalidRadius' });
  });
});

describe('global search text logic', () => {
  it('folds Arabic letter variants', () => {
    expect(normalizeArabic('أحمد إبراهيم')).toBe(normalizeArabic('احمد ابراهيم'));
    expect(normalizeArabic('مدرسة')).toBe(normalizeArabic('مدرسه'));
    expect(normalizeArabic(null)).toBe('');
  });
  it('special intent: longest keyword wins (legacy let "ازمة" override "ازمة خانقة")', () => {
    expect(specialIntent('أزمة خانقة').stops).toEqual(['3']);
    expect(specialIntent('ازمة').stops).toEqual(['2', '3', '4']);
    expect(specialIntent('حاجز مفتوح').stops).toEqual(['0']); // "مفتوح" (5 letters) beats "حاجز"
    expect(specialIntent('حواجز').stops).toEqual(['0', '1', '2', '3', '4']);
    expect(specialIntent('بنزين 95').fuel).toBe('banzen95');
    expect(specialIntent('سولار').fuel).toBe('diesel');
    expect(specialIntent('مطعم')).toEqual({ stops: null, fuel: null });
  });
  it('highlight returns parts (never HTML), matches letter variants, survives regex characters', () => {
    expect(highlightParts('مدرسة الأمل', 'ادرسه')).toEqual([{ text: 'مدرسة الأمل', match: false }]); // no such word
    expect(highlightParts('احمد ابو علي', 'أحمد')).toEqual([
      { text: 'احمد', match: true },
      { text: ' ابو علي', match: false },
    ]);
    expect(() => highlightParts('a (b) c', '(b')).not.toThrow();
    expect(highlightParts('a (b) c', '(b').some((p) => p.match)).toBe(true);
    expect(
      highlightParts('<img onerror=x>', 'img')
        .map((p) => p.text)
        .join(''),
    ).toBe('<img onerror=x>');
  });
  it('ranks: type-name match, then more matched words, then rating', () => {
    const title = (t: { kind: string; discriminator?: string }) =>
      t.kind === 'service' && t.discriminator === 'electrician' ? 'فني كهرباء' : 'سباك';
    const a = svc('electrician', 1, 0, { name: 'x', rating: 1 });
    const b = svc('plumber', 2, 0, { name: 'كهرباء بيت', des: 'كهرباء', rating: 9 });
    const c = svc('plumber', 3, 0, { name: 'y', rating: 10 });
    const hits: GlobalHit[] = [c, b, a].map((result) => ({ result }));
    const ranked = rankHits(hits, 'كهرباء', title as never).map((h) => h.result.id);
    expect(ranked).toEqual(['1', '2', '3']);
    expect(wordHits(b, 'كهرباء بيت')).toBe(2);
  });
});

describe('share links', () => {
  const state: ShareState = {
    type: 'attribute',
    target: 'rent',
    conditions: [{ field: 'gov_a', operator: '=', value: 'رام الله' }],
  };
  it('round-trips Unicode and stays URL-safe', () => {
    const enc = encodeShareState(state);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(enc)).toEqual(state);
  });
  it('round-trips the other two types', () => {
    const q: ShareState = { type: 'quick', target: 'electrician', bbox: '1,2,3,4.5' };
    const l: ShareState = {
      type: 'location',
      target: 'fuel_stations',
      center: [169000.5, 145000],
      radius: '500',
      extra: { stop: '', fuel: { diesel: '0', banzen95: '', banzen98: '' } },
    };
    expect(decodeShareState(encodeShareState(q))).toEqual(q);
    expect(decodeShareState(encodeShareState(l))).toEqual(l);
  });
  it('rejects garbage and wrong shapes (links come from strangers)', () => {
    const enc = (o: unknown) => encodeShareState(o as ShareState);
    for (const bad of [
      null,
      '',
      'not base64!!',
      enc([]),
      enc('x'),
      enc({ type: 'nope', target: 'rent' }),
      enc({ type: 'location', target: 'rent', center: ['a', 'b'] }),
      enc({ type: 'quick' }),
    ]) {
      expect(decodeShareState(bad)).toBeNull();
    }
    expect(decodeShareState(enc({ type: 'quick', target: 'rent', bbox: '1,2,x,4' }))).toEqual({
      type: 'quick',
      target: 'rent',
      bbox: undefined,
    });
    expect(
      decodeShareState(
        enc({
          type: 'attribute',
          target: 'rent',
          conditions: [
            { field: 'a', operator: 'DROP', value: 'x' },
            { field: 'a', operator: '=', value: 'x' },
          ],
        }),
      ),
    ).toEqual({ type: 'attribute', target: 'rent', conditions: [{ field: 'a', operator: '=', value: 'x' }] });
  });
  it('builds a full link', () =>
    expect(buildShareLink(state, 'https://h.example', '/')).toMatch(
      /^https:\/\/h\.example\/\?resultsShare=[A-Za-z0-9_-]+$/,
    ));
});
