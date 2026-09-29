// @vitest-environment node
// Real-backend test (no mocks) for the calls the home page's "needs you" list and figures are built from:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// It creates ONE service request between the seeded user and provider and cancels it again at the end.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminUsersApi } from '@/api/adminUsers';
import { authApi } from '@/api/auth';
import { platformApi } from '@/api/platform';
import { providerApi } from '@/api/provider';
import { requestsApi } from '@/api/requests';
import { interpretService } from '@/features/map/provider/model';
import { useAuthStore } from '@/store/authStore';
import { buildSignals, countInactive, summarizeRequests } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

async function signIn(phone: string, password: string) {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
  return user;
}

describe.skipIf(!BASE)('home page data against the live backend', () => {
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('platform figures are public numbers', async () => {
    useAuthStore.setState({ user: null });
    const { success, data } = await platformApi.stats();
    expect(success).toBe(true);
    expect(data?.featuresCount).toBeGreaterThan(0);
    expect(data?.servicesCount).toBeGreaterThan(0);
    expect(typeof data?.usersTotal).toBe('number');
  });

  it('the admin list is admin-only, and inactive accounts can be counted from it', async () => {
    await signIn('0590000003', 'User#12345');
    await expect(adminUsersApi.list()).rejects.toMatchObject({ status: 403 });

    await signIn('0590000001', 'Admin#12345');
    const { users, total } = await adminUsersApi.list();
    expect(users.length).toBe(total);
    const inactive = countInactive(users);
    expect(inactive).toBe(users.filter((u) => u.is_active === false).length);
    expect(inactive).toBeLessThanOrEqual(users.length);
  });

  it('a request shows up as "waiting" for the user and "incoming" for the provider, then as a chat, then is gone', async () => {
    const provider = await signIn('0590000002', 'Provider#12345');
    const account = interpretService(await providerApi.getService());
    if (account.kind !== 'ready') throw new Error('dev provider is not linked — run dev/dev.sh seed');
    const { layer, featureId } = account.service;

    const user = await signIn('0590000003', 'User#12345');
    const before = summarizeRequests((await requestsApi.mine(user.user_id)).requests, user.user_id);
    const created = await requestsApi.create({
      service_layer: layer,
      feature_id: featureId,
      provider_name: 'Dev Provider',
      service_type: 'home-page-check',
    });
    try {
      const mine = summarizeRequests((await requestsApi.mine(user.user_id)).requests, user.user_id);
      expect(mine.waitingReply).toBe(before.waitingReply + 1);
      expect(buildSignals({ ...emptyInput, role: 'user', requests: mine }).map((s) => s.id)).toContain('waiting');

      await signIn('0590000002', 'Provider#12345');
      const queue = (await requestsApi.incoming(provider.user_id)).requests;
      expect(queue.some((r) => r.id === created.requestId)).toBe(true);
      // The provider's full list agrees with their queue about what is waiting for an answer.
      const theirs = summarizeRequests((await requestsApi.mine(provider.user_id)).requests, provider.user_id);
      expect(theirs.incoming).toBe(queue.length);

      await requestsApi.respond(created.requestId, 'accept');
      const active = summarizeRequests((await requestsApi.mine(provider.user_id)).requests, provider.user_id);
      expect(active.active).toBeGreaterThanOrEqual(1);
      expect(active.incoming).toBe(queue.length - 1);
    } finally {
      await signIn('0590000003', 'User#12345');
      await requestsApi.cancel(created.requestId, 'home page live test');
    }
    const after = summarizeRequests((await requestsApi.mine(user.user_id)).requests, user.user_id);
    expect(after.waitingReply).toBe(before.waitingReply);
    expect(after.active).toBe(before.active);
  });

  it('unread ratings are a plain list the home page can count', async () => {
    await signIn('0590000003', 'User#12345');
    const { pendingRatings } = await requestsApi.pendingRatings();
    expect(Array.isArray(pendingRatings)).toBe(true);
  });
});

const emptyInput = {
  role: 'user' as const,
  requests: { waitingReply: 0, active: 0, incoming: 0 },
  unseen: 0,
  pendingRatings: 0,
  unreadNotifications: 0,
  inactiveUsers: 0,
  provider: null,
};
