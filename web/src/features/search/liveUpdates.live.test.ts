// @vitest-environment node
// Real-backend test (no mocks) for the landing's live data:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// - GET /api/category-counts must agree with what the search itself returns for a type;
// - an admin save pushes `widgets_updated` / `status_updated` over the socket (values are written back unchanged).
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminWidgetsApi } from '@/api/adminWidgets';
import { authApi } from '@/api/auth';
import { fuelApi } from '@/api/fuel';
import { marketApi } from '@/api/market';
import { platformApi } from '@/api/platform';
import { searchApi } from '@/api/search';
import { widgetsApi } from '@/api/widgets';
import { useAuthStore } from '@/store/authStore';
import { groupItems } from '../widgets/model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

/** Resolves with the first payload of `event`, or rejects after `ms`. */
const once = <T>(socket: Socket, event: string, ms = 5000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    socket.once(event, (p: T) => {
      clearTimeout(timer);
      resolve(p);
    });
  });

describe.skipIf(!BASE)('landing live data against the live backend', () => {
  let socket: Socket | null = null;
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
  });
  afterAll(() => {
    socket?.disconnect();
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('counts the visible listings per type, the same as the search shows', async () => {
    const res = await platformApi.categoryCounts();
    expect(res.success).toBe(true);
    const counts = res.data!.counts;
    for (const key of ['ApartRent', 'ApartSale', 'LandSale']) expect(typeof counts[key], key).toBe('number');
    const plumbers = await searchApi.search({ layer: 'plumber', workspace: 'services' });
    expect(counts.plumber).toBe(plumbers.features.length);
    const rent = await searchApi.search({ layer: 'ApartRent', workspace: 'realestate' });
    expect(counts.ApartRent).toBe(rent.features.length);
  });

  // The server calls open.er-api.com and api.gold-api.com: a 502 means both are unreachable from here (offline), not a bug.
  it('serves world rates and the gold price (or a clean 502 when the sources are unreachable)', async () => {
    const res = await marketApi.rates().catch((e: { status?: number }) => e);
    if ('status' in res && res.status === 502) return;
    const d = (res as Awaited<ReturnType<typeof marketApi.rates>>).data!;
    expect(d.rates ?? d.gold).toBeTruthy();
    if (d.rates) for (const v of [d.rates.USD_ILS, d.rates.JOD_ILS, d.rates.EUR_ILS]) expect(v).toBeGreaterThan(0.5);
    if (d.gold?.ilsPerGram24 && d.gold.ilsPerGram21) expect(d.gold.ilsPerGram21).toBeCloseTo(d.gold.ilsPerGram24 * 0.875, 5);
    // Gold is a real spot price (thousands of dollars an ounce, silver far below it) and the sources say when they published.
    if (d.gold) {
      expect(d.gold.usdPerOunce).toBeGreaterThan(1000);
      if (d.silver) expect(d.silver.usdPerOunce).toBeLessThan(d.gold.usdPerOunce / 10);
      expect(Number.isNaN(Date.parse(d.gold.asOf ?? ''))).toBe(false);
    }
    expect(Number.isNaN(Date.parse(d.updatedAt))).toBe(false);
  });

  // The server reads thefuelprice.com: a 502 means it is unreachable from here (offline) or the page changed shape.
  it('serves the fuel prices the source publishes, all in a plausible range (or a clean 502)', async () => {
    const res = await fuelApi.prices().catch((e: { status?: number }) => e);
    if ('status' in res && res.status === 502) return;
    const d = (res as Awaited<ReturnType<typeof fuelApi.prices>>).data!;
    const by = Object.fromEntries(d.items.map((i) => [i.key, i]));
    expect(d.items.length).toBeGreaterThanOrEqual(4);
    for (const key of ['fuel-95', 'fuel-98', 'fuel-diesel']) if (by[key]) expect(by[key].value).toBeGreaterThan(3);
    // petrol 98 costs more than 95; a 48 kg cylinder more than a 12 kg one
    if (by['fuel-95'] && by['fuel-98']) expect(by['fuel-98'].value).toBeGreaterThan(by['fuel-95'].value);
    if (by['fuel-gas-cylinder'] && by['fuel-gas-large']) expect(by['fuel-gas-large'].value).toBeGreaterThan(by['fuel-gas-cylinder'].value);
    expect(Number.isNaN(Date.parse(d.fetchedAt))).toBe(false);
  });

  it('pushes widgets_updated and status_updated to a logged-in socket when an admin saves', async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    socket = io(BASE, { auth: { token: user.token }, transports: ['websocket'] });
    await once(socket, 'connect');

    const events = groupItems(await widgetsApi.data(), 'events');
    const widgets = once<{ group: string }>(socket, 'widgets_updated');
    await adminWidgetsApi.saveGroup('events', events);
    expect((await widgets).group).toBe('events');

    const barriers = await searchApi.search({ layer: 'road_barriers', workspace: 'services' });
    const props = barriers.features[0]?.properties as { id: number; stop: string } | undefined;
    expect(props, 'seed has a road barrier').toBeTruthy();
    const status = once<{ layer: string }>(socket, 'status_updated');
    await adminWidgetsApi.updateRoad(props!.id, { stop: props!.stop });
    expect((await status).layer).toBe('road_barriers');
  });

  it('does not let a socket connect without a token (visitors keep polling)', async () => {
    const anon = io(BASE, { transports: ['websocket'], reconnection: false });
    const err = await once<Error>(anon, 'connect_error');
    expect(err.message).toBe('unauthorized');
    anon.disconnect();
  });
});
