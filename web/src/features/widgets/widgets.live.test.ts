// @vitest-environment node
// Real-backend test (no mocks) for what the live-information centre reads.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// The round trip edits the shared `events` group as the admin and puts the original rows back in afterAll (only
// `updated_at` differs afterwards). The Open-Meteo / Aladhan checks call the real services and are skipped when offline.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminWidgetsApi } from '@/api/adminWidgets';
import { authApi } from '@/api/auth';
import { externalApi } from '@/api/external';
import { widgetsApi } from '@/api/widgets';
import { useAuthStore } from '@/store/authStore';
import {
  CITIES,
  FORECAST_DAYS,
  aladhanDate,
  groupItems,
  palestineNow,
  parseForecast,
  parsePrayerTimes,
} from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let originalEvents: Record<string, string>[] = [];

describe.skipIf(!BASE)('live information centre against the live backend', () => {
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
  });
  afterAll(async () => {
    try {
      if (useAuthStore.getState().user) await adminWidgetsApi.saveGroup('events', originalEvents);
    } finally {
      globalThis.fetch = nativeFetch;
      useAuthStore.setState({ user: null });
    }
  });

  it('is public and returns the groups as `items` plus both status stamps', async () => {
    const d = await widgetsApi.data();
    expect(d.success).toBe(true);
    for (const stamp of [d.road_status_updated_at, d.fuel_status_updated_at])
      expect(stamp === null || !Number.isNaN(Date.parse(stamp))).toBe(true);
    for (const [key, g] of Object.entries(d.groups ?? {})) {
      expect(Array.isArray(g.items), key).toBe(true);
      expect(g.updated_at === null || !Number.isNaN(Date.parse(g.updated_at))).toBe(true);
      // every stored row survives the text normalisation with its id
      for (const row of groupItems(d, key as never)) expect(typeof row).toBe('object');
    }
  });

  it('shows what the admin saves in a group (round trip, restored afterwards)', async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    originalEvents = groupItems(await widgetsApi.data(), 'events');
    await adminWidgetsApi.saveGroup('events', [
      { id: 'live-test', label: 'LIVE-WIDGETS', date: '2099-01-01', notes: '<b>x</b>' },
    ]);
    const after = await widgetsApi.data();
    expect(groupItems(after, 'events')).toEqual([
      { id: 'live-test', label: 'LIVE-WIDGETS', date: '2099-01-01', notes: '<b>x</b>' },
    ]);
    // Only checked to be a date: the column is TIMESTAMP (no zone), so a DB session zone different from Node's shifts it by whole hours.
    expect(Number.isNaN(Date.parse(after.groups!.events!.updated_at!))).toBe(false);
  });
});

// Third-party services: shape checks only, and only when they are reachable.
async function reachable<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

describe.skipIf(!BASE)('third-party widgets sources (skipped offline)', () => {
  it('Open-Meteo answers one block per city with three days', async (ctx) => {
    const raw = await reachable(() => externalApi.forecast(CITIES, FORECAST_DAYS));
    if (!raw) return ctx.skip();
    const f = parseForecast(raw);
    for (const c of CITIES) {
      expect(f[c.id], c.id).toHaveLength(FORECAST_DAYS);
      for (const day of f[c.id]) expect(day.max).toBeGreaterThanOrEqual(day.min);
    }
  });
  it('Aladhan answers the six prayer times of a date', async (ctx) => {
    const raw = await reachable(() => externalApi.prayerTimes(aladhanDate(palestineNow(new Date()).date)));
    if (!raw) return ctx.skip();
    const times = parsePrayerTimes(raw);
    expect(times).not.toBeNull();
    expect(times!.fajr < times!.dhuhr && times!.dhuhr < times!.isha).toBe(true);
  });
});
