// @vitest-environment node
// Real-backend test (no mocks) for the interface-text overrides.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- textOverrides.live
// It saves an override under `settings.texts` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { platformContentApi } from '@/api/platformContent';
import { useAuthStore } from '@/store/authStore';
import { TEXTS_KEY, parseTextOverrides, serializeTextOverrides } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: { label: string; value: string } | null = null;

const asAdmin = async () => {
  const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
  useAuthStore.getState().setSession(user);
};
const readStored = async () => (await platformContentApi.get(TEXTS_KEY)).item ?? null;

describe.skipIf(!BASE)('interface texts against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
    const item = await readStored();
    original = item ? { label: item.label, value: item.content_value } : null;
    await asAdmin();
  });
  afterAll(async () => {
    await asAdmin();
    if (original) await platformContentApi.save(TEXTS_KEY, original.label, original.value);
    else await platformContentApi.remove(TEXTS_KEY);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves the wording and a visitor reads it back', async () => {
    const wanted = { ar: { 'searchPage.heroText': 'نص اختبار' }, en: { 'searchPage.heroText': 'Test text' } };
    await platformContentApi.save(TEXTS_KEY, 'test', serializeTextOverrides(wanted));
    useAuthStore.setState({ user: null }); // a visitor
    expect(parseTextOverrides((await readStored())?.content_value)).toEqual(wanted);
  });

  it('a normal user cannot change it', async () => {
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    await expect(platformContentApi.save(TEXTS_KEY, 'x', '{}')).rejects.toBeInstanceOf(ApiError);
  });
});
