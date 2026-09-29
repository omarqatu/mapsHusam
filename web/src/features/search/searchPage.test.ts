import { describe, expect, it } from 'vitest';
import type { SearchCondition } from '@/api/search';
import { toResults } from '../map/search/results';
import { targetFromKey } from '../map/targets';
import { GROUP_IDS, singleTargetOf, targetsInGroup } from './categories';
import { EMPTY_FILTERS, countActive, filterFields, fromConditions, setFilter, toConditions } from './filters';
import { mapSearchPath, readSelection, writeSelection } from './selection';
import { sortResults } from './sort';

const rent = targetFromKey('rent')!;
const plumber = targetFromKey('plumber')!;

describe('filters', () => {
  const fields = filterFields(rent);

  it('turns filled inputs into conditions; ranges default to ≤ and price adds the currency', () => {
    let s = setFilter(EMPTY_FILTERS, fields, 'gov_a', { value: 'رام الله' });
    s = setFilter(s, fields, 'price', { value: '500' });
    s = { ...s, currency: 'USD' };
    expect(toConditions(s, fields)).toEqual([
      { field: 'gov_a', operator: '=', value: 'رام الله' },
      { field: 'price', operator: '<', value: '500' },
      { field: 'currency', operator: '=', value: 'USD' },
    ]);
  });

  it('filters by currency alone (legacy)', () => {
    expect(toConditions({ ...EMPTY_FILTERS, currency: 'ILS' }, fields)).toEqual([
      { field: 'currency', operator: '=', value: 'ILS' },
    ]);
  });

  it('round-trips through conditions (shared link / back button)', () => {
    const conditions: SearchCondition[] = [
      { field: 'village_a', operator: '=', value: 'البيرة' },
      { field: 'area', operator: '>', value: '100' },
      { field: 'currency', operator: '=', value: 'JOD' },
    ];
    const state = fromConditions(conditions);
    expect(state.currency).toBe('JOD');
    expect(state.values.area).toEqual({ value: '100', operator: '>' });
    expect(toConditions(state, fields)).toEqual([
      { field: 'village_a', operator: '=', value: 'البيرة' },
      { field: 'currency', operator: '=', value: 'JOD' },
      { field: 'area', operator: '>', value: '100' },
    ]);
  });

  it('choosing a governorate empties the town and place below it, keeps numbers', () => {
    let s = setFilter(EMPTY_FILTERS, fields, 'village_a', { value: 'البيرة' });
    s = setFilter(s, fields, 'location', { value: 'وسط البلد' });
    s = setFilter(s, fields, 'area', { value: '90' });
    s = setFilter(s, fields, 'gov_a', { value: 'رام الله' });
    expect(Object.keys(s.values).sort()).toEqual(['area', 'gov_a']);
    expect(countActive(s)).toBe(2);
  });

  it('clearing an input removes it', () => {
    const s = setFilter(setFilter(EMPTY_FILTERS, fields, 'gov_a', { value: 'x' }), fields, 'gov_a', null);
    expect(s.values).toEqual({});
  });

  it('offers checkpoint status and fuel lists only for those types', () => {
    const ids = (k: string) => filterFields(targetFromKey(k)!).map((f) => f.id);
    expect(ids('road_barriers')).toContain('stop2');
    expect(ids('fuel_stations')).toEqual(expect.arrayContaining(['diesel', 'banzen95', 'banzen98']));
    expect(ids('plumber')).not.toContain('stop');
  });
});

describe('selection in the URL', () => {
  it('a type without filters is ?type=, with filters it is the map results-link format', () => {
    const plain = writeSelection(new URLSearchParams('group=health'), { target: plumber, conditions: [] });
    expect(plain.get('type')).toBe('plumber');
    expect(plain.get('group')).toBe('health');
    expect(plain.get('resultsShare')).toBeNull();

    const conditions: SearchCondition[] = [{ field: 'gov_a', operator: '=', value: 'رام الله' }];
    const filtered = writeSelection(plain, { target: plumber, conditions });
    expect(filtered.get('type')).toBeNull();
    const back = readSelection(filtered);
    expect(back?.conditions).toEqual(conditions);
    expect(back?.target).toEqual(plumber);
  });

  it('ignores unknown types and garbage', () => {
    expect(readSelection(new URLSearchParams('type=nope'))).toBeNull();
    expect(readSelection(new URLSearchParams('resultsShare=%%%'))).toBeNull();
  });

  it('the map link carries the same search', () => {
    const path = mapSearchPath({ target: rent, conditions: [{ field: 'price', operator: '<', value: '5' }] });
    const q = new URLSearchParams(path.slice(path.indexOf('?')));
    expect(readSelection(q)?.conditions[0].field).toBe('price');
  });

  it('clearing removes both forms', () => {
    const n = writeSelection(new URLSearchParams('type=plumber&q=x'), null);
    expect(n.get('type')).toBeNull();
    expect(n.get('q')).toBe('x');
  });
});

describe('categories', () => {
  it('has the 13 legacy groups plus all; single-type groups open directly', () => {
    expect(GROUP_IDS).toHaveLength(14);
    expect(singleTargetOf('fuel')).toEqual(targetFromKey('fuel_stations'));
    expect(singleTargetOf('roads')).toEqual(targetFromKey('road_barriers'));
    expect(singleTargetOf('realestate')).toBeNull();
    expect(singleTargetOf('all')).toBeNull();
    expect(targetsInGroup('realestate')).toHaveLength(3);
    expect(targetsInGroup('all')[0]).toEqual(targetFromKey('rent'));
  });
});

describe('sorting', () => {
  const point = (x: number, y: number) => ({ type: 'Point' as const, coordinates: [x, y] });
  const row = (id: number, name: string, rating: string, price: string | null, x: number) => ({
    type: 'Feature' as const,
    geometry: point(x, 0),
    properties: { fid: String(id), name, rating, price },
  });
  const items = toResults(
    {
      type: 'FeatureCollection',
      features: [row(1, 'ب', '3', '900', 100), row(2, 'أ', '9', null, 300), row(3, 'ج', '5', '400', 10)],
    },
    rent,
  );
  const ids = (l: { id: string | null }[]) => l.map((r) => r.id);

  it('rating puts the best first (legacy) without touching the input', () => {
    expect(ids(sortResults(items, 'rating'))).toEqual(['2', '3', '1']);
    expect(ids(items)).toEqual(['1', '2', '3']);
  });
  it('name uses Arabic collation', () => {
    expect(ids(sortResults(items, 'name'))).toEqual(['2', '1', '3']);
  });
  it('price puts rows without a price last in both directions', () => {
    expect(ids(sortResults(items, 'priceAsc'))).toEqual(['3', '1', '2']);
    expect(ids(sortResults(items, 'priceDesc'))).toEqual(['1', '3', '2']);
  });
  it('nearest adds distances and sorts by them', () => {
    const sorted = sortResults(items, 'nearest', [0, 0]);
    expect(ids(sorted)).toEqual(['3', '1', '2']);
    expect(sorted[0].distance).toBeCloseTo(10);
  });
  it('nearest without a position falls back to rating', () => {
    expect(ids(sortResults(items, 'nearest', null))).toEqual(['2', '3', '1']);
  });
});
