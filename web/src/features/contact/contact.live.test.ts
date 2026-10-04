// @vitest-environment node
// Real-backend test (no mocks) for the platform contact setting.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- contact.live
// It saves numbers under `settings.contact` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { api, ApiError } from '@/api/client';
import { platformContentApi } from '@/api/platformContent';
import { useAuthStore } from '@/store/authStore';
import { CONTACT_KEY, parseContact, serializeContact, telUrl, whatsappUrl } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: string | null = null;

const readStored = async () => (await platformContentApi.get(CONTACT_KEY)).item?.content_value ?? null;
const loginAdmin = async () => {
  const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
  useAuthStore.getState().setSession(user);
};

describe.skipIf(!BASE)('platform contact against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
    original = await readStored();
    await loginAdmin();
  });
  afterAll(async () => {
    await loginAdmin();
    if (original === null) await api.delete(`/api/admin/platform-content/${CONTACT_KEY}`);
    else await platformContentApi.save(CONTACT_KEY, 'Platform contact', original);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves the numbers and a visitor gets working links from them', async () => {
    await platformContentApi.save(CONTACT_KEY, 'test', serializeContact({ whatsapp: '0599 123 456', phone: '022 345 678' }));

    useAuthStore.setState({ user: null }); // a visitor
    const c = parseContact(await readStored());
    expect(c).toEqual({ whatsapp: '0599123456', phone: '022345678' });
    expect(whatsappUrl(c)).toBe('https://wa.me/970599123456');
    expect(telUrl(c)).toBe('tel:022345678');
  });

  it('removing the row means "no numbers"', async () => {
    await loginAdmin();
    await platformContentApi.remove(CONTACT_KEY);
    expect(parseContact(await readStored())).toEqual({ whatsapp: '', phone: '' });
  });

  it('a normal user cannot change it', async () => {
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    await expect(platformContentApi.save(CONTACT_KEY, 'x', '{}')).rejects.toBeInstanceOf(ApiError);
  });
});
