// @vitest-environment node
// Real-backend integration test. NOT mocked: talks to server.js + Postgres started by dev/dev.sh.
//   dev/dev.sh db-up && dev/dev.sh seed && dev/dev.sh server      (in the repo root, another terminal)
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from './auth';
import { ApiError, api } from './client';
import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

describe.skipIf(!BASE)('live backend', () => {
  beforeAll(() => {
    // The client uses relative URLs (browser + Vite proxy); in Node give them a base.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
  });

  it('rejects wrong credentials with the server message and keeps no session', async () => {
    await expect(authApi.login({ phone: '0590000001', password: 'wrong' })).rejects.toMatchObject({
      status: 401,
    });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logs in and returns the user shape the AuthUser type declares', async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    expect(user).toMatchObject({ role: 'admin', phone: '0590000001' });
    expect(user).not.toHaveProperty('password_hash'); // never leaked to the client
    expect(typeof user.token).toBe('string');
    expect(user.admin_token).toBe(user.token);
    for (const k of [
      'user_id',
      'id',
      'full_name',
      'email',
      'whatsapp_number',
      'status',
      'target_layer',
      'targetId',
      'target_id',
      'x_coord',
      'y_coord',
    ]) {
      expect(user).toHaveProperty(k);
    }
    useAuthStore.getState().setSession(user);
  });

  it('verify-session says valid for the logged-in user', async () => {
    const id = useAuthStore.getState().user!.user_id;
    expect((await authApi.verifySession(id)).valid).toBe(true);
  });

  it('an authenticated admin endpoint works with the bearer token', async () => {
    const res = await api.get<unknown>('/api/admin/users');
    expect(res).toBeTruthy();
  });

  it('a garbage token gets 401 and the client drops the session', async () => {
    const u = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...u, token: 'garbage' } });
    await expect(api.get('/api/admin/users')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
