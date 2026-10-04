// @vitest-environment node
// Real-backend test (no mocks): a viewing of a flat — request → the owner accepts with a time → the time moves → both
// confirm it happened → the requester rates the flat → the publisher's rating counts it.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- viewing.live
// It lends the dev provider a real flat for the run (listing_owners) and removes that link, its requests and ratings after.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { mapEventsApi } from '@/api/mapEvents';
import { requestsApi } from '@/api/requests';
import { useAuthStore } from '@/store/authStore';
import { devSql } from '@/test/liveDb';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
const LAYER = 'ApartRent';
let fid = 0;

async function signIn(phone: string, password: string) {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
  return user;
}
const asUser = () => signIn('0590000003', 'User#12345');
const asOwner = () => signIn('0590000002', 'Provider#12345');
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function cleanup() {
  if (!fid) return;
  const requests = `(SELECT id FROM public.service_requests WHERE service_layer = '${LAYER}' AND feature_id = ${fid})`;
  devSql(
    'services_db',
    `DELETE FROM public.service_ratings WHERE service_layer = '${LAYER}' AND feature_id = ${fid};
     DELETE FROM public.notifications WHERE link IN (SELECT 'request:' || id FROM ${requests});
     DELETE FROM public.service_requests WHERE id IN ${requests};
     DELETE FROM public.listing_owners WHERE layer = '${LAYER}' AND feature_id = ${fid};`,
  );
}

describe.skipIf(!BASE)('a viewing of a flat against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    const owned = devSql(
      'services_db',
      `SELECT feature_id FROM public.listing_owners WHERE layer = '${LAYER}'`,
    ).map(Number);
    const free = devSql(
      'realestate',
      `SELECT fid FROM public."${LAYER}" WHERE status = 0 ORDER BY fid LIMIT 50`,
    )
      .map(Number)
      .find((id) => !owned.includes(id));
    if (!free) throw new Error(`no free ${LAYER} row in the dev database`);
    fid = free;
    const owner = await asOwner();
    devSql(
      'services_db',
      `INSERT INTO public.listing_owners (layer, feature_id, user_id) VALUES ('${LAYER}', ${fid}, ${owner.user_id})`,
    );
  });
  afterAll(() => {
    cleanup();
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('request → accept with a time → move it → done → rate → the publisher rating counts it', async () => {
    const before = await mapEventsApi.publisherRating(LAYER, String(fid));
    expect(before).toMatchObject({ success: true, publisher: true });
    expect(before.listings).toBeGreaterThanOrEqual(2); // the plumber and this flat

    const user = await asUser();
    const { requestId: id } = await requestsApi.create({
      service_layer: LAYER,
      feature_id: fid,
      provider_name: 'Dev Provider',
      service_type: 'شقة للإيجار',
    });
    // The requester may propose a time before the owner answers.
    await requestsApi.setAppointment(id, inHours(30));

    await asOwner();
    // Not in the past, not months away.
    await expect(requestsApi.respond(id, 'accept', inHours(-5))).rejects.toMatchObject({ status: 400 });
    await expect(requestsApi.respond(id, 'accept', inHours(24 * 120))).rejects.toMatchObject({ status: 400 });
    const at = inHours(26);
    const accepted = await requestsApi.respond(id, 'accept', at);
    expect(accepted.status).toBe('accepted');
    expect(new Date(accepted.appointment_at!).getTime()).toBe(new Date(at).getTime());

    await asUser();
    const moved = inHours(48);
    await requestsApi.setAppointment(id, moved);
    const row = (await requestsApi.mine(user.user_id)).requests.find((r) => r.id === id)!;
    expect(new Date(row.appointment_at!).getTime()).toBe(new Date(moved).getTime());

    // Someone else cannot touch it.
    await signIn('0590000001', 'Admin#12345');
    await expect(requestsApi.setAppointment(id, inHours(5))).rejects.toMatchObject({ status: 404 });

    await asOwner();
    await requestsApi.confirm(id, 'provider');
    await asUser();
    const done = await requestsApi.confirm(id, 'user');
    expect(done.status).toBe('completed');
    // the owner's numbers come from the flat's own row (property tables key on fid)
    expect(done).toHaveProperty('providerPhone');
    await expect(requestsApi.setAppointment(id, inHours(5))).rejects.toMatchObject({ status: 409 });

    expect((await requestsApi.pendingRatings()).pendingRatings.some((p) => p.id === id)).toBe(true);
    await requestsApi.rate(id, 5, 'شقة نظيفة');
    const ratings = await mapEventsApi.ratings(LAYER, String(fid));
    expect(ratings).toMatchObject({ totalRatings: 1, averageRating: 5 });
    const after = await mapEventsApi.publisherRating(LAYER, String(fid));
    expect(after.totalRatings).toBe(before.totalRatings + 1);
  });

  it('a listing without a registered owner has no publisher rating', async () => {
    useAuthStore.setState({ user: null });
    const none = await mapEventsApi.publisherRating(LAYER, '999999999');
    expect(none).toMatchObject({ success: true, publisher: false, totalRatings: 0 });
    await expect(mapEventsApi.publisherRating('nope', '1')).rejects.toMatchObject({ status: 400 });
  });
});
