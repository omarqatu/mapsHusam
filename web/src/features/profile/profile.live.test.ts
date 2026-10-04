// @vitest-environment node
// Real-backend test (no mocks) for "my profile".
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- profile.live
// It edits the dev user's own profile and puts it back afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { profileApi, type Profile } from '@/api/profile';
import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: Profile;

const status = (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e: unknown) => (e instanceof ApiError ? e.status : -1),
  );

describe.skipIf(!BASE)('my profile against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    original = (await profileApi.get()).profile;
  });
  afterAll(async () => {
    await profileApi.update({
      full_name: original.full_name ?? 'Dev User',
      whatsapp_number: original.whatsapp_number ?? '',
      email: original.email ?? '',
    });
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('reads the signed-in account, phone included', () => {
    expect(original.phone).toBe('0590000003');
    expect(original.role).toBe('user');
  });

  it('saves name and WhatsApp (normalised), and reads them back', async () => {
    const { profile } = await profileApi.update({ full_name: 'تجربة الملف', whatsapp_number: '0599111222' });
    expect(profile).toMatchObject({
      full_name: 'تجربة الملف',
      whatsapp_number: '+970599111222',
      phone: '0590000003',
    });
    expect((await profileApi.get()).profile.full_name).toBe('تجربة الملف');
  });

  it("refuses a bad email, another account's email, and fields that are not the user's", async () => {
    expect(await status(profileApi.update({ email: 'nope' }))).toBe(400);
    expect(await status(profileApi.update({ email: 'admin@dev.local' }))).toBe(409);
    expect(await status(profileApi.update({ role: 'admin' } as never))).toBe(400);
    expect((await profileApi.get()).profile.role).toBe('user');
  });

  it('needs a session', async () => {
    useAuthStore.setState({ user: null });
    expect((await nativeFetch(`${BASE}/api/auth/profile`)).status).toBe(401);
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
  });
});
