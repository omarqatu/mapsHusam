// @vitest-environment node
// Real-backend check of every endpoint the extras panel uses. NOT mocked (see src/api/live.test.ts for how to run):
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { featuredApi } from '@/api/featured';
import { liveStatusApi } from '@/api/liveStatus';
import { platformApi } from '@/api/platform';
import { searchApi } from '@/api/search';
import { toResults } from '../search/results';
import { targetFromKey } from '../targets';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

describe.skipIf(!BASE)('live backend — extras endpoints', () => {
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
  });

  it('platform-stats returns every counter the stats tab shows, as numbers', async () => {
    const res = await platformApi.stats();
    expect(res.success).toBe(true);
    for (const k of [
      'usersTotal', 'usersAdmin', 'usersUser', 'usersProvider',
      'viewsTotal', 'viewsMap', 'viewsQuickSearch', 'servicesCount', 'featuresCount',
    ] as const)
      expect(typeof res.data?.[k]).toBe('number');
    expect(res.data!.usersTotal).toBe(res.data!.usersAdmin + res.data!.usersUser + res.data!.usersProvider);
    expect(res.data!.viewsTotal).toBe(res.data!.viewsMap + res.data!.viewsQuickSearch);
  });

  it('widgets-data has both "last updated" stamps (ISO string or null)', async () => {
    const d = await liveStatusApi.updatedAt();
    expect(d.success).toBe(true);
    for (const v of [d.road_status_updated_at, d.fuel_status_updated_at])
      expect(v === null || !Number.isNaN(Date.parse(v))).toBe(true);
  });

  it('road_barriers rows are checkpoints with inbound/outbound columns, and become map results', async () => {
    const fc = await liveStatusApi.rows('road_barriers');
    expect(fc.type).toBe('FeatureCollection');
    const target = targetFromKey('road_barriers')!;
    const results = toResults(fc, target);
    expect(results.length).toBe(fc.features.length);
    for (const r of results) {
      expect(r.props.discriminator).toBe('road_barriers');
      expect(r.props).toHaveProperty('stop');
      expect(r.props).toHaveProperty('stop2');
    }
  });

  it('fuel_stations rows carry the three availability columns', async () => {
    const fc = await liveStatusApi.rows('fuel_stations');
    for (const f of fc.features) {
      expect(f.properties.discriminator).toBe('fuel_stations');
      for (const col of ['diesel', 'banzen95', 'banzen98']) expect(f.properties).toHaveProperty(col);
    }
  });

  it('rating searches answer for services and for each property layer', async () => {
    const conditions = [{ field: 'rating', operator: '=' as const, value: '10' }];
    for (const [layer, workspace] of [
      ['service_all', 'services'],
      ['ApartRent', 'realestate'],
      ['ApartSale', 'realestate'],
      ['LandSale', 'realestate'],
    ] as const) {
      const fc = await searchApi.search({ layer, workspace, conditions });
      expect(fc.type).toBe('FeatureCollection');
      for (const f of fc.features) expect(Number(f.properties.rating)).toBe(10);
    }
  });

  it('top-rated ranking items are {service_layer, feature_id, avg_rating, total_ratings}', async () => {
    const res = await featuredApi.topRated(15);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.items)).toBe(true);
    for (const item of res.items)
      for (const k of ['service_layer', 'feature_id', 'avg_rating', 'total_ratings']) expect(item).toHaveProperty(k);
  });

  it('batch returns the asked features by id', async () => {
    const all = await liveStatusApi.rows('fuel_stations');
    const ids = all.features.slice(0, 2).map((f) => f.properties.id as number);
    if (ids.length === 0) return;
    const fc = await searchApi.batch({ layer: 'fuel_stations', workspace: 'services', ids });
    expect(fc.features.map((f) => f.properties.id).sort()).toEqual([...ids].sort());
    expect(fc.features[0].geometry).not.toBeNull();
  });
});
