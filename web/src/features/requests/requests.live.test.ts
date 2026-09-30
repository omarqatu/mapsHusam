// @vitest-environment node
// Real-backend test (no mocks) for the service-request lifecycle. Needs the seeded dev accounts; the dev provider is
// linked to a real plumber row by dev/seed-users.mjs, and the request targets whatever that link is:
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { providerApi } from '@/api/provider';
import { requestsApi } from '@/api/requests';
import { useAuthStore } from '@/store/authStore';
import { interpretService } from '@/features/map/provider/model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

async function signIn(phone: string, password: string) {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
  return user;
}

describe.skipIf(!BASE)('service requests against the live backend', () => {
  let body = { service_layer: '', feature_id: 0, provider_name: 'Dev Provider', service_type: 'سباك' };

  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    await signIn('0590000002', 'Provider#12345');
    const account = interpretService(await providerApi.getService());
    if (account.kind !== 'ready') throw new Error('dev provider is not linked — run dev/dev.sh seed');
    body = { ...body, service_layer: account.service.layer, feature_id: account.service.featureId };
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('request → accept → chat → both agree → contacts → rating → comment', async () => {
    const user = await signIn('0590000003', 'User#12345');
    const created = await requestsApi.create(body);
    expect(created).toMatchObject({ success: true, status: 'pending' });
    const id = created.requestId;

    // Same provider again while one is open: the server refuses.
    await expect(requestsApi.create(body)).rejects.toMatchObject({ status: 409 });
    expect((await requestsApi.mine(user.user_id)).requests.some((r) => r.id === id)).toBe(true);

    const provider = await signIn('0590000002', 'Provider#12345');
    const incoming = await requestsApi.incoming(provider.user_id);
    expect(incoming.requests.some((r) => r.id === id)).toBe(true);
    expect((await requestsApi.respond(id, 'accept')).status).toBe('accepted');

    await requestsApi.sendMessage(id, 'provider', 'hello from provider');
    const first = await requestsApi.confirm(id, 'provider');
    expect(first.status).toBe('accepted');

    await signIn('0590000003', 'User#12345');
    const msgs = await requestsApi.messages(id);
    expect(msgs.messages.map((m) => m.message)).toContain('hello from provider');
    const done = await requestsApi.confirm(id, 'user');
    expect(done.status).toBe('completed');

    expect((await requestsApi.pendingRatings()).pendingRatings.some((p) => p.id === id)).toBe(true);
    // One rating per user per business: a re-run against the same dev database is refused after the first.
    const rated = await requestsApi.rate(id, 4, '').then(
      () => true,
      () => false,
    );
    if (!rated) {
      await expect(requestsApi.rate(id, 4, '')).rejects.toMatchObject({ status: 400 });
      return;
    }
    const pc = await requestsApi.pendingComments();
    const pending = pc.pendingComments.find((c) => c.request_id === id);
    expect(pending).toBeTruthy();
    await requestsApi.comment(pending!.id, 'good work');
  });

  it('request → provider rejects; request → user cancels with a reason', async () => {
    await signIn('0590000003', 'User#12345');
    const a = await requestsApi.create(body);
    await signIn('0590000002', 'Provider#12345');
    expect((await requestsApi.respond(a.requestId, 'reject')).status).toBe('rejected');

    await signIn('0590000003', 'User#12345');
    const b = await requestsApi.create(body);
    await expect(requestsApi.cancel(b.requestId, '')).rejects.toMatchObject({ status: 400 });
    expect((await requestsApi.cancel(b.requestId, 'changed my mind')).success).toBe(true);
  });
});
