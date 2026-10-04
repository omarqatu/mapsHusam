// @vitest-environment node
// Real-backend test (no mocks) for the visibility setting.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- visibility.live
// It saves a choice under `settings.visibility` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { api, ApiError } from '@/api/client';
import { fetchWfs } from '@/api/geoserver';
import { platformContentApi } from '@/api/platformContent';
import { searchApi } from '@/api/search';
import { useAuthStore } from '@/store/authStore';
import { ALL_VISIBLE, VISIBILITY_KEY, parseVisibility, serializeVisibility, withLayers, withSection } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: string | null = null;

const readStored = async () => (await platformContentApi.get(VISIBILITY_KEY)).item?.content_value ?? null;

describe.skipIf(!BASE)('visibility setting against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
    original = await readStored();
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
  });
  afterAll(async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    if (original === null) await api.delete(`/api/admin/platform-content/${VISIBILITY_KEY}`);
    else await platformContentApi.save(VISIBILITY_KEY, 'إظهار وإخفاء الطبقات والأقسام', original);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves a choice and a visitor reads it back through the one-key endpoint', async () => {
    const choice = withSection(withLayers(ALL_VISIBLE, ['plumber', 'rent'], false), 'ticker', false);
    await platformContentApi.save(VISIBILITY_KEY, 'test', serializeVisibility(choice));

    useAuthStore.setState({ user: null }); // a visitor
    const stored = parseVisibility(await readStored());
    expect([...stored.hiddenLayers].sort()).toEqual(['plumber', 'rent']);
    expect([...stored.hiddenSections]).toEqual(['ticker']);
  });

  it('the server itself leaves a hidden layer out: search, counts and GeoServer (the admin still gets it)', async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    await platformContentApi.save(VISIBILITY_KEY, 'test', serializeVisibility(withLayers(ALL_VISIBLE, ['plumber', 'land'], false)));
    const admin = useAuthStore.getState().user;
    const wfs = (typeName: string, workspace: string) =>
      fetchWfs({ workspace, typeName, srsName: 'EPSG:28191' }, { timeoutMs: 15000 }) as Promise<{
        features: { properties: Record<string, unknown> }[];
      }>;
    const plumbersInWfs = async () =>
      (await wfs('service_all', 'services')).features.filter((f) => f.properties.discriminator === 'plumber').length;

    useAuthStore.setState({ user: null }); // a visitor
    expect((await searchApi.search({ layer: 'plumber', workspace: 'services' })).features).toHaveLength(0);
    expect((await searchApi.search({ layer: 'LandSale', workspace: 'realestate' })).features).toHaveLength(0);
    const counts = (await api.get<{ data: { counts: Record<string, number> } }>('/api/category-counts')).data.counts;
    expect(counts.plumber).toBeUndefined();
    expect(counts.LandSale).toBeUndefined();
    let gsUp = true;
    try {
      expect(await plumbersInWfs()).toBe(0);
      expect((await wfs('LandSale', 'realestate')).features).toHaveLength(0);
    } catch (e) {
      if (!(e instanceof Error) || !/HTTP 50|fetch failed/.test(e.message)) throw e;
      gsUp = false; // no local GeoServer: the proxy part is covered by lib/listing-rules.test.js
    }

    useAuthStore.setState({ user: admin });
    expect((await searchApi.search({ layer: 'plumber', workspace: 'services' })).features.length).toBeGreaterThan(0);
    if (gsUp) expect(await plumbersInWfs()).toBeGreaterThan(0);
  });

  it('a client filter on a listing layer is refused for the public', async () => {
    useAuthStore.setState({ user: null });
    const res = await fetch(`/geoserver-proxy/services/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=services:service_all&CQL_FILTER=1%3D1`);
    expect(res.status).toBe(403);
  });

  it('a key nobody saved answers item: null (not an error: every visitor asks for it)', async () => {
    expect(await platformContentApi.get('settings.no-such-key')).toEqual({ success: true, item: null });
  });

  it('a normal user cannot change it', async () => {
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    await expect(platformContentApi.save(VISIBILITY_KEY, 'x', '{}')).rejects.toBeInstanceOf(ApiError);
  });
});
