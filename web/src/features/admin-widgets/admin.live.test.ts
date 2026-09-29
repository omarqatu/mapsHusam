// @vitest-environment node
// Real-backend test (no mocks) for the live-information admin endpoints.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// It edits shared dev data (one widget group, a few checkpoints / stations) and puts every value back in afterAll.
// Only `updated_at` stamps and `display_order` (restored to the same visible order) can differ afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminWidgetsApi,
  type FuelStationRow,
  type RoadBarrierRow,
  type WidgetGroupKey,
} from '@/api/adminWidgets';
import { authApi } from '@/api/auth';
import { liveStatusApi } from '@/api/liveStatus';
import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

let groupKey: WidgetGroupKey;
let originalItems: Record<string, string>[] = [];
let roads: RoadBarrierRow[] = [];
let fuels: FuelStationRow[] = [];

const other = (v: unknown) => (Number(v) === 0 ? '1' : '0');

describe.skipIf(!BASE)('live information admin endpoints against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    const groups = (await adminWidgetsApi.groups()).groups;
    groupKey = (Object.keys(groups)[0] ?? 'events') as WidgetGroupKey;
    originalItems = groups[groupKey]?.data ?? [];
    const f = await adminWidgetsApi.features();
    roads = f.roadBarriers;
    fuels = f.fuelStations;
  });
  afterAll(async () => {
    try {
      await adminWidgetsApi.saveGroup(groupKey, originalItems);
      // road: every saved row back to its original values (rows with a null value were never touched)
      const roadItems = roads
        .filter((r) => r.stop != null && r.stop2 != null)
        .map((r) => ({ id: r.id, stop: String(r.stop), stop2: String(r.stop2) }));
      if (roadItems.length) await adminWidgetsApi.batchRoad(roadItems);
      for (const s of fuels)
        await adminWidgetsApi.updateFuel(s.id, {
          diesel: s.diesel,
          banzen95: s.banzen95,
          banzen98: s.banzen98,
        });
      await adminWidgetsApi.reorder(
        'road_barriers',
        roads.map((r) => r.id),
      );
      await adminWidgetsApi.reorder(
        'fuel_stations',
        fuels.map((s) => s.id),
      );
    } finally {
      globalThis.fetch = nativeFetch;
      useAuthStore.setState({ user: null });
    }
  });

  it('reads the groups and saves one; the row and the new update stamp read back; bad input is 400', async () => {
    const before = (await adminWidgetsApi.groups()).groups[groupKey]?.updated_at ?? null;
    const items = [...originalItems, { id: 'live-test-row', label: 'LIVE', value: '1' }];
    await adminWidgetsApi.saveGroup(groupKey, items);
    const after = (await adminWidgetsApi.groups()).groups[groupKey]!;
    expect(after.data).toEqual(items);
    expect(after.updated_at).not.toBe(before);
    await expect(adminWidgetsApi.saveGroup('nope' as WidgetGroupKey, [])).rejects.toMatchObject({
      status: 400,
    });
    await expect(adminWidgetsApi.saveGroup(groupKey, 'x' as never)).rejects.toMatchObject({ status: 400 });
  });

  it('lists checkpoints and stations with numeric status columns', () => {
    expect(roads.length).toBeGreaterThan(0);
    expect(fuels.length).toBeGreaterThan(0);
    expect(roads[0]).toHaveProperty('stop');
    expect(roads[0]).toHaveProperty('stop2');
    expect(fuels[0]).toHaveProperty('banzen95');
  });

  it('updates one checkpoint (inbound only, then outbound only), bumping the public "last update"', async () => {
    const r = roads.find((x) => x.stop != null && x.stop2 != null)!;
    const stampBefore = (await liveStatusApi.updatedAt()).road_status_updated_at;
    await adminWidgetsApi.updateRoad(r.id, { stop: other(r.stop) });
    let now = (await adminWidgetsApi.features()).roadBarriers.find((x) => x.id === r.id)!;
    expect(String(now.stop)).toBe(other(r.stop));
    expect(String(now.stop2)).toBe(String(r.stop2));
    await adminWidgetsApi.updateRoad(r.id, { stop2: other(r.stop2) });
    now = (await adminWidgetsApi.features()).roadBarriers.find((x) => x.id === r.id)!;
    expect(String(now.stop2)).toBe(other(r.stop2));
    expect((await liveStatusApi.updatedAt()).road_status_updated_at).not.toBe(stampBefore);
    await expect(adminWidgetsApi.updateRoad(r.id, { stop: '9' })).rejects.toMatchObject({ status: 400 });
    await expect(adminWidgetsApi.updateRoad(r.id, {})).rejects.toMatchObject({ status: 400 });
    await expect(adminWidgetsApi.updateRoad(999999999, { stop: '1' })).rejects.toMatchObject({ status: 404 });
  });

  it('updates one station (all three columns, a null stays null)', async () => {
    const s = fuels[0];
    await adminWidgetsApi.updateFuel(s.id, {
      diesel: Number(other(s.diesel)),
      banzen95: s.banzen95,
      banzen98: null,
    });
    const now = (await adminWidgetsApi.features()).fuelStations.find((x) => x.id === s.id)!;
    expect(String(now.diesel)).toBe(other(s.diesel));
    expect(now.banzen98).toBeNull();
    await expect(
      adminWidgetsApi.updateFuel(999999999, { diesel: 0, banzen95: 0, banzen98: 0 }),
    ).resolves.toBeTruthy(); // legacy: no 404
  });

  it('bulk-updates the ticked checkpoints / stations only', async () => {
    const two = roads.filter((r) => r.stop != null).slice(0, 2);
    const untouched = roads.find((r) => !two.includes(r));
    const res = await adminWidgetsApi.bulkRoad(
      two.map((r) => r.id),
      { stop: '3' },
    );
    expect(res.updated).toBe(two.length);
    const now = (await adminWidgetsApi.features()).roadBarriers;
    two.forEach((r) => expect(String(now.find((x) => x.id === r.id)!.stop)).toBe('3'));
    if (untouched) expect(now.find((x) => x.id === untouched.id)!.stop).toBe(untouched.stop);
    await expect(adminWidgetsApi.bulkRoad([], { stop: '1' })).rejects.toMatchObject({ status: 400 });
    await expect(adminWidgetsApi.bulkRoad([two[0].id], {})).rejects.toMatchObject({ status: 400 });

    const stations = fuels.slice(0, 2).map((s) => s.id);
    const r2 = await adminWidgetsApi.bulkFuel(stations, { banzen98: '1' });
    expect(r2.updated).toBe(stations.length);
    await expect(adminWidgetsApi.bulkFuel(stations, { diesel: '7' })).rejects.toMatchObject({ status: 400 });
    await expect(adminWidgetsApi.bulkFuel(stations, {})).rejects.toMatchObject({ status: 400 });
  });

  it('batch save applies each row its own values in one transaction (all or nothing)', async () => {
    const [a, b] = roads.filter((r) => r.stop != null && r.stop2 != null);
    const res = await adminWidgetsApi.batchRoad([
      { id: a.id, stop: '2' },
      { id: b.id, stop2: '4' },
    ]);
    expect(res.updated).toBe(2);
    const now = (await adminWidgetsApi.features()).roadBarriers;
    expect(String(now.find((x) => x.id === a.id)!.stop)).toBe('2');
    expect(String(now.find((x) => x.id === b.id)!.stop2)).toBe('4');
    // one invalid row rejects the whole batch: nothing changes
    await expect(
      adminWidgetsApi.batchRoad([
        { id: a.id, stop: '0' },
        { id: b.id, stop: '9' },
      ]),
    ).rejects.toMatchObject({ status: 400 });
    expect(String((await adminWidgetsApi.features()).roadBarriers.find((x) => x.id === a.id)!.stop)).toBe(
      '2',
    );
    await expect(adminWidgetsApi.batchRoad([])).rejects.toMatchObject({ status: 400 });

    const s = fuels[fuels.length - 1];
    const f = await adminWidgetsApi.batchFuel([{ id: s.id, diesel: other(s.diesel), banzen95: '1' }]);
    expect(f.updated).toBe(1);
    await expect(adminWidgetsApi.batchFuel([{ id: s.id, diesel: '5' }])).rejects.toMatchObject({
      status: 400,
    });
  });

  it('saves a manual order and reads it back', async () => {
    const reversed = roads.map((r) => r.id).reverse();
    await adminWidgetsApi.reorder('road_barriers', reversed);
    expect((await adminWidgetsApi.features()).roadBarriers.map((r) => r.id)).toEqual(reversed);
    const stations = fuels.map((x) => x.id).reverse();
    await adminWidgetsApi.reorder('fuel_stations', stations);
    expect((await adminWidgetsApi.features()).fuelStations.map((x) => x.id)).toEqual(stations);
    await expect(adminWidgetsApi.reorder('nope' as never, [1])).rejects.toMatchObject({ status: 400 });
  });
});
