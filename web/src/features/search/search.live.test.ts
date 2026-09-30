// @vitest-environment node
// Real-backend check of what the /search page sends. NOT mocked (see src/api/live.test.ts for how to run):
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { mapEventsApi } from '@/api/mapEvents';
import { searchApi } from '@/api/search';
import { useAuthStore } from '@/store/authStore';
import { fetchGlobalHits } from '../map/search/globalSearch';
import { toResults } from '../map/search/results';
import { targetFromKey, targetToApi } from '../map/targets';
import { filterFields, toConditions, fromConditions } from './filters';
import { sortResults } from './sort';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

describe.skipIf(!BASE)('live backend — /search page', () => {
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('a whole real-estate layer loads without login and filters narrow it', async () => {
    const rent = targetFromKey('rent')!;
    const all = toResults(await searchApi.search(targetToApi(rent)), rent);
    expect(all.length).toBeGreaterThan(0);
    const fields = filterFields(rent);
    const conditions = toConditions(
      { values: { price: { value: '1000000', operator: '<' } }, currency: '' },
      fields,
    );
    const some = toResults(await searchApi.search({ ...targetToApi(rent), conditions }), rent);
    expect(some.length).toBeLessThanOrEqual(all.length);
    expect(fromConditions(conditions).values.price.operator).toBe('<');
    expect(sortResults(all, 'rating')[0].rating).toBeGreaterThanOrEqual(sortResults(all, 'rating').at(-1)!.rating);
  });

  it('a huge conditions_count is capped: it answers at once and the server stays up', async () => {
    // Before the cap one such request froze the whole server (a synchronous loop of that many rounds).
    const started = Date.now();
    const res = await fetch(
      '/api/search-features?layer=plumber&workspace=services&conditions_count=300000000&field_0=name&operator_0=contains&value_0=a',
      { signal: AbortSignal.timeout(10_000) },
    );
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect((await fetch('/healthz', { signal: AbortSignal.timeout(5_000) })).status).toBe(200);
  });

  it('dropdown values come back for the governorate field', async () => {
    const rent = targetFromKey('rent')!;
    const r = await searchApi.uniqueValues({ ...targetToApi(rent), field: 'gov_a' });
    expect(r.success).toBe(true);
    expect(r.values.length).toBeGreaterThan(0);
  });

  it('the keyword search finds services by their type name', async () => {
    const hits = await fetchGlobalHits('كهرباء');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('a logged-in visitor can log a no_map_search event filed under quick_search', async () => {
    const login = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(login.user);
    await expect(
      mapEventsApi.logMapEvent({ event_type: 'no_map_search', provider: null, service: 'test', source: 'quick_search' }),
    ).resolves.toBeDefined();
  });
});
