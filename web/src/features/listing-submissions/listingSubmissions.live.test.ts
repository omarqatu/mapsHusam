// @vitest-environment node
// Real-backend test (no mocks) for "add my business". Uses the seeded dev user and admin; it ends with a rejection so
// repeated runs leave no business behind:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { listingSubmissionsApi, type LandPolygon, type SubmissionInput } from '@/api/listingSubmissions';
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
    expect(layers).toContain('LandSale');
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

  it('approves rent and sale flats using each property table’s fid key', async () => {
    const phone = '05' + String(Date.now()).slice(-8);
    const reg = await authApi.register({
      name: 'LIVE-FID test',
      phone,
      whatsapp_number: '',
      password: 'secret1',
    });
    const uid = reg.user.user_id;
    const approved: { layer: 'ApartRent' | 'ApartSale'; id: number; name: string }[] = [];
    try {
      for (const layer of ['ApartRent', 'ApartSale'] as const) {
        const name = `LIVE-FID ${layer}`;
        await signIn(phone, 'secret1');
        await listingSubmissionsApi.submit({ ...input, layer, name, area: 80, price: 120000, currency: 'ILS' });
        await signIn('0590000001', 'Admin#12345');
        const sub = (await listingSubmissionsApi.adminList('pending')).submissions.find(
          (s) => s.user_id === uid && s.layer === layer,
        )!;
        const res = await listingSubmissionsApi.approve(sub.id, {});
        approved.push({ layer, id: res.feature_id, name });
        expect(
          devSql('realestate', `SELECT fid FROM public."${layer}" WHERE fid = ${res.feature_id}`),
        ).toContain(String(res.feature_id));
      }
    } finally {
      for (const { layer, id, name } of approved) {
        devSql('realestate', `DELETE FROM public."${layer}" WHERE fid = ${id} AND name = '${name}'`);
      }
      devSql(
        'services_db',
        `DELETE FROM public.listing_owners WHERE user_id = ${uid};
         DELETE FROM public.listing_submissions WHERE user_id = ${uid};
         DELETE FROM public.notifications WHERE user_id = ${uid};
         DELETE FROM public.users WHERE user_id = ${uid} AND full_name = 'LIVE-FID test';`,
      );
    }
  });

  it('allows only one pending listing and unlocks the next type after each approval', async () => {
    const phone = '05' + String(Date.now()).slice(-8);
    const reg = await authApi.register({
      name: 'LIVE-SEQUENTIAL-SUBMISSIONS test',
      phone,
      whatsapp_number: '',
      password: 'secret1',
    });
    const uid = reg.user.user_id;
    const approvedServices: { id: number; name: string }[] = [];
    const approvedProperties: { layer: 'ApartRent' | 'LandSale'; id: number; name: string }[] = [];
    const landGeometry: LandPolygon = {
      type: 'Polygon',
      coordinates: [[
        [170200, 145900],
        [170220, 145900],
        [170220, 145920],
        [170200, 145920],
        [170200, 145900],
      ]],
    };

    try {
      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({ ...input, name: 'LIVE-SEQUENTIAL service one' });
      await expect(
        listingSubmissionsApi.submit({ ...input, layer: 'ApartRent', name: 'LIVE-SEQUENTIAL flat two' }),
      ).rejects.toMatchObject({ status: 409 });

      await signIn('0590000001', 'Admin#12345');
      const first = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid && s.name === 'LIVE-SEQUENTIAL service one',
      )!;
      approvedServices.push({
        id: (await listingSubmissionsApi.approve(first.id, {})).feature_id,
        name: 'LIVE-SEQUENTIAL service one',
      });

      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({
        ...input,
        layer: 'ApartRent',
        name: 'LIVE-SEQUENTIAL flat two',
        area: 80,
        price: 120000,
        currency: 'ILS',
      });
      await expect(
        listingSubmissionsApi.submit({
          ...input,
          layer: 'LandSale',
          name: 'LIVE-SEQUENTIAL land three',
          area: 400,
          geometry: landGeometry,
        }),
      ).rejects.toMatchObject({ status: 409 });

      await signIn('0590000001', 'Admin#12345');
      const second = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid && s.name === 'LIVE-SEQUENTIAL flat two',
      )!;
      approvedProperties.push({
        layer: 'ApartRent',
        id: (await listingSubmissionsApi.approve(second.id, {})).feature_id,
        name: 'LIVE-SEQUENTIAL flat two',
      });

      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({
        ...input,
        layer: 'LandSale',
        name: 'LIVE-SEQUENTIAL land three',
        area: 400,
        geometry: landGeometry,
      });
      await expect(
        listingSubmissionsApi.submit({ ...input, name: 'LIVE-SEQUENTIAL service four' }),
      ).rejects.toMatchObject({ status: 409 });

      await signIn('0590000001', 'Admin#12345');
      const third = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid && s.name === 'LIVE-SEQUENTIAL land three',
      )!;
      approvedProperties.push({
        layer: 'LandSale',
        id: (await listingSubmissionsApi.approve(third.id, {})).feature_id,
        name: 'LIVE-SEQUENTIAL land three',
      });

      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({ ...input, name: 'LIVE-SEQUENTIAL service four' });
      const { submissions } = await listingSubmissionsApi.mine();
      expect(submissions.filter((s) => s.status === 'pending')).toHaveLength(1);
      expect(submissions[0]).toMatchObject({ name: 'LIVE-SEQUENTIAL service four', status: 'pending' });
    } finally {
      for (const { id, name } of approvedServices) {
        devSql('services_db', `DELETE FROM public.service_all WHERE id = ${id} AND name = '${name}'`);
      }
      for (const { layer, id, name } of approvedProperties) {
        const table = layer === 'LandSale' ? '"LandSale"' : '"ApartRent"';
        devSql('realestate', `DELETE FROM public.${table} WHERE fid = ${id} AND name = '${name}'`);
      }
      devSql(
        'services_db',
        `DELETE FROM public.listing_owners WHERE user_id = ${uid};
         DELETE FROM public.listing_submissions WHERE user_id = ${uid};
         DELETE FROM public.notifications WHERE user_id = ${uid};
         DELETE FROM public.users WHERE user_id = ${uid} AND full_name = 'LIVE-SEQUENTIAL-SUBMISSIONS test';`,
      );
    }
  });

  it('keeps a provider’s selected location when approving a second service or flat listing', async () => {
    const phone = '05' + String(Date.now()).slice(-8);
    const reg = await authApi.register({
      name: 'LIVE-SECOND-LISTING test',
      phone,
      whatsapp_number: '',
      password: 'secret1',
    });
    const uid = reg.user.user_id;
    let firstServiceId: number | null = null;
    let secondServiceId: number | null = null;
    const approvedFlats: { layer: 'ApartRent' | 'ApartSale'; id: number; name: string }[] = [];
    const selectedPoint = [170100.5, 145800.25] as const;
    try {
      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({ ...input, name: 'LIVE-SECOND-LISTING first service' });
      await signIn('0590000001', 'Admin#12345');
      const firstSubmission = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid,
      )!;
      firstServiceId = (await listingSubmissionsApi.approve(firstSubmission.id, {})).feature_id;

      await signIn(phone, 'secret1');
      await listingSubmissionsApi.submit({
        ...input,
        layer: 'plumber',
        name: 'LIVE-SECOND-LISTING second service',
        x_coord: selectedPoint[0],
        y_coord: selectedPoint[1],
      });
      await signIn('0590000001', 'Admin#12345');
      const secondServiceSubmission = (await listingSubmissionsApi.adminList('pending')).submissions.find(
        (s) => s.user_id === uid && s.layer === 'plumber' && s.name === 'LIVE-SECOND-LISTING second service',
      )!;
      secondServiceId = (await listingSubmissionsApi.approve(secondServiceSubmission.id, {})).feature_id;
      const [servicePoint] = devSql(
        'services_db',
        `SELECT ST_X(geom) || ',' || ST_Y(geom)
         FROM public.service_all WHERE id = ${secondServiceId} AND name = 'LIVE-SECOND-LISTING second service'`,
      );
      expect(servicePoint.split(',').map(Number)).toEqual([...selectedPoint]);

      for (const layer of ['ApartRent', 'ApartSale'] as const) {
        const name = `LIVE-SECOND-LISTING ${layer}`;
        await signIn(phone, 'secret1');
        await listingSubmissionsApi.submit({
          ...input,
          layer,
          name,
          x_coord: selectedPoint[0],
          y_coord: selectedPoint[1],
          area: 80,
          price: 120000,
          currency: 'ILS',
        });
        await signIn('0590000001', 'Admin#12345');
        const submission = (await listingSubmissionsApi.adminList('pending')).submissions.find(
          (s) => s.user_id === uid && s.layer === layer && s.name === name,
        )!;
        const { feature_id: id } = await listingSubmissionsApi.approve(submission.id, {});
        approvedFlats.push({ layer, id, name });
        const [row] = devSql(
          'realestate',
          `SELECT ST_X(ST_PointOnSurface(geom)) || ',' || ST_Y(ST_PointOnSurface(geom))
           FROM public."${layer}" WHERE fid = ${id} AND name = '${name}'`,
        );
        expect(row.split(',').map(Number)).toEqual([...selectedPoint]);
      }

      const [ownerLocation] = devSql(
        'services_db',
        `SELECT x_coord || ',' || y_coord FROM public.users WHERE user_id = ${uid}`,
      );
      expect(ownerLocation.split(',').map(Number)).toEqual([input.x_coord, input.y_coord]);
    } finally {
      for (const { layer, id, name } of approvedFlats) {
        devSql('realestate', `DELETE FROM public."${layer}" WHERE fid = ${id} AND name = '${name}'`);
      }
      if (firstServiceId !== null) {
        devSql('services_db', `DELETE FROM public.service_all WHERE id = ${firstServiceId} AND name = 'LIVE-SECOND-LISTING first service'`);
      }
      if (secondServiceId !== null) {
        devSql('services_db', `DELETE FROM public.service_all WHERE id = ${secondServiceId} AND name = 'LIVE-SECOND-LISTING second service'`);
      }
      devSql(
        'services_db',
        `DELETE FROM public.listing_owners WHERE user_id = ${uid};
         DELETE FROM public.listing_submissions WHERE user_id = ${uid};
         DELETE FROM public.notifications WHERE user_id = ${uid};
         DELETE FROM public.users WHERE user_id = ${uid} AND full_name = 'LIVE-SECOND-LISTING test';`,
      );
    }
  });
});
