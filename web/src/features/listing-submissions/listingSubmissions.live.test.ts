// @vitest-environment node
// Real-backend test (no mocks) for "add my business". Uses the seeded dev user and admin; it ends with a rejection so
// repeated runs leave no business behind:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { listingSubmissionsApi, type SubmissionInput } from '@/api/listingSubmissions';
import { useAuthStore } from '@/store/authStore';

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

  it('offers service types but not roads, fuel or landmarks', async () => {
    await signIn('0590000003', 'User#12345');
    const { layers } = await listingSubmissionsApi.layers();
    expect(layers).toContain('plumber');
    expect(layers).not.toContain('road_barriers');
    expect(layers).not.toContain('ApartRent');
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
});
