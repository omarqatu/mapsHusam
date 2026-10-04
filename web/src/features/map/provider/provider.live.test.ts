// @vitest-environment node
// Real-backend check of the provider endpoints. NOT mocked (see src/api/live.test.ts for how to run):
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// It flips the status / position of the dev provider's own linked row (linking one if there is none) and restores
// the row and the link afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { api } from '@/api/client';
import { providerApi } from '@/api/provider';
import { searchApi } from '@/api/search';
import { useAuthStore } from '@/store/authStore';
import { interpretService } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

const login = async (phone: string, password: string) => {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
  return user;
};

describe.skipIf(!BASE)('live backend — provider panel endpoints', () => {
  let providerId = 0;
  let layer = '';
  let featureId = 0;
  let original: { status: 0 | 1; x: number; y: number } | null = null;
  /** True when the test had to link the provider itself (and so must unlink it again). */
  let linkedByTest = false;

  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
  });
  afterAll(async () => {
    // Put the row and the account back as they were.
    try {
      if (original) {
        await login('0590000002', 'Provider#12345');
        await providerApi.updateStatus({
          user_id: providerId,
          service_layer: layer,
          feature_id: featureId,
          status: original.status,
          x_coord: original.x,
          y_coord: original.y,
        });
      }
      await login('0590000001', 'Admin#12345');
      if (linkedByTest)
        await api.post('/api/admin/users/update', { user_id: providerId, service_layer: '', feature_id: null });
    } finally {
      globalThis.fetch = nativeFetch;
      useAuthStore.getState().logout();
    }
  });

  it('an account without a linked feature gets success:false and the panel reads it as "unlinked"', async () => {
    await login('0590000003', 'User#12345');
    const res = await providerApi.getService();
    expect(res.success).toBe(false);
    expect(interpretService(res)).toEqual({ kind: 'unlinked' });
    providerId = (await login('0590000002', 'Provider#12345')).user_id;
  });

  it('a provider cannot update a feature that is not linked to the account (403)', async () => {
    await expect(
      providerApi.updateStatus({ user_id: providerId, service_layer: 'plumber', feature_id: 1, status: 0 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reads the linked service, flips the status and moves the point', async () => {
    let res = await providerApi.getService();
    if (!res.success) {
      // Not linked yet: link one real service row as the admin.
      await login('0590000001', 'Admin#12345');
      const all = await searchApi.search({ layer: 'service_all', workspace: 'services' });
      const row = all.features.find((f) => typeof f.properties?.discriminator === 'string');
      expect(row).toBeTruthy();
      await api.post('/api/admin/users/update', {
        user_id: providerId,
        service_layer: String(row!.properties!.discriminator),
        feature_id: Number(row!.properties!.id),
      });
      linkedByTest = true;
      await login('0590000002', 'Provider#12345');
      res = await providerApi.getService();
    }
    const account = interpretService(res);
    expect(account.kind).toBe('ready');
    if (account.kind !== 'ready') return;
    layer = account.service.layer;
    featureId = account.service.featureId;
    const [x0, y0] = account.service.location ?? [0, 0];
    original = { status: account.service.status, x: x0, y: y0 };

    // status only
    const off = await providerApi.updateStatus({ user_id: providerId, service_layer: layer, feature_id: featureId, status: 1 });
    expect(off).toMatchObject({ success: true, status: 1 });
    const after = interpretService(await providerApi.getService());
    expect(after.kind === 'ready' && after.service.status).toBe(1);

    // status + position (2 decimals, grid metres), then it is stored as sent
    const moved = await providerApi.updateStatus({
      user_id: providerId,
      service_layer: layer,
      feature_id: featureId,
      status: 0,
      x_coord: 170000.12,
      y_coord: 146000.34,
    });
    expect(moved.success).toBe(true);
    const back = interpretService(await providerApi.getService());
    expect(back.kind === 'ready' && back.service.status).toBe(0);
    expect(back.kind === 'ready' && back.service.location).toEqual([170000.12, 146000.34]);
  });

  it('rejects a status other than 0 or 1 (400)', async () => {
    await expect(
      providerApi.updateStatus({ user_id: providerId, service_layer: layer, feature_id: featureId, status: 2 as 0 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('an unauthenticated call is refused (401)', async () => {
    useAuthStore.getState().logout();
    await expect(providerApi.getService()).rejects.toMatchObject({ status: 401 });
  });
});
