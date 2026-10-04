// @vitest-environment node
// Real-backend test (no mocks) for "add my business". Uses the seeded dev user and admin; it ends with a rejection so
// repeated runs leave no business behind:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { listingSubmissionsApi, type SubmissionInput } from '@/api/listingSubmissions';
import { useAuthStore } from '@/store/authStore';
import { devSql } from '@/test/liveDb';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

async function signIn(phone: string, password: string) {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
}

const input: SubmissionInput = {
  layer: 'plumber',
  name: 'سباكة الاختبار',
  phone: '0591234567',
  x_coord: 169463.41,
  y_coord: 145767.99,
};

describe.skipIf(!BASE)('add my business against the live backend', () => {
  beforeAll(() => {
    globalThis.fetch = ((i: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof i === 'string' && i.startsWith('/') ? BASE + i : i, init)) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('offers service types and flats, but not roads, fuel, landmarks or plots', async () => {
    await signIn('0590000003', 'User#12345');
    const { layers } = await listingSubmissionsApi.layers();
    expect(layers).toContain('plumber');
    expect(layers).not.toContain('road_barriers');
    expect(layers).toEqual(expect.arrayContaining(['ApartRent', 'ApartSale']));
    expect(layers).not.toContain('LandSale');
  });

  it('refuses a bad type, a point outside the country and a second pending request', async () => {
    await signIn('0590000003', 'User#12345');
    await expect(listingSubmissionsApi.submit({ ...input, layer: 'fuel_stations' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(listingSubmissionsApi.submit({ ...input, x_coord: 1, y_coord: 2 })).rejects.toMatchObject({
      status: 400,
    });
    await listingSubmissionsApi.submit(input);
    await expect(listingSubmissionsApi.submit(input)).rejects.toMatchObject({ status: 409 });
  });

  it('only an admin sees the queue; rejecting needs a reason and tells the sender', async () => {
    await signIn('0590000003', 'User#12345');
    await expect(listingSubmissionsApi.adminList('pending')).rejects.toMatchObject({ status: 403 });

    await signIn('0590000001', 'Admin#12345');
    const { submissions } = await listingSubmissionsApi.adminList('pending');
    const mine = submissions.find((s) => s.name === input.name);
    expect(mine).toBeTruthy();
    await expect(listingSubmissionsApi.reject(mine!.id, '  ')).rejects.toMatchObject({ status: 400 });
    await listingSubmissionsApi.reject(mine!.id, 'الموقع غير واضح');
    await expect(listingSubmissionsApi.reject(mine!.id, 'again')).rejects.toMatchObject({ status: 409 });

    await signIn('0590000003', 'User#12345');
    const { submissions: list } = await listingSubmissionsApi.mine();
    expect(list[0]).toMatchObject({ name: input.name, status: 'rejected', reject_reason: 'الموقع غير واضح' });
  });

  it('the sender can cancel a pending request', async () => {
    await signIn('0590000003', 'User#12345');
    await listingSubmissionsApi.submit(input);
    const { submissions } = await listingSubmissionsApi.mine();
    expect(submissions[0].status).toBe('pending');
    await listingSubmissionsApi.cancel(submissions[0].id);
    expect((await listingSubmissionsApi.mine()).submissions.some((s) => s.status === 'pending')).toBe(false);
  });

  it('the admin may move the point before approving (a throwaway account, removed afterwards)', async () => {
    const phone = '05' + String(Date.now()).slice(-8);
    const reg = await authApi.register({
      name: 'LIVE-MOVE test',
      phone,
      whatsapp_number: '',
      password: 'secret1',
    });
    const uid = reg.user.user_id;
    let featureId: number | null = null;
    try {
      await signIn(phone, 'secret1'); // active at once
      await listingSubmissionsApi.submit({ ...input, name: 'LIVE-MOVE سباكة' });
      await signIn('0590000001', 'Admin#12345');
      const sub = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid,
      )!;
      await expect(listingSubmissionsApi.approve(sub.id, { x_coord: 1, y_coord: 2 })).rejects.toMatchObject({
        status: 400,
      });
      const res = await listingSubmissionsApi.approve(sub.id, { x_coord: 170100.5, y_coord: 145800.25 });
      featureId = res.feature_id;
      const [row] = devSql(
        'services_db',
        `SELECT ST_X(geom) || ',' || ST_Y(geom) FROM public.service_all WHERE id = ${featureId}`,
      );
      expect(row.split(',').map(Number)).toEqual([170100.5, 145800.25]);
    } finally {
      devSql(
        'services_db',
        `DELETE FROM public.service_all WHERE id = ${featureId ?? 0} AND name = 'LIVE-MOVE سباكة';
         DELETE FROM public.listing_owners WHERE user_id = ${uid};
         DELETE FROM public.listing_submissions WHERE user_id = ${uid};
         DELETE FROM public.notifications WHERE user_id = ${uid};
         DELETE FROM public.users WHERE user_id = ${uid} AND full_name = 'LIVE-MOVE test';`,
      );
    }
  });
});
