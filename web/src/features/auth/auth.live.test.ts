// @vitest-environment node
// Real-backend test (no mocks) for the register and change-password flows.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// Registers one throwaway account per run in the dev database (active at once).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { toWhatsappNumber } from './phone';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;

describe.skipIf(!BASE)('auth flows against the live backend', () => {
  beforeAll(() => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  const phone = '05' + String(Date.now()).slice(-8);

  it('registers a new account (no session yet) and rejects a duplicate phone', async () => {
    const body = {
      name: 'Live Test',
      phone,
      whatsapp_number: toWhatsappNumber('970', phone),
      password: 'secret1',
      email: '',
    };
    const res = await authApi.register(body);
    expect(res.status).toBe('success');
    expect(res.user).toMatchObject({ phone, role: 'user' });
    await expect(authApi.register(body)).rejects.toMatchObject({ status: 400 });
  });

  it('the new account is active at once: it logs in as a plain user', async () => {
    expect(useAuthStore.getState().user).toBeNull();
    const { user } = await authApi.login({ phone, password: 'secret1' });
    expect(user).toMatchObject({ phone, role: 'user' });
    expect(user.token).toBeTruthy();
  });

  it('rejects a too-short password and a malformed phone with the server message', async () => {
    await expect(
      authApi.register({ name: 'x', phone: '0512345678', whatsapp_number: '', password: '123' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      authApi.register({ name: 'x', phone: '12345', whatsapp_number: '', password: 'secret1' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('changes the password, keeps the session on the rotated token, and can change it back', async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    try {
      await expect(
        authApi.changePassword({
          userId: user.user_id,
          currentPassword: 'wrong',
          newPassword: 'Other#12345',
        }),
      ).rejects.toMatchObject({ status: 400 });
      const ok = await authApi.changePassword({
        userId: user.user_id,
        currentPassword: 'Admin#12345',
        newPassword: 'Other#12345',
      });
      expect(ok.status).toBe('success');
      expect(useAuthStore.getState().user?.token).toBeTruthy();
    } finally {
      // always restore the seeded password so the other live tests keep working
      await authApi
        .changePassword({ userId: user.user_id, currentPassword: 'Other#12345', newPassword: 'Admin#12345' })
        .catch(() => undefined);
    }
    const again = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    expect(again.user.role).toBe('admin');
  });
});
